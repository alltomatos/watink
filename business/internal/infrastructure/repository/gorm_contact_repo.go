package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Compile-time interface check.
var _ domain.ContactRepository = (*GORMContactRepository)(nil)

// GORMContactRepository implements domain.ContactRepository using GORM.
type GORMContactRepository struct {
	db *gorm.DB
}

// NewGORMContactRepo constructs a GORMContactRepository.
func NewGORMContactRepo(db *gorm.DB) *GORMContactRepository {
	return &GORMContactRepository{db: db}
}

// ContactRepository interface implementation

// FindByNumber returns the contact with the given number and isGroup flag under tenantID, or nil if not found.
func (r *GORMContactRepository) FindByNumber(ctx context.Context, tenantID uuid.UUID, number string, isGroup bool) (*domain.Contact, error) {
	var m models.Contact
	err := r.db.WithContext(ctx).
		Where("\"number\" = ? AND \"isGroup\" = ? AND \"tenantId\" = ?", number, isGroup, tenantID).
		First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return contactModelToDomain(&m), nil
}

// FindByLID returns the contact with the given LID and isGroup flag under tenantID, or nil if not found.
func (r *GORMContactRepository) FindByLID(ctx context.Context, tenantID uuid.UUID, lid string, isGroup bool) (*domain.Contact, error) {
	var m models.Contact
	err := r.db.WithContext(ctx).
		Where("lid = ? AND \"isGroup\" = ? AND \"tenantId\" = ?", lid, isGroup, tenantID).
		First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return contactModelToDomain(&m), nil
}

// FindOrCreate creates a contact if it doesn't exist, or returns the existing one.
// This method encapsulates the complex find-or-create logic from processMessage.
func (r *GORMContactRepository) FindOrCreate(ctx context.Context, tenantID uuid.UUID, number string, pushName string, profilePicUrl string, isGroup bool, isLid bool, lid string) (*domain.Contact, error) {
	var m models.Contact
	query := r.db.WithContext(ctx).Where("\"tenantId\" = ? AND \"isGroup\" = ?", tenantID, isGroup)
	if isLid {
		query = query.Where("lid = ?", lid)
	} else {
		query = query.Where("number = ?", number)
	}

	if err := query.First(&m).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		// Create new contact
		m = models.Contact{
			Name:          pushName,
			Number:        number,
			TenantID:      tenantID,
			IsGroup:       isGroup,
			ProfilePicUrl: profilePicUrl,
		}
		if m.Name == "" {
			m.Name = number
		}
		if isLid {
			m.Lid = &lid
		}
		if err := r.db.WithContext(ctx).Create(&m).Error; err != nil {
			return nil, fmt.Errorf("failed to create contact: %v", err)
		}
		return contactModelToDomain(&m), nil
	}

	// Update existing contact if needed
	updates := make(map[string]interface{})
	if pushName != "" && (m.Name == "" || m.Name == m.Number) {
		updates["name"] = pushName
	}
	// WhatsApp CDN URLs expire -- refresh whenever a new non-empty URL arrives
	// (never overwrite a stored URL with an empty one, so a transient lookup
	// failure never erases an existing picture).
	if profilePicUrl != "" && profilePicUrl != m.ProfilePicUrl {
		updates["profilePicUrl"] = profilePicUrl
	}
	if isLid && m.Lid == nil {
		updates["lid"] = lid
	}
	if len(updates) > 0 {
		if err := r.db.WithContext(ctx).Model(&m).Updates(updates).Error; err != nil {
			return nil, err
		}
		// Reload updated contact
		if err := r.db.WithContext(ctx).Where("id = ?", m.ID).First(&m).Error; err != nil {
			return nil, err
		}
	}
	return contactModelToDomain(&m), nil
}

// FindByID returns a single contact by ID scoped to tenantID, or nil if not found.
func (r *GORMContactRepository) FindByID(ctx context.Context, id int, tenantID uuid.UUID) (*domain.Contact, error) {
	var m models.Contact
	err := r.db.WithContext(ctx).
		Where("id = ? AND \"tenantId\" = ?", id, tenantID).
		First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return contactModelToDomain(&m), nil
}

// Find returns contacts matching a search term under tenantID.
func (r *GORMContactRepository) Find(ctx context.Context, tenantID uuid.UUID, search string) ([]domain.Contact, error) {
	var m []models.Contact
	query := r.db.WithContext(ctx).Where("\"tenantId\" = ?", tenantID)
	if search != "" {
		query = query.Where("name ILIKE ? OR number ILIKE ?", "%"+search+"%", "%"+search+"%")
	}
	if err := query.Find(&m).Error; err != nil {
		return nil, err
	}
	var contacts []domain.Contact
	for _, c := range m {
		contacts = append(contacts, *contactModelToDomain(&c))
	}
	return contacts, nil
}

// Delete removes a contact by ID scoped to tenantID, cascading every row
// that has a NOT NULL foreign key into Contacts (Tickets, Messages, Deals,
// Protocols, ConversationEmbeddings) — otherwise Postgres rejects the delete
// with fk_Contacts_tickets (or a sibling constraint) whenever the contact has
// any history. There is nowhere to migrate that history to, so cascading is
// the deliberate behavior here, same reasoning as PipelineController.Delete
// cascading Deals when the whole container is removed.
func (r *GORMContactRepository) Delete(ctx context.Context, id int, tenantID uuid.UUID) error {
	return r.deleteContactsCascade(ctx, tenantID, "id = ?", id)
}

// BulkDelete removes the contacts in ids that belong to tenantID, silently
// ignoring any ID that doesn't exist or belongs to another tenant, and
// returns the number of rows actually deleted. Cascades the same dependent
// rows as Delete.
func (r *GORMContactRepository) BulkDelete(ctx context.Context, ids []int, tenantID uuid.UUID) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	return r.deleteAffectedCount(ctx, tenantID, "id IN ?", ids)
}

// DeleteAll removes every contact belonging to tenantID and returns the
// number of rows deleted. Cascades the same dependent rows as Delete.
func (r *GORMContactRepository) DeleteAll(ctx context.Context, tenantID uuid.UUID) (int64, error) {
	return r.deleteAffectedCount(ctx, tenantID, "\"tenantId\" = ?", tenantID)
}

func (r *GORMContactRepository) deleteContactsCascade(ctx context.Context, tenantID uuid.UUID, contactCond string, contactArgs ...interface{}) error {
	_, err := r.deleteAffectedCount(ctx, tenantID, contactCond, contactArgs...)
	return err
}

// deleteAffectedCount runs the full cascade transactionally and returns how
// many Contacts rows were actually deleted. contactCond/contactArgs select
// the target contacts (already tenant-scoped by the caller's WHERE, but every
// child-table statement below re-applies "tenantId" defensively).
func (r *GORMContactRepository) deleteAffectedCount(ctx context.Context, tenantID uuid.UUID, contactCond string, contactArgs ...interface{}) (int64, error) {
	var affected int64
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var ids []int
		if err := tx.Model(&models.Contact{}).
			Where(contactCond, contactArgs...).Where(`"tenantId" = ?`, tenantID).
			Pluck("id", &ids).Error; err != nil {
			return err
		}
		if len(ids) == 0 {
			return nil
		}

		if err := tx.Exec(`DELETE FROM "Messages" WHERE "ticketId" IN (SELECT id FROM "Tickets" WHERE "contactId" IN ? AND "tenantId" = ?)`, ids, tenantID).Error; err != nil {
			return err
		}
		if err := tx.Exec(`DELETE FROM "ConversationEmbeddings" WHERE "contactId" IN ? AND "tenantId" = ?`, ids, tenantID).Error; err != nil {
			return err
		}
		if err := tx.Exec(`DELETE FROM "Protocols" WHERE "contactId" IN ? AND "tenantId" = ?`, ids, tenantID).Error; err != nil {
			return err
		}
		if err := tx.Exec(`DELETE FROM "Deals" WHERE "contactId" IN ? AND "tenantId" = ?`, ids, tenantID).Error; err != nil {
			return err
		}
		if err := tx.Exec(`DELETE FROM "Tickets" WHERE "contactId" IN ? AND "tenantId" = ?`, ids, tenantID).Error; err != nil {
			return err
		}

		res := tx.Where("id IN ?", ids).Where(`"tenantId" = ?`, tenantID).Delete(&models.Contact{})
		if res.Error != nil {
			return res.Error
		}
		affected = res.RowsAffected
		return nil
	})
	return affected, err
}

// Create inserts a new contact record from the domain struct.
func (r *GORMContactRepository) Create(ctx context.Context, contact *domain.Contact) error {
	m := contactDomainToModel(contact)
	return r.db.WithContext(ctx).Create(m).Error
}

// Update applies a partial update on the contact identified by contact.ID + contact.TenantID.
func (r *GORMContactRepository) Update(ctx context.Context, contact *domain.Contact, fields map[string]interface{}) error {
	return r.db.WithContext(ctx).
		Model(&models.Contact{}).
		Where("id = ? AND \"tenantId\" = ?", contact.ID, contact.TenantID).
		Updates(fields).Error
}

// --- Mapping helpers ---

func contactModelToDomain(m *models.Contact) *domain.Contact {
	return &domain.Contact{
		ID:            m.ID,
		Name:          m.Name,
		Number:        m.Number,
		ProfilePicUrl: m.ProfilePicUrl,
		Email:         m.Email,
		IsGroup:       m.IsGroup,
		TenantID:      m.TenantID,
		Lid:           m.Lid,
		WalletUserID:  m.WalletUserID,
		CreatedAt:     m.CreatedAt,
		UpdatedAt:     m.UpdatedAt,
	}
}

func contactDomainToModel(d *domain.Contact) *models.Contact {
	return &models.Contact{
		ID:            d.ID,
		Name:          d.Name,
		Number:        d.Number,
		ProfilePicUrl: d.ProfilePicUrl,
		Email:         d.Email,
		IsGroup:       d.IsGroup,
		TenantID:      d.TenantID,
		Lid:           d.Lid,
		WalletUserID:  d.WalletUserID,
		CreatedAt:     d.CreatedAt,
		UpdatedAt:     d.UpdatedAt,
	}
}
