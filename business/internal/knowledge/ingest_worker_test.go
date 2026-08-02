package knowledge

import (
	"testing"

	"github.com/streadway/amqp"
	"github.com/stretchr/testify/assert"
)

// fakeJobQueue records what it was asked to consume/publish; ConsumeKnowledgeJobs
// is a no-op (tests call handleDelivery directly, bypassing the real AMQP loop).
type fakeJobQueue struct {
	published []struct {
		routingKey string
		payload    interface{}
	}
}

func (f *fakeJobQueue) ConsumeKnowledgeJobs(_ string, _ []string, _ func(amqp.Delivery) error) error {
	return nil
}

func (f *fakeJobQueue) PublishKnowledgeEvent(routingKey string, payload interface{}) error {
	f.published = append(f.published, struct {
		routingKey string
		payload    interface{}
	}{routingKey, payload})
	return nil
}

func TestHandleDelivery_RejectsMalformedJSON(t *testing.T) {
	w := NewIngestWorker(nil, &fakeJobQueue{}, nil)
	err := w.handleDelivery(amqp.Delivery{RoutingKey: "knowledge.abc.ingest", Body: []byte("{not json")})
	assert.Error(t, err)
}

func TestHandleDelivery_RejectsBadRoutingKeyShape(t *testing.T) {
	w := NewIngestWorker(nil, &fakeJobQueue{}, nil)
	body := []byte(`{"tenantId":"t1","sourceId":1,"type":"text","payload":{"text":"oi"}}`)
	err := w.handleDelivery(amqp.Delivery{RoutingKey: "knowledge.ingest", Body: body})
	assert.Error(t, err)
}

func TestHandleDelivery_RejectsTenantMismatch(t *testing.T) {
	w := NewIngestWorker(nil, &fakeJobQueue{}, nil)
	// Routing key says tenant "attacker", body claims tenant "victim" — the
	// routing key must win (it's set by the trusted publisher, the body isn't).
	body := []byte(`{"tenantId":"victim","sourceId":1,"type":"text","payload":{"text":"oi"}}`)
	err := w.handleDelivery(amqp.Delivery{RoutingKey: "knowledge.attacker.ingest", Body: body})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "tenant mismatch")
}

func TestHandleDelivery_RejectsInvalidTenantUUID(t *testing.T) {
	w := NewIngestWorker(nil, &fakeJobQueue{}, nil)
	body := []byte(`{"tenantId":"not-a-uuid","sourceId":1,"type":"text","payload":{"text":"oi"}}`)
	err := w.handleDelivery(amqp.Delivery{RoutingKey: "knowledge.not-a-uuid.ingest", Body: body})
	assert.Error(t, err)
}

func TestFileExt(t *testing.T) {
	assert.Equal(t, "pdf", fileExt("relatorio.pdf"))
	assert.Equal(t, "docx", fileExt("a.b.docx"))
	assert.Equal(t, "", fileExt("no-extension"))
	assert.Equal(t, "", fileExt("trailing."))
}

func TestContentHash_StableAndSensitive(t *testing.T) {
	h1 := contentHash("mesmo texto")
	h2 := contentHash("mesmo texto")
	h3 := contentHash("texto diferente")
	assert.Equal(t, h1, h2)
	assert.NotEqual(t, h1, h3)
}
