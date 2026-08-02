package knowledge

import (
	"bytes"
	"fmt"
	"io"
	"strings"

	"github.com/ledongthuc/pdf"
)

// ParsePDF extracts text from a PDF, pure Go (no shell-out to pdftotext/poppler
// — the business image is gcr.io/distroless/static-debian12, no shell, no
// package manager). Known limitation, accepted for v1: no OCR, so a scanned
// PDF (image-only, no text layer) returns ERR_EMPTY_PDF_TEXT rather than
// silently succeeding with an empty document — the old service would happily
// mark such a source "ready" with 0 useful chunks.
func ParsePDF(data []byte) (string, error) {
	reader, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("open pdf: %w", err)
	}

	textReader, err := reader.GetPlainText()
	if err != nil {
		return "", fmt.Errorf("extract text: %w", err)
	}

	raw, err := io.ReadAll(textReader)
	if err != nil {
		return "", fmt.Errorf("read text: %w", err)
	}

	text := strings.TrimSpace(string(raw))
	if text == "" {
		return "", fmt.Errorf("ERR_EMPTY_PDF_TEXT: sem camada de texto (PDF escaneado?) — OCR não suportado ainda")
	}
	return text, nil
}
