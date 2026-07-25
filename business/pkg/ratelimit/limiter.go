// Package ratelimit provê um limitador em memória (sem Redis), usado para
// conter abuso do endpoint público de registro self-service (Onda 6, ADR 0007
// do Watink SaaS). Portado do pkg/ratelimit do watink-saas — mesmo contrato.
package ratelimit

import (
	"sync"
	"time"
)

// Limiter é uma janela deslizante simples: no máximo `max` chamadas Allow(key)
// verdadeiras dentro de `window`. Seguro para uso concorrente.
type Limiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
	max      int
	window   time.Duration
}

// New cria um limitador com o teto e a janela informados.
func New(max int, window time.Duration) *Limiter {
	return &Limiter{
		attempts: make(map[string][]time.Time),
		max:      max,
		window:   window,
	}
}

// Allow registra uma tentativa para `key` e devolve false se o teto da janela
// já foi atingido (a tentativa em si ainda é contada, para não resetar o
// bloqueio a cada nova tentativa durante um ataque de força bruta).
func (l *Limiter) Allow(key string) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()

	cutoff := now.Add(-l.window)
	kept := l.attempts[key][:0]
	for _, t := range l.attempts[key] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}

	allowed := len(kept) < l.max
	l.attempts[key] = append(kept, now)
	return allowed
}
