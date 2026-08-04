package groupsapi

import (
	"context"
	"crypto/subtle"
	"log"
	"net/http"
	"os"
)

// Start launches the internal groups/communities HTTP API and blocks until
// ctx is cancelled — same lifecycle shape as internal/health.Start, called
// alongside it from cmd/engine/main.go.
//
// Fail-closed: if GROUPS_API_TOKEN is not set, the server does NOT start
// (logged, not fatal — the rest of the engine keeps running; this feature
// is simply unavailable, matching how a plugin not yet activated behaves).
// It never opens the port without an auth token configured.
func Start(ctx context.Context, backend Backend) {
	token := os.Getenv("GROUPS_API_TOKEN")
	if token == "" {
		log.Println("[groupsapi] GROUPS_API_TOKEN not set — internal groups API disabled (fail-closed)")
		return
	}

	port := os.Getenv("GROUPS_API_PORT")
	if port == "" {
		port = "8084"
	}

	mux := newMux(backend, newThrottle())
	srv := &http.Server{Addr: ":" + port, Handler: authMiddleware(token, mux)}

	go func() {
		log.Printf("[groupsapi] listening on :%s (docker-internal only)", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[groupsapi] server error: %v", err)
		}
	}()

	<-ctx.Done()
	_ = srv.Shutdown(context.Background())
	log.Println("[groupsapi] server stopped")
}

// authMiddleware enforces X-Internal-Token on every request. Constant-time
// comparison — this token is a shared secret, not a public API key, and
// should not be distinguishable via timing.
func authMiddleware(token string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := r.Header.Get("X-Internal-Token")
		if got == "" || subtle.ConstantTimeCompare([]byte(got), []byte(token)) != 1 {
			writeError(w, http.StatusUnauthorized, CodeAuthFailed, "missing or invalid X-Internal-Token")
			return
		}
		next.ServeHTTP(w, r)
	})
}
