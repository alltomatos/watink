package plugins

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCreateActivitySLAParity mirrors
// controllers.TestCalculateSLADueAt_DefaultsByPriority line for line — same
// input, same expected durations. internal/plugins cannot import
// internal/controllers (cycle, see ADR 0029 addendum), so this is the
// closest thing to a real parity check across the two duplicated SLA
// calculators: if either activityDefaultSLAMinutes() or
// controllers.defaultActivitySLAConfig() changes without the other, one of
// these two tests starts failing.
func TestCreateActivitySLAParity(t *testing.T) {
	from := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	cfg := activityDefaultSLAMinutes()

	cases := []struct {
		priority string
		want     time.Duration
	}{
		{"urgent", 2 * time.Hour},
		{"high", 8 * time.Hour},
		{"medium", 24 * time.Hour},
		{"low", 72 * time.Hour},
	}
	for _, tc := range cases {
		got := calculateActivitySLADueAt(cfg, tc.priority, from)
		require.NotNil(t, got)
		assert.Equal(t, from.Add(tc.want), *got, "priority=%s", tc.priority)
	}
}

func TestCreateActivitySLAParity_CustomConfig(t *testing.T) {
	from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	cfg := activitySLAMinutes{Low: 10, Medium: 20, High: 30, Urgent: 40}

	assert.Equal(t, from.Add(40*time.Minute), *calculateActivitySLADueAt(cfg, "urgent", from))
	assert.Equal(t, from.Add(30*time.Minute), *calculateActivitySLADueAt(cfg, "high", from))
	assert.Equal(t, from.Add(20*time.Minute), *calculateActivitySLADueAt(cfg, "medium", from))
	assert.Equal(t, from.Add(10*time.Minute), *calculateActivitySLADueAt(cfg, "low", from))
}

func TestNormalizeActivityPriority(t *testing.T) {
	assert.Equal(t, "low", normalizeActivityPriority("low"))
	assert.Equal(t, "high", normalizeActivityPriority("high"))
	assert.Equal(t, "urgent", normalizeActivityPriority("urgent"))
	assert.Equal(t, "medium", normalizeActivityPriority("medium"))
	assert.Equal(t, "medium", normalizeActivityPriority(""))
	assert.Equal(t, "medium", normalizeActivityPriority("nonsense"))
}
