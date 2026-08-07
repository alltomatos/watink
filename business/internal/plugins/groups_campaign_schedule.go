package plugins

import (
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
)

// Anti-ban pacing floor (issue #593, épico #589) -- clampPacing ADJUSTS a
// campaign's pacing fields into this envelope rather than rejecting the
// request; the handler that calls it (issue #596) echoes back whether it
// adjusted anything so the UI can show "ajustado para o mínimo de
// segurança" instead of a bare validation error. These are hard floors the
// client can never bypass, no matter what it sends.
const (
	campaignMinIntervalSeconds   = 60
	campaignMaxJitterRatio       = 4 // jitter <= interval/4
	campaignMinJitterSeconds     = 5
	campaignMaxBatchSize         = 20
	campaignMinBatchPauseSeconds = 180
	campaignMaxTargetsPerRun     = 300
)

// clampPacing enforces the anti-ban floor on a campaign's pacing fields,
// mutating c in place, and reports whether anything was adjusted.
//
// Capping jitter at interval/4 is what actually guarantees the floor: the
// worst-case gap between two consecutive sends on the same connection is
// interval - 2*jitter, which with jitter <= interval/4 can never drop
// below interval/2 -- so a 60s interval always leaves at least 30s between
// sends, and jitter alone can never invert send order.
func clampPacing(c *models.GroupCampaign) (adjusted bool) {
	if c.IntervalSeconds < campaignMinIntervalSeconds {
		c.IntervalSeconds = campaignMinIntervalSeconds
		adjusted = true
	}

	maxJitter := c.IntervalSeconds / campaignMaxJitterRatio
	if maxJitter < campaignMinJitterSeconds {
		maxJitter = campaignMinJitterSeconds
	}
	if c.JitterSeconds > maxJitter {
		c.JitterSeconds = maxJitter
		adjusted = true
	}
	if c.JitterSeconds < 0 {
		c.JitterSeconds = 0
		adjusted = true
	}

	if c.BatchSize <= 0 {
		c.BatchSize = campaignMaxBatchSize
		adjusted = true
	} else if c.BatchSize > campaignMaxBatchSize {
		c.BatchSize = campaignMaxBatchSize
		adjusted = true
	}

	if c.BatchPauseSeconds < campaignMinBatchPauseSeconds {
		c.BatchPauseSeconds = campaignMinBatchPauseSeconds
		adjusted = true
	}

	return adjusted
}

// pacing is the already-clamped subset of GroupCampaign fields
// buildSendSchedule needs -- kept separate from models.GroupCampaign so
// the scheduling math has no DB dependency and is trivially unit-testable.
type pacing struct {
	IntervalSeconds   int
	JitterSeconds     int
	BatchSize         int
	BatchPauseSeconds int
}

// plannedSend is one target's computed send slot -- the pure-function output
// that groups_campaign_materialize.go (issue #594) turns into
// models.GroupCampaignSend rows.
type plannedSend struct {
	JID          string
	Subject      string
	VariantIndex int
	ScheduledAt  time.Time
}

// buildSendSchedule pre-computes every send's ScheduledAt and VariantIndex
// for one campaign run -- NO time.Sleep anywhere, ever: the drain cron
// (issue #594) is a stateless "WHERE scheduledAt <= now()" sweep over what
// this function already decided, which is also what makes the schedule
// inspectable in the UI before anything fires.
//
// Three anti-fingerprint properties, all expressed as data:
//  1. interval + jitter between consecutive sends
//  2. a longer pause every BatchSize sends (batch-pause)
//  3. variant rotation with a per-occurrence offset (seq), so the same
//     group doesn't always get the same variant on every recurrence
//
// targets are shuffled (via rnd, caller-injected so tests are
// deterministic) before scheduling -- a weekly campaign must not always
// hit the same group first, which would itself become a fingerprintable
// pattern.
func buildSendSchedule(base time.Time, targets []models.GroupCampaignTarget, variantCount, seq int, p pacing, rnd *rand.Rand) []plannedSend {
	if variantCount <= 0 {
		variantCount = 1
	}

	order := make([]models.GroupCampaignTarget, len(targets))
	copy(order, targets)
	rnd.Shuffle(len(order), func(i, j int) { order[i], order[j] = order[j], order[i] })

	out := make([]plannedSend, len(order))
	for i, t := range order {
		slot := i*p.IntervalSeconds + p.BatchPauseSeconds*(i/max(p.BatchSize, 1))

		jitter := 0
		if p.JitterSeconds > 0 {
			jitter = rnd.Intn(2*p.JitterSeconds+1) - p.JitterSeconds
		}

		at := base.Add(time.Duration(slot+jitter) * time.Second)
		if at.Before(base) {
			at = base
		}

		out[i] = plannedSend{
			JID:          t.JID,
			Subject:      t.Subject,
			VariantIndex: (i + seq) % variantCount,
			ScheduledAt:  at,
		}
	}
	return out
}

// computeNextOccurrence resolves when a GroupCampaign's next occurrence
// fires, or nil when there isn't one:
//   - immediate: never cron-scheduled at all -- materialized inline by the
//     /start handler (issue #597), so this always returns nil for it.
//   - once: StartAt on the first call (i.e. when the campaign has no
//     occurrence yet); nil afterwards -- callers pass `after` >= StartAt
//     once the single occurrence has fired.
//   - recurring/weekly: the earliest configured weekday+time strictly
//     after `after`, computed in the campaign's own timezone and converted
//     to UTC only at the end -- doing the arithmetic in-zone is what makes
//     this DST-correct even though Brazil has none today (never assume
//     that stays true).
//   - recurring/monthly: the earliest configured day-of-month+time after
//     `after`; a day beyond the current month's length clamps to the
//     month's last day (day 31 fires on Feb 28/29 instead of silently
//     never firing that month).
//
// Returns nil once RecurrenceEndAt has passed.
func computeNextOccurrence(c models.GroupCampaign, after time.Time) *time.Time {
	switch c.ScheduleMode {
	case models.GroupCampaignScheduleImmediate:
		return nil

	case models.GroupCampaignScheduleOnce:
		if c.StartAt == nil {
			return nil
		}
		if !c.StartAt.After(after) {
			return nil
		}
		return c.StartAt

	case models.GroupCampaignScheduleRecurring:
		return computeNextRecurrence(c, after)

	default:
		return nil
	}
}

func computeNextRecurrence(c models.GroupCampaign, after time.Time) *time.Time {
	loc, err := time.LoadLocation(c.Timezone)
	if err != nil {
		loc = time.UTC
	}

	hour, minute := parseRecurrenceTime(c.RecurrenceTime)
	afterLocal := after.In(loc)

	var next time.Time
	switch c.RecurrenceRule {
	case models.GroupCampaignRecurrenceWeekly:
		days := parseRecurrenceDays(c.RecurrenceDays, 0, 6)
		if len(days) == 0 {
			return nil
		}
		next = nextWeeklyOccurrence(afterLocal, days, hour, minute, loc)

	case models.GroupCampaignRecurrenceMonthly:
		days := parseRecurrenceDays(c.RecurrenceDays, 1, 31)
		if len(days) == 0 {
			return nil
		}
		next = nextMonthlyOccurrence(afterLocal, days, hour, minute, loc)

	default:
		return nil
	}

	nextUTC := next.UTC()
	if c.RecurrenceEndAt != nil && nextUTC.After(*c.RecurrenceEndAt) {
		return nil
	}
	return &nextUTC
}

// parseRecurrenceTime parses "HH:MM"; defaults to 00:00 on any malformed
// input rather than erroring -- a bad/empty RecurrenceTime should degrade
// to midnight, never crash the materializer cron.
func parseRecurrenceTime(hhmm string) (hour, minute int) {
	parts := strings.SplitN(hhmm, ":", 2)
	if len(parts) != 2 {
		return 0, 0
	}
	h, errH := strconv.Atoi(parts[0])
	m, errM := strconv.Atoi(parts[1])
	if errH != nil || errM != nil || h < 0 || h > 23 || m < 0 || m > 59 {
		return 0, 0
	}
	return h, m
}

// parseRecurrenceDays parses a CSV of ints, keeping only values within
// [min,max] -- malformed/out-of-range entries are silently dropped rather
// than propagated as an error, matching parseRecurrenceTime's degrade
// posture.
func parseRecurrenceDays(csv string, min, max int) []int {
	if csv == "" {
		return nil
	}
	var days []int
	for _, raw := range strings.Split(csv, ",") {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		d, err := strconv.Atoi(raw)
		if err != nil || d < min || d > max {
			continue
		}
		days = append(days, d)
	}
	return days
}

// nextWeeklyOccurrence finds the earliest (weekday in days, hour:minute)
// strictly after `after`, scanning at most 8 days forward (covers "today
// later" through a full week wrap).
func nextWeeklyOccurrence(after time.Time, days []int, hour, minute int, loc *time.Location) time.Time {
	daySet := make(map[int]bool, len(days))
	for _, d := range days {
		daySet[d] = true
	}

	cursor := time.Date(after.Year(), after.Month(), after.Day(), hour, minute, 0, 0, loc)
	for i := 0; i < 8; i++ {
		candidate := cursor.AddDate(0, 0, i)
		if daySet[int(candidate.Weekday())] && candidate.After(after) {
			return candidate
		}
	}
	// Unreachable in practice (daySet is non-empty and 8 days always covers
	// a full week), but never return the zero time.
	return after.AddDate(0, 0, 7)
}

// nextMonthlyOccurrence finds the earliest (day-of-month in days,
// hour:minute) strictly after `after`, scanning the current month, the
// next, and the one after that (covers a day-31 entry needing to skip
// straight to a month that actually has 31 days).
func nextMonthlyOccurrence(after time.Time, days []int, hour, minute int, loc *time.Location) time.Time {
	var best *time.Time
	consider := func(candidate time.Time) {
		if candidate.After(after) && (best == nil || candidate.Before(*best)) {
			best = &candidate
		}
	}

	for monthOffset := 0; monthOffset < 3; monthOffset++ {
		firstOfMonth := time.Date(after.Year(), after.Month(), 1, 0, 0, 0, 0, loc).AddDate(0, monthOffset, 0)
		lastDay := lastDayOfMonth(firstOfMonth)
		for _, d := range days {
			day := d
			if day > lastDay {
				day = lastDay
			}
			consider(time.Date(firstOfMonth.Year(), firstOfMonth.Month(), day, hour, minute, 0, 0, loc))
		}
	}

	if best == nil {
		// All requested days clamp to a date not after `after` in the
		// scanned window (shouldn't happen with 3 months of lookahead) --
		// fail safe to +1 month rather than returning the zero time.
		return after.AddDate(0, 1, 0)
	}
	return *best
}

func lastDayOfMonth(firstOfMonth time.Time) int {
	firstOfNextMonth := firstOfMonth.AddDate(0, 1, 0)
	lastDay := firstOfNextMonth.AddDate(0, 0, -1)
	return lastDay.Day()
}
