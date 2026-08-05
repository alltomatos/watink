package flow

import "time"

// Constantes de ritmo de digitação simulado — nenhum humano digita um texto
// de 5 mil palavras em 2 segundos; o Assistant de IA agora paga um "custo"
// proporcional ao tamanho da resposta antes de enviá-la, com o indicador de
// "digitando..." aceso durante a espera (ver WhatsAppAdapter.Send,
// gate msg.Meta["humanPacing"]).
//
// msPerChar é deliberadamente mais rápido que digitação humana real (~40
// palavras/min ≈ 3-4 chars/s levaria minutos para respostas longas, o que
// frustraria o usuário) — o objetivo é só quebrar a ilusão de instantâneo,
// não replicar velocidade real de datilografia. minTypingDelay/maxTypingDelay
// limitam os dois extremos: uma resposta de 1 palavra não trava por 800ms
// sem necessidade real, e uma resposta gigante não faz o contato esperar
// minutos.
const (
	msPerChar      = 15
	minTypingDelay = 800 * time.Millisecond
	maxTypingDelay = 12 * time.Second
)

// humanTypingDelay calcula quanto tempo "esperar digitando" antes de enviar
// uma resposta de bodyLen caracteres, dentro dos limites acima.
func humanTypingDelay(bodyLen int) time.Duration {
	d := time.Duration(bodyLen*msPerChar) * time.Millisecond
	if d < minTypingDelay {
		return minTypingDelay
	}
	if d > maxTypingDelay {
		return maxTypingDelay
	}
	return d
}
