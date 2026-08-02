package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/streadway/amqp"
	"go.opentelemetry.io/otel"
)

type RabbitMQService struct {
	conn    *amqp.Connection
	channel *amqp.Channel
	url     string
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
		time.Sleep(5 * time.Second)
		s.Connect()
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
	if err := s.declareQueueWithDLQ(queueName, "wbot.events", routingKeys); err != nil {
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
	}()

	return nil
}

// ConsumeKnowledgeEvents binds a queue to the knowledge.events exchange (with
// DLQ) and dispatches each delivery to handler. Mirrors ConsumeEvents but for
// the knowledge status stream.
func (s *RabbitMQService) ConsumeKnowledgeEvents(queueName string, routingKeys []string, handler func(amqp.Delivery) error) error {
	if err := s.declareQueueWithDLQ(queueName, "knowledge.events", routingKeys); err != nil {
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
	}()

	return nil
}

// ConsumeKnowledgeJobs binds a queue to the knowledge.jobs exchange (with DLQ)
// and dispatches each delivery to handler — the native Go ingestion worker's
// entry point, replacing the watink-knowledge Python consumer. Unlike the old
// service (which never declared a DLQ on this queue), a job that keeps
// failing lands in the dead-letter queue instead of vanishing.
func (s *RabbitMQService) ConsumeKnowledgeJobs(queueName string, routingKeys []string, handler func(amqp.Delivery) error) error {
	if err := s.declareQueueWithDLQ(queueName, "knowledge.jobs", routingKeys); err != nil {
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
	}()

	return nil
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
