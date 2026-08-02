package knowledge

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestVectorLiteral(t *testing.T) {
	got := vectorLiteral([]float32{0.1, -0.2, 1})
	assert.Equal(t, "[0.1,-0.2,1]", got)
}

func TestVectorLiteral_Empty(t *testing.T) {
	assert.Equal(t, "[]", vectorLiteral(nil))
}

// A nil *gorm.DB means tenantEmbedConfig can never find a config — Retrieve
// must fail fast with a clear error instead of panicking on a nil DB.
func TestPgVectorRetriever_NoEmbeddingConfig(t *testing.T) {
	r := NewPgVectorRetriever(nil)
	_, err := r.Retrieve(context.Background(), uuid.New(), 1, 6, 0.2, "oi")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "ERR_NO_EMBEDDING_CONFIG")
}

// clampTopK must never let an externally-supplied topK (POST /query, flow
// nodes) drive an unbounded slice/LIMIT allocation.
func TestClampTopK(t *testing.T) {
	assert.Equal(t, 6, clampTopK(0))
	assert.Equal(t, 6, clampTopK(-1))
	assert.Equal(t, 6, clampTopK(-1000000))
	assert.Equal(t, 10, clampTopK(10))
	assert.Equal(t, maxTopK, clampTopK(maxTopK))
	assert.Equal(t, maxTopK, clampTopK(maxTopK+1))
	assert.Equal(t, maxTopK, clampTopK(1<<30))
}
