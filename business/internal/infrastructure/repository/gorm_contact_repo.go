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
	if profilePicUrl != "" && m.ProfilePicUrl == "" {
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

// Delete removes a contact by ID scoped to tenantID.
func (r *GORMContactRepository) Delete(ctx context.Context, id int, tenantID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("id = ? AND \"tenantId\" = ?", id, tenantID).
		Delete(&models.Contact{}).Error
}

// BulkDelete removes the contacts in ids that belong to tenantID, silently
// ignoring any ID that doesn't exist or belongs to another tenant, and
// returns the number of rows actually deleted.
func (r *GORMContactRepository) BulkDelete(ctx context.Context, ids []int, tenantID uuid.UUID) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	tx := r.db.WithContext(ctx).
		Where("id IN ? AND \"tenantId\" = ?", ids, tenantID).
		Delete(&models.Contact{})
	return tx.RowsAffected, tx.Error
}

// DeleteAll removes every contact belonging to tenantID and returns the
// number of rows deleted.
func (r *GORMContactRepository) DeleteAll(ctx context.Context, tenantID uuid.UUID) (int64, error) {
	tx := r.db.WithContext(ctx).
		Where("\"tenantId\" = ?", tenantID).
		Delete(&models.Contact{})
	return tx.RowsAffected, tx.Error
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
