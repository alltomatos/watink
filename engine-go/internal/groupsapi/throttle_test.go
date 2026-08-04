package groupsapi

import (
	"net/http"
	"testing"
)

func TestThrottle_AllowsUpToLimit(t *testing.T) {
	th := newThrottle()
	th.limit = 3
	for i := 0; i < 3; i++ {
		if !th.Allow(1) {
			t.Fatalf("call %d should be allowed", i+1)
		}
	}
	if th.Allow(1) {
		t.Fatal("4th call within the window must be rejected")
	}
}

func TestThrottle_SessionsAreIndependent(t *testing.T) {
	th := newThrottle()
	th.limit = 1
	if !th.Allow(1) {
		t.Fatal("first call for session 1 should be allowed")
	}
	if th.Allow(1) {
		t.Fatal("session 1 is now over budget")
	}
	if !th.Allow(2) {
		t.Fatal("session 2 must not be affected by session 1's usage")
	}
}

func TestWithThrottle_RejectsOverBudgetWithoutCallingBackend(t *testing.T) {
	backend := &fakeBackend{}
	th := newThrottle()
	th.limit = 1
	h := newTestServerWithThrottle(backend, th)

	// First write is allowed.
	rec1 := doJSONRequest(t, h, http.MethodPost, "/sessions/1/groups/120363xxx@g.us/leave", testToken, map[string]interface{}{"tenantId": "t1"})
	if rec1.Code != http.StatusOK {
		t.Fatalf("expected first call to succeed, got %d: %s", rec1.Code, rec1.Body.String())
	}

	// Second write on the same session is throttled.
	rec2 := doJSONRequest(t, h, http.MethodPost, "/sessions/1/groups/120363xxx@g.us/leave", testToken, map[string]interface{}{"tenantId": "t1"})
	if rec2.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

func TestWithThrottle_ReadRoutesAreNeverThrottled(t *testing.T) {
	backend := &fakeBackend{groups: nil}
	th := newThrottle()
	th.limit = 1
	h := newTestServerWithThrottle(backend, th)

	// Exhaust the write budget for session 1 first.
	_ = doJSONRequest(t, h, http.MethodPost, "/sessions/1/groups/120363xxx@g.us/leave", testToken, map[string]interface{}{"tenantId": "t1"})

	// A read on the SAME session must still succeed — reads never throttle.
	rec := doRequest(t, h, http.MethodGet, "/sessions/1/groups", testToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected read to succeed even after write budget exhausted, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestWithThrottle_InvalidSessionIDRejectedBeforeThrottleCheck(t *testing.T) {
	backend := &fakeBackend{}
	th := newThrottle()
	h := newTestServerWithThrottle(backend, th)

	rec := doJSONRequest(t, h, http.MethodPost, "/sessions/not-a-number/groups/x@g.us/leave", testToken, map[string]interface{}{"tenantId": "t1"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}
