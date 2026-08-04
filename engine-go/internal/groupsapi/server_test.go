package groupsapi

import (
	"context"
	"net"
	"os"
	"testing"
	"time"
)

// TestStart_FailClosedWithoutToken verifies the server never opens a port
// when GROUPS_API_TOKEN is unset — it must return quickly instead of
// blocking or crashing the process.
func TestStart_FailClosedWithoutToken(t *testing.T) {
	t.Setenv("GROUPS_API_TOKEN", "")
	t.Setenv("GROUPS_API_PORT", "0")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan struct{})
	go func() {
		Start(ctx, &fakeBackend{})
		close(done)
	}()

	select {
	case <-done:
		// expected: returns immediately without starting a listener
	case <-time.After(2 * time.Second):
		t.Fatal("Start did not return promptly when GROUPS_API_TOKEN is unset")
	}
}

// TestStart_ListensWithToken verifies the server actually binds a port when
// a token is configured, and shuts down cleanly on ctx cancel.
func TestStart_ListensWithToken(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to reserve a free port: %v", err)
	}
	_, port, _ := net.SplitHostPort(lis.Addr().String())
	_ = lis.Close()

	t.Setenv("GROUPS_API_TOKEN", "secret")
	t.Setenv("GROUPS_API_PORT", port)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		Start(ctx, &fakeBackend{})
		close(done)
	}()

	deadline := time.Now().Add(3 * time.Second)
	var lastErr error
	for time.Now().Before(deadline) {
		conn, err := net.Dial("tcp", "127.0.0.1:"+port)
		if err == nil {
			_ = conn.Close()
			lastErr = nil
			break
		}
		lastErr = err
		time.Sleep(50 * time.Millisecond)
	}
	if lastErr != nil {
		t.Fatalf("server did not start listening on :%s: %v", port, lastErr)
	}

	cancel()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("Start did not shut down after ctx cancel")
	}
}

func init() {
	// Ensure a clean slate if the test binary inherits GROUPS_API_TOKEN from
	// a developer's shell — tests always set it explicitly via t.Setenv.
	_ = os.Unsetenv("GROUPS_API_TOKEN")
}
