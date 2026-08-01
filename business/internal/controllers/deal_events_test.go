package controllers

import "testing"

func TestClosedLikeStatus(t *testing.T) {
	closed := []string{"closed", "won", "lost"}
	for _, s := range closed {
		if !closedLikeStatus(s) {
			t.Fatalf("expected %q to be classified as closed-like", s)
		}
	}
	notClosed := []string{"open", "in_progress", "", "pending"}
	for _, s := range notClosed {
		if closedLikeStatus(s) {
			t.Fatalf("expected %q to NOT be classified as closed-like", s)
		}
	}
}
