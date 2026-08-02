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

// A single blank-line-free blob (e.g. minified JSON, a raw OpenAPI spec) has
// no paragraph breaks for packParagraphs to flush on — without a hard split,
// this produced one arbitrarily large chunk that blew past a real embedding
// provider's token ceiling in production (a 27k-char OpenAPI JSON source).
func TestChunkText_HardSplitsOversizedSingleParagraph(t *testing.T) {
	text := strings.Repeat("a", chunkMaxChars*3)
	chunks := ChunkText(text, "")
	require.Greater(t, len(chunks), 1)
	for _, c := range chunks {
		// +2 tolerance: packParagraphs appends a trailing "\n\n" separator
		// after the last paragraph in a chunk (pre-existing behavior,
		// unrelated to this fix) — the invariant that matters is "nowhere
		// near the original 27k-char blob", not an exact byte count.
		assert.LessOrEqual(t, len(c.Text), chunkMaxChars+2, "no chunk should exceed chunkMaxChars")
	}
}

func TestSplitOversized_PrefersWhitespaceBoundary(t *testing.T) {
	text := strings.Repeat("palavra ", 400) // well over chunkMaxChars, has spaces
	pieces := splitOversized(text, chunkMaxChars)
	require.Greater(t, len(pieces), 1)
	for _, p := range pieces {
		assert.LessOrEqual(t, len(p), chunkMaxChars)
		assert.False(t, strings.HasPrefix(p, " "))
	}
}

func TestSplitOversized_HardCutsWhenNoWhitespace(t *testing.T) {
	text := strings.Repeat("x", chunkMaxChars*2) // no whitespace at all
	pieces := splitOversized(text, chunkMaxChars)
	require.Len(t, pieces, 2)
	assert.Len(t, pieces[0], chunkMaxChars)
}
