package knowledge

import (
	"context"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	readability "codeberg.org/readeck/go-readability/v2"
)

// Document is a fetched/extracted piece of content, ready for chunking.
type Document struct {
	URL   string
	Title string
	Text  string
}

const (
	fetchTimeout    = 30 * time.Second
	fetchMaxTries   = 3
	fetchMaxBody    = 20 << 20 // 20MB cap — a scraped HTML page has no business being bigger
	minExtractedLen = 200      // below this, treat as "site needs JS" rather than index near-empty content
)

// FetchURL retrieves a page and extracts its main content via readability,
// stripping nav/boilerplate — replacing the Firecrawl dependency (5 containers,
// zero retry, 60s timeout) with a native HTTP client that retries transient
// failures with exponential backoff.
//
// Every request is validated against SSRF before dialing (see safeDialContext):
// only http/https, and the resolved IP must not be private/loopback/link-local/
// cloud-metadata. This is a real gap in the current system — URL sources are
// accepted with no host validation at all today.
func FetchURL(ctx context.Context, rawURL string) (Document, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return Document{}, fmt.Errorf("invalid URL: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return Document{}, fmt.Errorf("ERR_UNSUPPORTED_SCHEME: only http/https allowed")
	}

	client := &http.Client{
		Timeout: fetchTimeout,
		Transport: &http.Transport{
			DialContext: dialContextFunc,
		},
		// Redirects go through the same safe dialer via DialContext, but a
		// redirect chain to a private host would only be caught at connect
		// time — good enough since the guard runs on every dial, including
		// ones triggered by redirects.
	}

	var lastErr error
	for attempt := 0; attempt < fetchMaxTries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			jitter := time.Duration(rand.Int63n(int64(backoff / 2)))
			select {
			case <-ctx.Done():
				return Document{}, ctx.Err()
			case <-time.After(backoff + jitter):
			}
		}

		doc, retryable, err := fetchOnce(ctx, client, parsed)
		if err == nil {
			return doc, nil
		}
		lastErr = err
		if !retryable {
			return Document{}, err
		}
	}
	return Document{}, fmt.Errorf("ERR_FETCH_FAILED after %d attempts: %w", fetchMaxTries, lastErr)
}

func fetchOnce(ctx context.Context, client *http.Client, target *url.URL) (doc Document, retryable bool, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return Document{}, false, err
	}
	req.Header.Set("User-Agent", "WatinkBot/1.0 (+https://watink.com/bot)")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")

	resp, err := client.Do(req)
	if err != nil {
		return Document{}, true, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
		return Document{}, true, fmt.Errorf("status %d", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		return Document{}, false, fmt.Errorf("status %d", resp.StatusCode)
	}

	body := io.LimitReader(resp.Body, fetchMaxBody)
	article, err := readability.FromReader(body, target)
	if err != nil {
		return Document{}, false, fmt.Errorf("extract: %w", err)
	}

	var textBuf strings.Builder
	if err := article.RenderText(&textBuf); err != nil {
		return Document{}, false, fmt.Errorf("render text: %w", err)
	}
	text := strings.TrimSpace(textBuf.String())
	if len(text) < minExtractedLen {
		return Document{}, false, fmt.Errorf("ERR_EMPTY_CONTENT: site parece exigir JavaScript ou bloqueou o acesso — não suportado ainda")
	}

	return Document{URL: target.String(), Title: article.Title(), Text: text}, false, nil
}

// dialContextFunc is the dialer used by FetchURL's HTTP client. It defaults to
// the SSRF-guarded dialer; tests override it to point at httptest servers
// (which bind to 127.0.0.1, a loopback address the guard rightly refuses in
// production) without weakening the real SSRF protection.
var dialContextFunc = safeDialContext

// safeDialContext is a net.Dialer.DialContext replacement that resolves the
// hostname first and refuses to connect to private/loopback/link-local/
// cloud-metadata addresses — the SSRF guard. Without it, a tenant could add a
// knowledge source URL pointing at an internal service (e.g.
// http://watink-business:8082/... or http://169.254.169.254/...) and have it
// scraped and indexed as "knowledge".
func safeDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}

	ips, err := net.DefaultResolver.LookupIP(ctx, "ip", host)
	if err != nil {
		return nil, fmt.Errorf("ERR_SSRF_DNS: %w", err)
	}
	for _, ip := range ips {
		if !isPublicIP(ip) {
			return nil, fmt.Errorf("ERR_SSRF_BLOCKED: refusing to connect to non-public address %s", ip)
		}
	}

	dialer := &net.Dialer{Timeout: 10 * time.Second}
	return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
}

// isPublicIP rejects loopback, private (RFC1918), link-local (includes the
// 169.254.169.254 cloud metadata endpoint), unspecified and multicast ranges.
func isPublicIP(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsUnspecified() || ip.IsMulticast() {
		return false
	}
	return true
}
