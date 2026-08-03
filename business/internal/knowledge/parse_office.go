package knowledge

import (
	"archive/zip"
	"bytes"
	"encoding/csv"
	"encoding/xml"
	"fmt"
	"io"
	"strings"

	"github.com/xuri/excelize/v2"
)

// docxDocument mirrors the subset of word/document.xml this parser reads:
// paragraphs (<w:p>) made of runs (<w:r><w:t>) and table cells (<w:tbl>).
// Reading the raw XML (stdlib archive/zip + encoding/xml) instead of a
// third-party DOCX library keeps this dependency-free and — unlike the old
// Python parser, which only walked paragraphs — captures table content too.
type docxBody struct {
	XMLName xml.Name    `xml:"document"`
	Body    docxBodyTag `xml:"body"`
}

type docxBodyTag struct {
	Paragraphs []docxParagraph `xml:"p"`
	Tables     []docxTable     `xml:"tbl"`
}

type docxParagraph struct {
	Runs []docxRun `xml:"r"`
}

type docxRun struct {
	Text string `xml:"t"`
}

type docxTable struct {
	Rows []docxTableRow `xml:"tr"`
}

type docxTableRow struct {
	Cells []docxTableCell `xml:"tc"`
}

type docxTableCell struct {
	Paragraphs []docxParagraph `xml:"p"`
}

func (p docxParagraph) text() string {
	var b strings.Builder
	for _, r := range p.Runs {
		b.WriteString(r.Text)
	}
	return b.String()
}

// ParseDOCX extracts paragraphs and table content from a .docx file's
// word/document.xml.
func ParseDOCX(data []byte) (string, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("open docx: %w", err)
	}

	var docXML []byte
	for _, f := range zr.File {
		if f.Name != "word/document.xml" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return "", fmt.Errorf("open document.xml: %w", err)
		}
		docXML, err = io.ReadAll(rc)
		_ = rc.Close()
		if err != nil {
			return "", fmt.Errorf("read document.xml: %w", err)
		}
		break
	}
	if docXML == nil {
		return "", fmt.Errorf("ERR_INVALID_DOCX: word/document.xml not found")
	}

	var body docxBody
	if err := xml.Unmarshal(docXML, &body); err != nil {
		return "", fmt.Errorf("parse document.xml: %w", err)
	}

	var b strings.Builder
	for _, p := range body.Body.Paragraphs {
		if t := strings.TrimSpace(p.text()); t != "" {
			b.WriteString(t)
			b.WriteString("\n\n")
		}
	}
	for _, tbl := range body.Body.Tables {
		for _, row := range tbl.Rows {
			cells := make([]string, 0, len(row.Cells))
			for _, cell := range row.Cells {
				var cellText strings.Builder
				for _, p := range cell.Paragraphs {
					cellText.WriteString(p.text())
				}
				cells = append(cells, strings.TrimSpace(cellText.String()))
			}
			b.WriteString(strings.Join(cells, " | "))
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}

	text := strings.TrimSpace(b.String())
	if text == "" {
		return "", fmt.Errorf("ERR_EMPTY_DOCX_TEXT: documento sem texto extraível")
	}
	return text, nil
}

// ParseXLSX extracts every sheet's rows as tab-separated text, sheet name as a
// heading (consumed by the structural chunker as a section boundary).
func ParseXLSX(data []byte) (string, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("open xlsx: %w", err)
	}
	defer func() { _ = f.Close() }()

	var b strings.Builder
	for _, sheet := range f.GetSheetList() {
		rows, err := f.GetRows(sheet)
		if err != nil {
			continue
		}
		if len(rows) == 0 {
			continue
		}
		b.WriteString("# " + sheet + "\n\n")
		for _, row := range rows {
			b.WriteString(strings.Join(row, "\t"))
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}

	text := strings.TrimSpace(b.String())
	if text == "" {
		return "", fmt.Errorf("ERR_EMPTY_XLSX_TEXT: planilha sem conteúdo")
	}
	return text, nil
}

// ParseCSV renders rows as tab-separated text (comma is the CSV delimiter;
// tabs in the output avoid ambiguity with values that contain commas).
func ParseCSV(data []byte) (string, error) {
	r := csv.NewReader(bytes.NewReader(data))
	r.FieldsPerRecord = -1 // tolerate ragged rows rather than failing the whole file

	var b strings.Builder
	for {
		record, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("parse csv: %w", err)
		}
		b.WriteString(strings.Join(record, "\t"))
		b.WriteString("\n")
	}

	text := strings.TrimSpace(b.String())
	if text == "" {
		return "", fmt.Errorf("ERR_EMPTY_CSV_TEXT: arquivo sem conteúdo")
	}
	return text, nil
}

// ParseText returns plain text/markdown content as-is (UTF-8 assumed).
func ParseText(data []byte) (string, error) {
	text := strings.TrimSpace(string(data))
	if text == "" {
		return "", fmt.Errorf("ERR_EMPTY_TEXT: arquivo vazio")
	}
	return text, nil
}
