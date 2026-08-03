package knowledge

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// buildMinimalPDF assembles a syntactically valid single-page PDF with the
// given text in its content stream, computing correct xref byte offsets
// programmatically (hand-computed offsets are fragile and easy to get wrong).
func buildMinimalPDF(t *testing.T, text string) []byte {
	t.Helper()

	stream := fmt.Sprintf("BT /F1 24 Tf 20 100 Td (%s) Tj ET", text)
	objs := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 200 200] /Contents 5 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(stream), stream),
	}

	var b strings.Builder
	b.WriteString("%PDF-1.4\n")
	offsets := make([]int, len(objs)+1) // 1-indexed, offsets[0] unused
	for i, obj := range objs {
		offsets[i+1] = b.Len()
		fmt.Fprintf(&b, "%d 0 obj\n%s\nendobj\n", i+1, obj)
	}

	xrefStart := b.Len()
	fmt.Fprintf(&b, "xref\n0 %d\n0000000000 65535 f \n", len(objs)+1)
	for i := 1; i <= len(objs); i++ {
		fmt.Fprintf(&b, "%010d 00000 n \n", offsets[i])
	}
	fmt.Fprintf(&b, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF", len(objs)+1, xrefStart)

	return []byte(b.String())
}

func TestParsePDF_ExtractsText(t *testing.T) {
	data := buildMinimalPDF(t, "Ola RAG")
	text, err := ParsePDF(data)
	require.NoError(t, err)
	assert.Contains(t, text, "Ola RAG")
}

func TestParsePDF_InvalidDataFails(t *testing.T) {
	_, err := ParsePDF([]byte("not a pdf"))
	assert.Error(t, err)
}
