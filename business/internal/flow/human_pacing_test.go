package flow

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestHumanTypingDelay_ShortReplyUsesFloor(t *testing.T) {
	assert.Equal(t, minTypingDelay, humanTypingDelay(1))
	assert.Equal(t, minTypingDelay, humanTypingDelay(0))
}

func TestHumanTypingDelay_ProportionalToLength(t *testing.T) {
	short := humanTypingDelay(50)
	long := humanTypingDelay(200)
	assert.Greater(t, long, short, "resposta mais longa deve esperar mais")
}

func TestHumanTypingDelay_CapsAtMax(t *testing.T) {
	// 5000 palavras (~27500 chars) — nenhum humano digita isso em segundos,
	// mas também não pode travar o contato esperando minutos.
	assert.Equal(t, maxTypingDelay, humanTypingDelay(27500))
	assert.LessOrEqual(t, humanTypingDelay(27500), 12*time.Second)
}
