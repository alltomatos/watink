package plugins

import (
	"math/rand"
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── clampPacing ──────────────────────────────────────────────────────────

func TestClampPacing_EnforcesFloors(t *testing.T) {
	c := &models.GroupCampaign{
		IntervalSeconds:   5,
		JitterSeconds:     40,
		BatchSize:         500,
		BatchPauseSeconds: 10,
	}
	adjusted := clampPacing(c)

	assert.True(t, adjusted)
	assert.Equal(t, campaignMinIntervalSeconds, c.IntervalSeconds, "interval 5 deve virar o piso 60")
	// interval agora é 60 -> jitter máximo = 60/4 = 15
	assert.Equal(t, 15, c.JitterSeconds, "jitter deve ser recortado para interval/4")
	assert.Equal(t, campaignMaxBatchSize, c.BatchSize, "batch 500 deve virar o teto 20")
	assert.Equal(t, campaignMinBatchPauseSeconds, c.BatchPauseSeconds, "pausa de lote 10 deve virar o piso 180")
}

func TestClampPacing_AlreadyValidValuesAreNotAdjusted(t *testing.T) {
	c := &models.GroupCampaign{
		IntervalSeconds:   120,
		JitterSeconds:     20,
		BatchSize:         10,
		BatchPauseSeconds: 300,
	}
	adjusted := clampPacing(c)

	assert.False(t, adjusted)
	assert.Equal(t, 120, c.IntervalSeconds)
	assert.Equal(t, 20, c.JitterSeconds)
	assert.Equal(t, 10, c.BatchSize)
	assert.Equal(t, 300, c.BatchPauseSeconds)
}

func TestClampPacing_ZeroBatchSizeDefaultsToMax(t *testing.T) {
	c := &models.GroupCampaign{IntervalSeconds: 120, BatchPauseSeconds: 300, BatchSize: 0}
	adjusted := clampPacing(c)
	assert.True(t, adjusted)
	assert.Equal(t, campaignMaxBatchSize, c.BatchSize)
}

func TestClampPacing_NegativeJitterClampsToZero(t *testing.T) {
	c := &models.GroupCampaign{IntervalSeconds: 120, BatchSize: 10, BatchPauseSeconds: 300, JitterSeconds: -5}
	adjusted := clampPacing(c)
	assert.True(t, adjusted)
	assert.Equal(t, 0, c.JitterSeconds)
}

// ── buildSendSchedule ────────────────────────────────────────────────────

func makeTargets(n int) []models.GroupCampaignTarget {
	targets := make([]models.GroupCampaignTarget, n)
	for i := range targets {
		targets[i] = models.GroupCampaignTarget{JID: "group-" + string(rune('a'+i)) + "@g.us", Subject: "Grupo"}
	}
	return targets
}

func TestBuildSendSchedule_IntervalAndBatchPause(t *testing.T) {
	base := time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)
	targets := makeTargets(25)
	p := pacing{IntervalSeconds: 60, JitterSeconds: 0, BatchSize: 10, BatchPauseSeconds: 300}

	out := buildSendSchedule(base, targets, 1, 0, p, rand.New(rand.NewSource(1)))

	require.Len(t, out, 25)
	assert.Equal(t, base, out[0].ScheduledAt, "primeiro envio deve ser exatamente base (sem jitter)")

	// índice 9->10 cruza a fronteira de um lote de 10: 60s de intervalo + 300s de pausa de lote.
	gap := out[10].ScheduledAt.Sub(out[9].ScheduledAt)
	assert.Equal(t, 360*time.Second, gap, "transição de lote deve somar intervalo + pausa de lote")

	// monotonicidade
	for i := 1; i < len(out); i++ {
		assert.False(t, out[i].ScheduledAt.Before(out[i-1].ScheduledAt), "agenda deve ser monotônica em i=%d", i)
	}
}

func TestBuildSendSchedule_JitterNeverCollapsesGap(t *testing.T) {
	base := time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)
	p := pacing{IntervalSeconds: 60, JitterSeconds: 15, BatchSize: 1000, BatchPauseSeconds: 0}

	for seed := int64(0); seed < 1000; seed++ {
		targets := makeTargets(5)
		out := buildSendSchedule(base, targets, 1, 0, p, rand.New(rand.NewSource(seed)))
		for i := 1; i < len(out); i++ {
			gap := out[i].ScheduledAt.Sub(out[i-1].ScheduledAt)
			assert.GreaterOrEqualf(t, gap, time.Duration(p.IntervalSeconds/2)*time.Second,
				"seed %d: gap em i=%d colapsou abaixo de interval/2 (%v)", seed, i, gap)
		}
	}
}

func TestBuildSendSchedule_RotatesVariantsWithOccurrenceOffset(t *testing.T) {
	base := time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)
	targets := makeTargets(7)
	p := pacing{IntervalSeconds: 60, JitterSeconds: 0, BatchSize: 100, BatchPauseSeconds: 0}

	// Usamos rand determinístico e olhamos os índices ANTES do shuffle
	// embaralhar -- o que importa aqui é a fórmula (i+seq)%variantCount
	// contra a posição i na saída, não qual JID foi parar em qual posição.
	out := buildSendSchedule(base, targets, 3, 0, p, rand.New(rand.NewSource(42)))
	require.Len(t, out, 7)
	for i, s := range out {
		assert.Equal(t, i%3, s.VariantIndex, "seq=0: variantIndex deve ser i%%3 em i=%d", i)
	}

	outShifted := buildSendSchedule(base, targets, 3, 1, p, rand.New(rand.NewSource(42)))
	for i, s := range outShifted {
		assert.Equal(t, (i+1)%3, s.VariantIndex, "seq=1: variantIndex deve deslocar em i=%d", i)
	}
}

func TestBuildSendSchedule_ZeroVariantCountDefaultsToOne(t *testing.T) {
	base := time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)
	targets := makeTargets(3)
	p := pacing{IntervalSeconds: 60, BatchSize: 10, BatchPauseSeconds: 300}
	out := buildSendSchedule(base, targets, 0, 0, p, rand.New(rand.NewSource(1)))
	for _, s := range out {
		assert.Equal(t, 0, s.VariantIndex)
	}
}

// ── computeNextOccurrence ────────────────────────────────────────────────

func TestComputeNextOccurrence_ImmediateAlwaysNil(t *testing.T) {
	c := models.GroupCampaign{ScheduleMode: models.GroupCampaignScheduleImmediate}
	assert.Nil(t, computeNextOccurrence(c, time.Now()))
}

func TestComputeNextOccurrence_OnceReturnsStartAtThenNil(t *testing.T) {
	start := time.Date(2026, 3, 10, 9, 0, 0, 0, time.UTC)
	c := models.GroupCampaign{ScheduleMode: models.GroupCampaignScheduleOnce, StartAt: &start}

	got := computeNextOccurrence(c, start.Add(-time.Hour))
	require.NotNil(t, got)
	assert.True(t, got.Equal(start))

	assert.Nil(t, computeNextOccurrence(c, start.Add(time.Hour)), "após o disparo único, deve devolver nil")
}

func TestComputeNextOccurrence_Weekly_PicksNextConfiguredWeekday(t *testing.T) {
	// 2026-01-05 é uma segunda-feira (weekday=1).
	after := time.Date(2026, 1, 5, 8, 0, 0, 0, time.UTC) // segunda 08:00
	c := models.GroupCampaign{
		ScheduleMode:   models.GroupCampaignScheduleRecurring,
		RecurrenceRule: models.GroupCampaignRecurrenceWeekly,
		RecurrenceDays: "1,3", // segunda, quarta
		RecurrenceTime: "09:00",
		Timezone:       "UTC",
	}

	got := computeNextOccurrence(c, after)
	require.NotNil(t, got)
	// já passou das 08:00 de segunda mas ainda não são 09:00 -> deve escolher segunda 09:00, o mesmo dia.
	assert.Equal(t, time.January, got.Month())
	assert.Equal(t, 5, got.Day())
	assert.Equal(t, 9, got.Hour())
}

func TestComputeNextOccurrence_Weekly_WrapsToNextWeek(t *testing.T) {
	// 2026-01-07 é quarta-feira, depois das 09:00 -> só resta a próxima segunda (12/01).
	after := time.Date(2026, 1, 7, 10, 0, 0, 0, time.UTC)
	c := models.GroupCampaign{
		ScheduleMode:   models.GroupCampaignScheduleRecurring,
		RecurrenceRule: models.GroupCampaignRecurrenceWeekly,
		RecurrenceDays: "1", // só segunda
		RecurrenceTime: "09:00",
		Timezone:       "UTC",
	}

	got := computeNextOccurrence(c, after)
	require.NotNil(t, got)
	assert.Equal(t, 12, got.Day())
	assert.Equal(t, time.Monday, got.Weekday())
}

func TestComputeNextOccurrence_Weekly_RespectsTimezone(t *testing.T) {
	// 09:00 em America/Sao_Paulo (UTC-3) é 12:00 UTC.
	after := time.Date(2026, 1, 4, 11, 0, 0, 0, time.UTC) // domingo 11:00 UTC = 08:00 em SP
	c := models.GroupCampaign{
		ScheduleMode:   models.GroupCampaignScheduleRecurring,
		RecurrenceRule: models.GroupCampaignRecurrenceWeekly,
		RecurrenceDays: "0", // domingo
		RecurrenceTime: "09:00",
		Timezone:       "America/Sao_Paulo",
	}

	got := computeNextOccurrence(c, after)
	require.NotNil(t, got)
	assert.Equal(t, 12, got.Hour(), "09:00 em America/Sao_Paulo deve virar 12:00 UTC")
}

func TestComputeNextOccurrence_Monthly_ClampsDay31ToShortMonth(t *testing.T) {
	// Depois de 31/jan -> fevereiro não tem dia 31, deve truncar pro último dia (28, 2026 não é bissexto).
	after := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	c := models.GroupCampaign{
		ScheduleMode:   models.GroupCampaignScheduleRecurring,
		RecurrenceRule: models.GroupCampaignRecurrenceMonthly,
		RecurrenceDays: "31",
		RecurrenceTime: "09:00",
		Timezone:       "UTC",
	}

	got := computeNextOccurrence(c, after)
	require.NotNil(t, got)
	assert.Equal(t, time.February, got.Month())
	assert.Equal(t, 28, got.Day(), "2026 não é bissexto -- fevereiro trunca em 28")
}

func TestComputeNextOccurrence_ReturnsNilPastRecurrenceEnd(t *testing.T) {
	end := time.Date(2026, 1, 3, 0, 0, 0, 0, time.UTC)
	c := models.GroupCampaign{
		ScheduleMode:    models.GroupCampaignScheduleRecurring,
		RecurrenceRule:  models.GroupCampaignRecurrenceWeekly,
		RecurrenceDays:  "0,1,2,3,4,5,6", // todo dia, pra garantir que a próxima ocorrência sempre existiria
		RecurrenceTime:  "09:00",
		Timezone:        "UTC",
		RecurrenceEndAt: &end,
	}

	// Pedindo a ocorrência depois do fim -- não deve haver mais nenhuma.
	got := computeNextOccurrence(c, end.Add(time.Hour))
	assert.Nil(t, got)
}

func TestComputeNextOccurrence_EmptyRecurrenceDaysReturnsNil(t *testing.T) {
	c := models.GroupCampaign{
		ScheduleMode:   models.GroupCampaignScheduleRecurring,
		RecurrenceRule: models.GroupCampaignRecurrenceWeekly,
		RecurrenceDays: "",
		RecurrenceTime: "09:00",
		Timezone:       "UTC",
	}
	assert.Nil(t, computeNextOccurrence(c, time.Now()))
}

func TestComputeNextOccurrence_UnknownScheduleModeReturnsNil(t *testing.T) {
	c := models.GroupCampaign{ScheduleMode: "bogus"}
	assert.Nil(t, computeNextOccurrence(c, time.Now()))
}
