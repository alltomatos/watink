package knowledge

import (
	"archive/zip"
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"
)

func buildMinimalDocx(t *testing.T, documentXML string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, err := zw.Create("word/document.xml")
	require.NoError(t, err)
	_, err = w.Write([]byte(documentXML))
	require.NoError(t, err)
	require.NoError(t, zw.Close())
	return buf.Bytes()
}

func TestParseDOCX_ParagraphsAndTable(t *testing.T) {
	xmlBody := `<?xml version="1.0"?>
<document>
  <body>
    <p><r><t>Primeiro parágrafo.</t></r></p>
    <tbl>
      <tr><tc><p><r><t>Cel1</t></r></p></tc><tc><p><r><t>Cel2</t></r></p></tc></tr>
    </tbl>
  </body>
</document>`
	data := buildMinimalDocx(t, xmlBody)

	text, err := ParseDOCX(data)
	require.NoError(t, err)
	assert.Contains(t, text, "Primeiro parágrafo.")
	assert.Contains(t, text, "Cel1 | Cel2")
}

func TestParseDOCX_EmptyFails(t *testing.T) {
	data := buildMinimalDocx(t, `<?xml version="1.0"?><document><body></body></document>`)
	_, err := ParseDOCX(data)
	assert.Error(t, err)
}

func TestParseXLSX_RowsBySheet(t *testing.T) {
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()
	_ = f.SetCellValue("Sheet1", "A1", "Nome")
	_ = f.SetCellValue("Sheet1", "B1", "Preço")
	_ = f.SetCellValue("Sheet1", "A2", "Produto X")
	_ = f.SetCellValue("Sheet1", "B2", "10.00")

	var buf bytes.Buffer
	require.NoError(t, f.Write(&buf))

	text, err := ParseXLSX(buf.Bytes())
	require.NoError(t, err)
	assert.Contains(t, text, "Sheet1")
	assert.Contains(t, text, "Produto X")
}

func TestParseCSV_RaggedRowsTolerated(t *testing.T) {
	text, err := ParseCSV([]byte("a,b,c\n1,2\n"))
	require.NoError(t, err)
	assert.Contains(t, text, "a\tb\tc")
	assert.Contains(t, text, "1\t2")
}

func TestParseCSV_EmptyFails(t *testing.T) {
	_, err := ParseCSV([]byte(""))
	assert.Error(t, err)
}

func TestParseText_TrimsAndFailsOnEmpty(t *testing.T) {
	text, err := ParseText([]byte("  olá mundo  "))
	require.NoError(t, err)
	assert.Equal(t, "olá mundo", text)

	_, err = ParseText([]byte("   "))
	assert.Error(t, err)
}
