package ratelimit

import (
	"testing"
	"time"
)

func TestLimiter_AllowsUpToMax(t *testing.T) {
	l := New(3, time.Minute)
	for i := 0; i < 3; i++ {
		if !l.Allow("k") {
			t.Fatalf("tentativa %d deveria ser permitida", i+1)
		}
	}
	if l.Allow("k") {
		t.Fatal("4ª tentativa deveria ser bloqueada")
	}
}

func TestLimiter_KeysAreIndependent(t *testing.T) {
	l := New(1, time.Minute)
	if !l.Allow("a") {
		t.Fatal("primeira tentativa de 'a' deveria ser permitida")
	}
	if !l.Allow("b") {
		t.Fatal("primeira tentativa de 'b' não deveria ser afetada pelo limite de 'a'")
	}
	if l.Allow("a") {
		t.Fatal("segunda tentativa de 'a' deveria ser bloqueada")
	}
}

func TestLimiter_ExpiresOldAttempts(t *testing.T) {
	l := New(1, 20*time.Millisecond)
	if !l.Allow("k") {
		t.Fatal("primeira tentativa deveria ser permitida")
	}
	if l.Allow("k") {
		t.Fatal("segunda tentativa imediata deveria ser bloqueada")
	}
	time.Sleep(30 * time.Millisecond)
	if !l.Allow("k") {
		t.Fatal("tentativa após a janela expirar deveria ser permitida")
	}
}
