package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
)

type rabbitMgmtQueue struct {
	Name                   string `json:"name"`
	Vhost                  string `json:"vhost"`
	Messages               int    `json:"messages"`
	MessagesReady          int    `json:"messages_ready"`
	MessagesUnacknowledged int    `json:"messages_unacknowledged"`
	Consumers              int    `json:"consumers"`
	State                  string `json:"state"`
}

func (s *RabbitMQService) IsConnected() bool {
	return s != nil && s.conn != nil && !s.conn.IsClosed()
}

func (s *RabbitMQService) InspectQueue(queueName string) domain.QueueMetrics {
	m := domain.QueueMetrics{Name: queueName}
	if !s.IsConnected() {
		m.Error = "not_connected"
		return m
	}

	ch, err := s.conn.Channel()
	if err != nil {
		m.Error = err.Error()
		return m
	}
	defer ch.Close()

	q, err := ch.QueueInspect(queueName)
	if err != nil {
		m.Error = err.Error()
		return m
	}

	m.Messages = q.Messages
	m.Ready = q.Messages
	m.Consumers = q.Consumers
	m.Unacknowledged = 0
	return m
}

func ParseQueueList(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return []string{"api.events.process.go", "flow.worker.queue"}
	}
	parts := strings.Split(raw, ",")
	queues := make([]string, 0, len(parts))
	for _, p := range parts {
		q := strings.TrimSpace(p)
		if q != "" {
			queues = append(queues, q)
		}
	}
	if len(queues) == 0 {
		queues = []string{"api.events.process.go", "flow.worker.queue"}
	}
	return queues
}

func deriveManagementURL(amqpURL string) string {
	if amqpURL == "" {
		return ""
	}
	u, err := url.Parse(amqpURL)
	if err != nil {
		return ""
	}
	host := u.Hostname()
	if host == "" {
		return ""
	}
	return fmt.Sprintf("http://%s:15672/api/queues", host)
}

func (s *RabbitMQService) listQueuesViaManagementAPI() ([]domain.QueueMetrics, error) {
	managementURL := strings.TrimSpace(os.Getenv("RABBITMQ_MANAGEMENT_URL"))
	if managementURL == "" {
		managementURL = deriveManagementURL(s.url)
	}
	if managementURL == "" {
		return nil, fmt.Errorf("management url not configured")
	}

	username := strings.TrimSpace(os.Getenv("RABBITMQ_MANAGEMENT_USER"))
	password := strings.TrimSpace(os.Getenv("RABBITMQ_MANAGEMENT_PASS"))

	if username == "" || password == "" {
		if parsed, err := url.Parse(s.url); err == nil && parsed.User != nil {
			username = parsed.User.Username()
			if p, ok := parsed.User.Password(); ok {
				password = p
			}
		}
	}

	req, err := http.NewRequest(http.MethodGet, managementURL, nil)
	if err != nil {
		return nil, err
	}
	if username != "" {
		req.SetBasicAuth(username, password)
	}

	client := &http.Client{Timeout: 4 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("management api returned %d", resp.StatusCode)
	}

	var raw []rabbitMgmtQueue
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}

	queues := make([]domain.QueueMetrics, 0, len(raw))
	for _, q := range raw {
		queues = append(queues, domain.QueueMetrics{
			Name:           q.Name,
			Vhost:          q.Vhost,
			Messages:       q.Messages,
			Ready:          q.MessagesReady,
			Unacknowledged: q.MessagesUnacknowledged,
			Consumers:      q.Consumers,
			State:          q.State,
		})
	}

	sort.Slice(queues, func(i, j int) bool {
		if queues[i].Messages == queues[j].Messages {
			return queues[i].Name < queues[j].Name
		}
		return queues[i].Messages > queues[j].Messages
	})

	return queues, nil
}

func (s *RabbitMQService) ListAllQueues() ([]domain.QueueMetrics, error) {
	if s == nil {
		return nil, fmt.Errorf("rabbitmq not initialized")
	}

	if queues, err := s.listQueuesViaManagementAPI(); err == nil && len(queues) > 0 {
		return queues, nil
	}

	fallback := ParseQueueList(os.Getenv("MONITOR_RABBIT_QUEUES"))
	out := make([]domain.QueueMetrics, 0, len(fallback))
	for _, q := range fallback {
		out = append(out, s.InspectQueue(q))
	}
	return out, nil
}
