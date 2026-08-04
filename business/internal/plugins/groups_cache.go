package plugins

import (
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// loadGroupsCache reads the persisted snapshot for one connection --
// GET /groups's only read path (handleListGroups never calls WhatsApp
// directly, see groups_cache_sync.go for how the cache gets populated).
// The bool return distinguishes "no groups" (empty slice, found=true) from
// "never synced yet" (found=false), so the caller can bootstrap.
func loadGroupsCache(db *gorm.DB, tenantID uuid.UUID, whatsappID int) ([]groupsListEntry, bool, error) {
	var rows []models.GroupCache
	if err := db.Session(&gorm.Session{NewDB: true}).
		Where(`"tenantId" = ? AND "whatsappId" = ?`, tenantID, whatsappID).
		Order(`subject`).
		Find(&rows).Error; err != nil {
		return nil, false, err
	}
	// Zero rows is treated as "never synced" -- if the connection genuinely
	// has zero groups, this bootstraps a live fetch every time it's opened,
	// which is harmless (nothing to rate-limit against) and simpler than a
	// separate "synced but empty" marker for an edge case this rare.
	if len(rows) == 0 {
		return nil, false, nil
	}
	out := make([]groupsListEntry, 0, len(rows))
	for _, r := range rows {
		out = append(out, groupsListEntry{
			GroupInfo: domain.GroupInfo{
				JID:              r.JID,
				Subject:          r.Subject,
				Description:      r.Description,
				Owner:            r.Owner,
				IsCommunity:      r.IsCommunity,
				IsSubGroup:       r.IsSubGroup,
				ParentJID:        r.ParentJID,
				Announce:         r.Announce,
				Locked:           r.Locked,
				MemberAddMode:    r.MemberAddMode,
				JoinApprovalMode: r.JoinApprovalMode,
				PictureURL:       r.PictureURL,
				Participants:     make([]domain.Participant, r.ParticipantCount),
			},
			IsConnectionAdmin: r.IsConnectionAdmin,
		})
	}
	return out, true, nil
}

// saveGroupsToCache replaces the entire cached snapshot for one connection
// (delete-then-insert, inside a transaction) -- simplest correct way to
// also drop groups the connection has left since the last sync, without
// tracking removals separately. Called from the bootstrap fetch
// (handleListGroups, first-ever access) and from the periodic background
// sync (groups_cache_sync.go). Best-effort: errors are logged by the
// caller, never bubble up to break the live response that triggered them.
func saveGroupsToCache(db *gorm.DB, tenantID uuid.UUID, w models.Whatsapp, groups []domain.GroupInfo) error {
	rows := make([]models.GroupCache, 0, len(groups))
	now := time.Now()
	for _, g := range groups {
		rows = append(rows, models.GroupCache{
			TenantID:          tenantID,
			WhatsappID:        w.ID,
			JID:               g.JID,
			Subject:           g.Subject,
			Description:       g.Description,
			Owner:             g.Owner,
			IsCommunity:       g.IsCommunity,
			IsSubGroup:        g.IsSubGroup,
			ParentJID:         g.ParentJID,
			Announce:          g.Announce,
			Locked:            g.Locked,
			MemberAddMode:     g.MemberAddMode,
			JoinApprovalMode:  g.JoinApprovalMode,
			PictureURL:        g.PictureURL,
			ParticipantCount:  len(g.Participants),
			IsConnectionAdmin: connectionIsGroupAdmin(g.Participants, w.Number),
			CreatedAt:         now,
			UpdatedAt:         now,
		})
	}

	return db.Session(&gorm.Session{NewDB: true}).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where(`"tenantId" = ? AND "whatsappId" = ?`, tenantID, w.ID).
			Delete(&models.GroupCache{}).Error; err != nil {
			return err
		}
		if len(rows) == 0 {
			return nil
		}
		return tx.CreateInBatches(rows, 200).Error
	})
}

// upsertOneGroupCache refreshes a single (whatsappId, jid) row -- used by
// handleGetGroup, which already fetches the group live for the detail view
// (on-demand, single-group, not a bulk anti-ban concern) and can keep the
// list cache honest for that one entry as a side effect, same
// best-effort/never-blocks-the-response spirit as enrichContactsFromGroups.
func upsertOneGroupCache(db *gorm.DB, tenantID uuid.UUID, w models.Whatsapp, g domain.GroupInfo) {
	now := time.Now()
	row := models.GroupCache{
		TenantID:          tenantID,
		WhatsappID:        w.ID,
		JID:               g.JID,
		Subject:           g.Subject,
		Description:       g.Description,
		Owner:             g.Owner,
		IsCommunity:       g.IsCommunity,
		IsSubGroup:        g.IsSubGroup,
		ParentJID:         g.ParentJID,
		Announce:          g.Announce,
		Locked:            g.Locked,
		MemberAddMode:     g.MemberAddMode,
		JoinApprovalMode:  g.JoinApprovalMode,
		PictureURL:        g.PictureURL,
		ParticipantCount:  len(g.Participants),
		IsConnectionAdmin: connectionIsGroupAdmin(g.Participants, w.Number),
		UpdatedAt:         now,
	}

	writeDB := db.Session(&gorm.Session{NewDB: true})
	var existing models.GroupCache
	err := writeDB.Where(`"whatsappId" = ? AND jid = ?`, w.ID, g.JID).First(&existing).Error
	if err == nil {
		writeDB.Model(&existing).Updates(&row)
		return
	}
	if err != gorm.ErrRecordNotFound {
		return
	}
	row.CreatedAt = now
	writeDB.Create(&row)
}
