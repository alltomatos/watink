package knowledge

import (
	"regexp"
	"strings"
)

const (
	// chunkMaxChars approximates a token budget without an exact tokenizer
	// (~4 chars/token, so ~2000 chars ≈ 500 tokens — the real ceiling is the
	// embedding provider's limit, not a rigid business rule, so the
	// approximation is acceptable; see the ADR for this tradeoff).
	chunkMaxChars     = 2000
	chunkOverlapChars = 300 // ~15% of chunkMaxChars
)

var headingRe = regexp.MustCompile(`(?m)^(#{1,6})\s+(.+)$`)

// Chunk is one piece of a document ready for embedding, carrying enough
// metadata (heading/ordinal) to build a better citation than "fonte N" — the
// only thing the old chunk-by-tokens pipeline could offer.
type Chunk struct {
	Text    string
	Heading string
	Ordinal int
}

// ChunkText splits text into structural chunks: it walks markdown headings
// (# / ##) to find section boundaries, then splits each section into
// paragraphs (blank-line separated). Consecutive paragraphs are packed into a
// chunk up to chunkMaxChars; a chunk that would exceed it is closed and a new
// one started with the previous chunk's last paragraph repeated at the front
// (the overlap), so context isn't lost at the boundary. This replaces the old
// blind token-window chunker, which had no notion of sentence/paragraph
// boundaries and could cut mid-sentence.
func ChunkText(text string, sourceURL string) []Chunk {
	sections := splitByHeading(text)

	var chunks []Chunk
	ordinal := 0
	for _, sec := range sections {
		paragraphs := splitParagraphs(sec.body)
		for _, chunkText := range packParagraphs(paragraphs, chunkMaxChars, chunkOverlapChars) {
			if strings.TrimSpace(chunkText) == "" {
				continue
			}
			chunks = append(chunks, Chunk{
				Text:    chunkText,
				Heading: sec.heading,
				Ordinal: ordinal,
			})
			ordinal++
		}
	}
	return chunks
}

type section struct {
	heading string
	body    string
}

// splitByHeading breaks text at markdown headings. Content before the first
// heading (or all of it, if there are none) becomes a section with an empty
// heading.
func splitByHeading(text string) []section {
	matches := headingRe.FindAllStringSubmatchIndex(text, -1)
	if len(matches) == 0 {
		return []section{{heading: "", body: text}}
	}

	var sections []section
	if matches[0][0] > 0 {
		sections = append(sections, section{heading: "", body: text[:matches[0][0]]})
	}
	for i, m := range matches {
		heading := text[m[4]:m[5]]
		bodyStart := m[1]
		bodyEnd := len(text)
		if i+1 < len(matches) {
			bodyEnd = matches[i+1][0]
		}
		sections = append(sections, section{heading: strings.TrimSpace(heading), body: text[bodyStart:bodyEnd]})
	}
	return sections
}

func splitParagraphs(text string) []string {
	raw := regexp.MustCompile(`\n\s*\n`).Split(strings.TrimSpace(text), -1)
	paragraphs := make([]string, 0, len(raw))
	for _, p := range raw {
		t := strings.TrimSpace(p)
		if t == "" {
			continue
		}
		// A "paragraph" here is blank-line-delimited text — for content with
		// no blank lines at all (a minified JSON blob, a single huge line of
		// markup, a raw API spec), the whole document is ONE paragraph.
		// Without this hard split, packParagraphs below has nothing to flush
		// on (its size check only fires between paragraphs) and would emit
		// one arbitrarily large chunk — observed in production hitting a
		// real embedding provider's token ceiling on an OpenAPI JSON source.
		paragraphs = append(paragraphs, splitOversized(t, chunkMaxChars)...)
	}
	return paragraphs
}

// splitOversized hard-splits text longer than maxChars into maxChars-sized
// pieces, breaking at the last whitespace before the limit when one exists
// (avoids cutting mid-word for prose) and falling back to a hard cut
// otherwise (JSON/minified content has no whitespace to break on).
func splitOversized(text string, maxChars int) []string {
	if len(text) <= maxChars {
		return []string{text}
	}

	var pieces []string
	for len(text) > maxChars {
		cut := maxChars
		if i := strings.LastIndexAny(text[:maxChars], " \t\n"); i > maxChars/2 {
			cut = i
		}
		pieces = append(pieces, strings.TrimSpace(text[:cut]))
		text = strings.TrimSpace(text[cut:])
	}
	if text != "" {
		pieces = append(pieces, text)
	}
	return pieces
}

// packParagraphs greedily packs paragraphs into chunks up to maxChars,
// carrying the last paragraph of each chunk into the start of the next
// (overlap) whenever it fits within overlapChars.
func packParagraphs(paragraphs []string, maxChars, overlapChars int) []string {
	if len(paragraphs) == 0 {
		return nil
	}

	var chunks []string
	var current strings.Builder
	var lastParagraph string

	flush := func() {
		if current.Len() > 0 {
			chunks = append(chunks, current.String())
		}
		current.Reset()
	}

	for _, p := range paragraphs {
		candidateLen := current.Len() + len(p) + 2
		if current.Len() > 0 && candidateLen > maxChars {
			flush()
			if lastParagraph != "" && len(lastParagraph) <= overlapChars {
				current.WriteString(lastParagraph)
				current.WriteString("\n\n")
			}
		}
		current.WriteString(p)
		current.WriteString("\n\n")
		lastParagraph = p
	}
	flush()

	return chunks
}
