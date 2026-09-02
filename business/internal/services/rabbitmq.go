package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/streadway/amqp"
	"go.opentelemetry.io/otel"
)

type consumerRegistration struct {
	exchange    string
	queueName   string
	routingKeys []string
	handler     func(amqp.Delivery) error
}

type RabbitMQService struct {
	conn    *amqp.Connection
	channel *amqp.Channel
	url     string

	mu        sync.Mutex
	consumers []consumerRegistration
}

func NewRabbitMQProvider(url string) *RabbitMQService {
	if url == "" {
		url = os.Getenv("AMQP_URL")
		if url == "" {
			url = "amqp://localhost:5672"
		}
	}
	return &RabbitMQService{
		url: url,
	}
}

func (s *RabbitMQService) Connect() error {
	var err error
	s.conn, err = amqp.Dial(s.url)
	if err != nil {
		return fmt.Errorf("failed to connect to RabbitMQ: %v", err)
	}

	go func() {
		<-s.conn.NotifyClose(make(chan *amqp.Error))
		log.Println("[RabbitMQ] Connection closed. Reconnecting...")
		for {
			time.Sleep(5 * time.Second)
			if err := s.Connect(); err != nil {
				log.Printf("[RabbitMQ] Reconnect failed, retrying: %v", err)
				continue
			}
			s.resubscribeConsumers()
			return
		}
	}()

	s.channel, err = s.conn.Channel()
	if err != nil {
		return fmt.Errorf("failed to open a channel: %v", err)
	}

	if err := s.channel.Qos(10, 0, false); err != nil {
		log.Printf("[RabbitMQ] Warning: failed to set QoS prefetch: %v", err)
	}

	if err := s.setupExchanges(); err != nil {
		return fmt.Errorf("failed to setup exchanges: %v", err)
	}

	log.Println("[RabbitMQ] Connected successfully")
	return nil
}

func (s *RabbitMQService) setupExchanges() error {
	exchanges := []struct {
		name string
		kind string
	}{
		{"wbot.commands", "topic"},
		{"wbot.events", "topic"},
		{dlqExchange, "topic"},
		{"api.events", "topic"},
		{"knowledge.jobs", "topic"},
		{"knowledge.events", "topic"},
	}
	for _, ex := range exchanges {
		if err := s.channel.ExchangeDeclare(
			ex.name, ex.kind, true, false, false, false, nil,
		); err != nil {
			return fmt.Errorf("exchange %s: %v", ex.name, err)
		}
	}
	return nil
}

func (s *RabbitMQService) PublishCommand(routingKey string, payload interface{}) error {
	return s.publishWithTrace("wbot.commands", routingKey, payload)
}

func (s *RabbitMQService) PublishEvent(routingKey string, payload interface{}) error {
	return s.publishWithTrace("wbot.events", routingKey, payload)
}

// PublishKnowledgeJob publishes an ingestion job to the knowledge.jobs exchange
// for the watink-knowledge microservice to consume.
func (s *RabbitMQService) PublishKnowledgeJob(routingKey string, payload interface{}) error {
	return s.publishWithTrace("knowledge.jobs", routingKey, payload)
}

// PublishKnowledgeEvent publishes a status event (ingestion progress/result)
// to the knowledge.events exchange — consumed by KnowledgeStatusListener to
// update the Source and by the ingestion worker's own status reporting.
func (s *RabbitMQService) PublishKnowledgeEvent(routingKey string, payload interface{}) error {
	return s.publishWithTrace("knowledge.events", routingKey, payload)
}

func (s *RabbitMQService) publishWithTrace(exchange, routingKey string, payload interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	headers := amqp.Table{}
	// Inject current trace context into AMQP headers for distributed tracing
	otel.GetTextMapPropagator().Inject(context.Background(), &amqpHeaderCarrier{headers: headers})

	log.Printf("[RabbitMQ] Publishing to %s/%s", exchange, routingKey)
	return s.channel.Publish(
		exchange, routingKey, false, false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
			Timestamp:    time.Now(),
			Headers:      headers,
		},
	)
}

func (s *RabbitMQService) ConsumeEvents(queueName string, routingKeys []string, handler func(amqp.Delivery) error) error {
	return s.registerConsumer("wbot.events", queueName, routingKeys, handler)
}

// ConsumeKnowledgeEvents binds a queue to the knowledge.events exchange (with
// DLQ) and dispatches each delivery to handler. Mirrors ConsumeEvents but for
// the knowledge status stream.
func (s *RabbitMQService) ConsumeKnowledgeEvents(queueName string, routingKeys []string, handler func(amqp.Delivery) error) error {
	return s.registerConsumer("knowledge.events", queueName, routingKeys, handler)
}

// ConsumeKnowledgeJobs binds a queue to the knowledge.jobs exchange (with DLQ)
// and dispatches each delivery to handler — the native Go ingestion worker's
// entry point, replacing the watink-knowledge Python consumer. Unlike the old
// service (which never declared a DLQ on this queue), a job that keeps
// failing lands in the dead-letter queue instead of vanishing.
func (s *RabbitMQService) ConsumeKnowledgeJobs(queueName string, routingKeys []string, handler func(amqp.Delivery) error) error {
	return s.registerConsumer("knowledge.jobs", queueName, routingKeys, handler)
}

// registerConsumer records the (exchange, queue, routingKeys, handler) tuple
// so resubscribeConsumers can re-attach it after a reconnect, then starts
// consuming immediately. Without this registry, a dropped AMQP connection
// silently kills the consumer goroutine (its `range msgs` channel closes)
// while Connect()'s auto-reconnect brings the connection back healthy —
// leaving the queue with 0 consumers and an unbounded backlog with no error
// in the logs (diagnosed live in prod: api.events.process.go stuck at 22k+
// messages, WhatsApp connections stuck in OPENING forever).
func (s *RabbitMQService) registerConsumer(exchange, queueName string, routingKeys []string, handler func(amqp.Delivery) error) error {
	s.mu.Lock()
	s.consumers = append(s.consumers, consumerRegistration{
		exchange:    exchange,
		queueName:   queueName,
		routingKeys: routingKeys,
		handler:     handler,
	})
	s.mu.Unlock()

	return s.consume(exchange, queueName, routingKeys, handler)
}

func (s *RabbitMQService) consume(exchange, queueName string, routingKeys []string, handler func(amqp.Delivery) error) error {
	if err := s.declareQueueWithDLQ(queueName, exchange, routingKeys); err != nil {
		return err
	}

	msgs, err := s.channel.Consume(queueName, "", false, false, false, false, nil)
	if err != nil {
		return err
	}

	go func() {
		for d := range msgs {
			if err := handler(d); err != nil {
				s.handleFailedMessage(d, err)
			} else {
				if err := d.Ack(false); err != nil {
					log.Printf("[RabbitMQ] Ack failed: %v", err)
				}
			}
		}
		log.Printf("[RabbitMQ] Consumer loop for queue %q stopped (channel closed)", queueName)
	}()

	return nil
}

// resubscribeConsumers re-attaches every previously registered consumer to
// the freshly reconnected channel. Called by Connect()'s reconnect goroutine
// after a successful reconnect.
func (s *RabbitMQService) resubscribeConsumers() {
	s.mu.Lock()
	regs := make([]consumerRegistration, len(s.consumers))
	copy(regs, s.consumers)
	s.mu.Unlock()

	for _, reg := range regs {
		if err := s.consume(reg.exchange, reg.queueName, reg.routingKeys, reg.handler); err != nil {
			log.Printf("[RabbitMQ] Failed to resubscribe consumer for queue %q: %v", reg.queueName, err)
		} else {
			log.Printf("[RabbitMQ] Resubscribed consumer for queue %q", reg.queueName)
		}
	}
}

func (s *RabbitMQService) Close() error {
	if s.channel != nil {
		s.channel.Close()
	}
	if s.conn != nil {
		return s.conn.Close()
	}
	return nil
}
