// Package mediawait correlaciona o download de mídia sob demanda — que hoje
// é 100% assíncrono via AMQP nos dois sentidos (business publica
// media.download, engine-go responde depois com um evento message.media
// solto, sem request/reply) — com um chamador síncrono que precisa dos
// bytes na hora, como o Agent Runtime transcrevendo um áudio recebido.
//
// Um único *Waiter é compartilhado entre dois pontos que nunca se enxergam
// diretamente (para não criar ciclo de import): quem PUBLICA o pedido e
// espera (internal/plugins.AssistantRuntime) e quem FULFILLS a promise
// quando o resultado chega (internal/services, handleMediaDownloaded).
package mediawait

import (
	"context"
	"fmt"
	"sync"
)

// Result is what Fulfill delivers to whoever is Awaiting a given messageID.
type Result struct {
	MediaData string // base64, mesmo formato do evento message.media do engine
	MimeType  string
	Err       string // erro relatado pelo engine (download.go) — vazio = sucesso
}

// Waiter is safe for concurrent use — DI pura, uma instância por processo,
// injetada tanto em AssistantRuntime (Await) quanto no EventListener
// (Fulfill), nunca um global/singleton pacote-level.
type Waiter struct {
	mu      sync.Mutex
	waiting map[string]chan Result
}

func New() *Waiter {
	return &Waiter{waiting: make(map[string]chan Result)}
}

// Await registers messageID and blocks until Fulfill(messageID, ...) is
// called or ctx is done — whichever comes first. The registration is always
// cleaned up before returning, so a Fulfill that arrives after a timeout
// (or that never arrives) never leaks memory.
func (w *Waiter) Await(ctx context.Context, messageID string) (Result, error) {
	ch := make(chan Result, 1)
	w.mu.Lock()
	w.waiting[messageID] = ch
	w.mu.Unlock()

	defer func() {
		w.mu.Lock()
		delete(w.waiting, messageID)
		w.mu.Unlock()
	}()

	select {
	case res := <-ch:
		return res, nil
	case <-ctx.Done():
		return Result{}, fmt.Errorf("mediawait: timeout aguardando download de %s: %w", messageID, ctx.Err())
	}
}

// Fulfill delivers res to a pending Await(messageID), if any. A no-op when
// nobody is waiting (e.g. a regular UI-triggered download, unrelated to the
// Agent Runtime) — never blocks, the channel is always buffered.
func (w *Waiter) Fulfill(messageID string, res Result) {
	w.mu.Lock()
	ch, ok := w.waiting[messageID]
	w.mu.Unlock()
	if !ok {
		return
	}
	ch <- res
}
