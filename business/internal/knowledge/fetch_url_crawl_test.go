package knowledge

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// pageWithLink builds a page long enough to pass minExtractedLen, linking to
// the given path.
func pageWithLink(path string) string {
	body := "<html><head><title>P</title></head><body><article><h1>P</h1>"
	for i := 0; i < 40; i++ {
		body += "<p>Conteúdo de teste repetido para passar do limite mínimo de extração configurado.</p>"
	}
	if path != "" {
		body += fmt.Sprintf(`<a href="%s">next</a>`, path)
	}
	body += "</article></body></html>"
	return body
}

func TestCrawlSite_BFS_SameDomain(t *testing.T) {
	withPlainDialer(t)
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pageWithLink("/page2")))
	})
	mux.HandleFunc("/page2", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pageWithLink("")))
	})
	mux.HandleFunc("/sitemap.xml", http.NotFound)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	docs, err := CrawlSite(context.Background(), srv.URL+"/", CrawlOptions{MaxPages: 5, MaxDepth: 2})
	require.NoError(t, err)
	assert.Len(t, docs, 2)
}

func TestCrawlSite_RespectsMaxPages(t *testing.T) {
	withPlainDialer(t)
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pageWithLink("/page2")))
	})
	mux.HandleFunc("/page2", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pageWithLink("/page3")))
	})
	mux.HandleFunc("/page3", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pageWithLink("")))
	})
	mux.HandleFunc("/sitemap.xml", http.NotFound)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	docs, err := CrawlSite(context.Background(), srv.URL+"/", CrawlOptions{MaxPages: 1, MaxDepth: 2})
	require.NoError(t, err)
	assert.Len(t, docs, 1)
}

func TestCrawlSite_UsesSitemapWhenPresent(t *testing.T) {
	withPlainDialer(t)
	mux := http.NewServeMux()
	var sitemapXML string
	mux.HandleFunc("/sitemap.xml", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		_, _ = w.Write([]byte(sitemapXML))
	})
	mux.HandleFunc("/a", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pageWithLink("")))
	})
	mux.HandleFunc("/b", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pageWithLink("")))
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	sitemapXML = fmt.Sprintf(`<?xml version="1.0"?><urlset><url><loc>%s/a</loc></url><url><loc>%s/b</loc></url></urlset>`, srv.URL, srv.URL)

	docs, err := CrawlSite(context.Background(), srv.URL+"/", CrawlOptions{MaxPages: 5, MaxDepth: 2})
	require.NoError(t, err)
	assert.Len(t, docs, 2)
}
