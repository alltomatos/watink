package plugins

import (
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/stretchr/testify/assert"
)

func TestTagMatches_Contains(t *testing.T) {
	tag := models.GroupWatchTag{Phrase: "ajuda", MatchMode: models.GroupWatchMatchContains}
	assert.True(t, tagMatches(tag, "preciso de ajuda urgente"))
	assert.True(t, tagMatches(tag, "ajudante"))
	assert.False(t, tagMatches(tag, "sem relação"))
}

func TestTagMatches_Exact(t *testing.T) {
	tag := models.GroupWatchTag{Phrase: "ajuda", MatchMode: models.GroupWatchMatchExact}
	assert.True(t, tagMatches(tag, "ajuda"))
	assert.False(t, tagMatches(tag, "preciso de ajuda"))
	assert.False(t, tagMatches(tag, "ajudante"))
}

func TestTagMatches_ExactIsCaseAndWhitespaceInsensitive(t *testing.T) {
	tag := models.GroupWatchTag{Phrase: "  Ajuda  ", MatchMode: models.GroupWatchMatchExact}
	// bodyLower is already lowercased/trimmed by the caller (handleGroupWatchMessage);
	// tagMatches must trim/lower the phrase itself the same way.
	assert.True(t, tagMatches(tag, "ajuda"))
}

func TestTagMatches_EmptyMatchModeFallsBackToContains(t *testing.T) {
	// Rows created before MatchMode existed have "" — must not silently
	// stop matching (that would be a breaking migration, not additive).
	tag := models.GroupWatchTag{Phrase: "ajuda", MatchMode: ""}
	assert.True(t, tagMatches(tag, "preciso de ajuda"))
}
