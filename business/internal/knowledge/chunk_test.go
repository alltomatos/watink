package knowledge

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChunkText_RespectsHeadings(t *testing.T) {
	text := "# Seção A\n\nParágrafo A1.\n\nParágrafo A2.\n\n# Seção B\n\nParágrafo B1."
	chunks := ChunkText(text, "")
	require.NotEmpty(t, chunks)

	var headings []string
	for _, c := range chunks {
		headings = append(headings, c.Heading)
	}
	assert.Contains(t, headings, "Seção A")
	assert.Contains(t, headings, "Seção B")
}

func TestChunkText_FallsBackToParagraphsWithoutHeadings(t *testing.T) {
	text := "Parágrafo único sem heading nenhum."
	chunks := ChunkText(text, "")
	require.Len(t, chunks, 1)
	assert.Equal(t, "", chunks[0].Heading)
	assert.Contains(t, chunks[0].Text, "Parágrafo único")
}

func TestChunkText_SplitsLongSectionAndOverlaps(t *testing.T) {
	// Build enough paragraphs to force at least 2 chunks under chunkMaxChars.
	var paras []string
	for i := 0; i < 20; i++ {
		paras = append(paras, strings.Repeat("palavra ", 20))
	}
	text := strings.Join(paras, "\n\n")

	chunks := ChunkText(text, "")
	require.Greater(t, len(chunks), 1)

	// Ordinals are sequential starting at 0.
	for i, c := range chunks {
		assert.Equal(t, i, c.Ordinal)
	}
}

func TestChunkText_EmptyInput(t *testing.T) {
	chunks := ChunkText("", "")
	assert.Empty(t, chunks)
}
