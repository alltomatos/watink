package knowledge

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"golang.org/x/net/html"
)

const (
	crawlMaxPages = 30
	crawlMaxDepth = 2
)

// CrawlOptions bounds a same-domain crawl. Zero values fall back to the
// conservative defaults (crawlMaxPages/crawlMaxDepth) — a v1 improvement over
// the current system, which only ever indexes the exact page a user pastes.
type CrawlOptions struct {
	MaxPages int
	MaxDepth int
}

// CrawlSite fetches a starting URL plus same-domain pages reachable from it
// (via sitemap.xml when available, otherwise a same-domain BFS over <a href>
// links), up to MaxPages/MaxDepth. A page that fails to fetch is skipped, not
// fatal — one bad link should never abort the rest of the crawl (the isolated-
// per-document failure principle carried over from the ingestion pipeline).
func CrawlSite(ctx context.Context, startURL string, opts CrawlOptions) ([]Document, error) {
	if opts.MaxPages <= 0 {
		opts.MaxPages = crawlMaxPages
	}
	if opts.MaxDepth <= 0 {
		opts.MaxDepth = crawlMaxDepth
	}

	start, err := url.Parse(strings.TrimSpace(startURL))
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	urls := sitemapURLs(ctx, start)
	if len(urls) > 0 {
		if len(urls) > opts.MaxPages {
			urls = urls[:opts.MaxPages]
		}
		return fetchAll(ctx, urls), nil
	}

	return bfsCrawl(ctx, start, opts), nil
}

// fetchAll fetches every URL, dropping ones that fail (isolated failure).
func fetchAll(ctx context.Context, urls []string) []Document {
	docs := make([]Document, 0, len(urls))
	for _, u := range urls {
		doc, err := FetchURL(ctx, u)
		if err != nil {
			continue
		}
		docs = append(docs, doc)
	}
	return docs
}

// bfsCrawl walks same-domain <a href> links breadth-first from start.
func bfsCrawl(ctx context.Context, start *url.URL, opts CrawlOptions) []Document {
	type queueItem struct {
		u     *url.URL
		depth int
	}

	seen := map[string]bool{start.String(): true}
	queue := []queueItem{{u: start, depth: 0}}
	var docs []Document

	for len(queue) > 0 && len(docs) < opts.MaxPages {
		item := queue[0]
		queue = queue[1:]

		doc, links, err := fetchAndExtractLinks(ctx, item.u)
		if err != nil {
			continue
		}
		docs = append(docs, doc)

		if item.depth >= opts.MaxDepth {
			continue
		}
		for _, link := range links {
			if len(docs)+len(queue) >= opts.MaxPages {
				break
			}
			if !sameHost(start, link) || seen[link.String()] {
				continue
			}
			seen[link.String()] = true
			queue = append(queue, queueItem{u: link, depth: item.depth + 1})
		}
	}
	return docs
}

// fetchAndExtractLinks fetches a page for its readable content AND parses the
// raw HTML a second time for same-domain links to continue the BFS. Two fetches
// per page is accepted simplicity for v1 — readability.FromReader consumes the
// html.Node tree internally and doesn't expose raw <a> hrefs.
func fetchAndExtractLinks(ctx context.Context, u *url.URL) (Document, []*url.URL, error) {
	doc, err := FetchURL(ctx, u.String())
	if err != nil {
		return Document{}, nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return doc, nil, nil
	}
	client := &http.Client{Timeout: fetchTimeout, Transport: &http.Transport{DialContext: dialContextFunc}}
	resp, err := client.Do(req)
	if err != nil {
		return doc, nil, nil
	}
	defer func() { _ = resp.Body.Close() }()

	node, err := html.Parse(io.LimitReader(resp.Body, fetchMaxBody))
	if err != nil {
		return doc, nil, nil
	}

	return doc, extractLinks(node, u), nil
}

func extractLinks(n *html.Node, base *url.URL) []*url.URL {
	var links []*url.URL
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "a" {
			for _, attr := range n.Attr {
				if attr.Key != "href" {
					continue
				}
				ref, err := url.Parse(attr.Val)
				if err != nil {
					continue
				}
				links = append(links, base.ResolveReference(ref))
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(n)
	return links
}

func sameHost(a, b *url.URL) bool {
	return strings.EqualFold(a.Hostname(), b.Hostname()) && (b.Scheme == "http" || b.Scheme == "https")
}

// sitemapURLs tries {scheme}://{host}/sitemap.xml and returns the <loc> entries
// found, or nil if the sitemap doesn't exist/parse (falls back to BFS).
func sitemapURLs(ctx context.Context, start *url.URL) []string {
	sitemapURL := fmt.Sprintf("%s://%s/sitemap.xml", start.Scheme, start.Host)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sitemapURL, nil)
	if err != nil {
		return nil
	}
	client := &http.Client{Timeout: fetchTimeout, Transport: &http.Transport{DialContext: dialContextFunc}}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			_ = resp.Body.Close()
		}
		return nil
	}
	defer func() { _ = resp.Body.Close() }()

	var parsed struct {
		URLs []struct {
			Loc string `xml:"loc"`
		} `xml:"url"`
	}
	if err := xml.NewDecoder(io.LimitReader(resp.Body, fetchMaxBody)).Decode(&parsed); err != nil {
		return nil
	}

	urls := make([]string, 0, len(parsed.URLs))
	for _, u := range parsed.URLs {
		if u.Loc != "" {
			urls = append(urls, u.Loc)
		}
	}
	return urls
}
