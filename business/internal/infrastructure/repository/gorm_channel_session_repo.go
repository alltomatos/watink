package repository

import (
	"context"
	"errors"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Compile-time interface check.
var _ domain.ChannelSessionRepository = (*GORMChannelSessionRepository)(nil)

// GORMChannelSessionRepository implements domain.ChannelSessionRepository using GORM.
type GORMChannelSessionRepository struct {
	db *gorm.DB
}

// NewGORMChannelSessionRepo constructs a GORMChannelSessionRepository.
func NewGORMChannelSessionRepo(db *gorm.DB) *GORMChannelSessionRepository {
	return &GORMChannelSessionRepository{db: db}
}

// FindByID returns the channel session with the given id under tenantID, or nil if not found.
// Mantém retorno enxuto (sem relations carregadas).
func (r *GORMChannelSessionRepository) FindByID(ctx context.Context, id int, tenantID uuid.UUID) (*domain.ChannelSession, error) {
	var m models.Whatsapp
	err := r.db.WithContext(ctx).
		Where("id = ? AND \"tenantId\" = ?", id, tenantID).
		First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return whatsappModelToDomain(&m), nil
}

// FindByIDDetail returns the channel session with relations loaded.
// Usado no endpoint de detalhe enriquecido.
func (r *GORMChannelSessionRepository) FindByIDDetail(ctx context.Context, id int, tenantID uuid.UUID) (*models.Whatsapp, error) {
	var m models.Whatsapp
	err := r.db.WithContext(ctx).
		Preload("Queues").
		Where("id = ? AND \"tenantId\" = ?", id, tenantID).
		First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &m, nil
}

// FindAll returns all channel sessions under tenantID.
func (r *GORMChannelSessionRepository) FindAll(ctx context.Context, tenantID uuid.UUID) ([]domain.ChannelSession, error) {
	var ms []models.Whatsapp
	err := r.db.WithContext(ctx).
		Where("\"tenantId\" = ?", tenantID).
		Find(&ms).Error
	if err != nil {
		return nil, err
	}
	sessions := make([]domain.ChannelSession, len(ms))
	for i := range ms {
		sessions[i] = *whatsappModelToDomain(&ms[i])
	}
	return sessions, nil
}

// Create inserts a new channel session record. channelSessionDomainToModel
// builds a NEW *models.Whatsapp, so the DB-generated ID/timestamps land on that
// struct, not on the caller's session. É obrigatório copiar de volta para o
// session do caller, senão CreateWhatsapp usa `input` como corpo da resposta
// HTTP e o JSON sai com ID=0.
func (r *GORMChannelSessionRepository) Create(ctx context.Context, session *domain.ChannelSession) error {
	m := channelSessionDomainToModel(session)
	if err := r.db.WithContext(ctx).Create(m).Error; err != nil {
		return err
	}
	session.ID = m.ID
	session.CreatedAt = m.CreatedAt
	session.UpdatedAt = m.UpdatedAt
	return nil
}

// Update applies a partial update on the session identified by session.ID + session.TenantID.
func (r *GORMChannelSessionRepository) Update(ctx context.Context, session *domain.ChannelSession, fields map[string]interface{}) error {
	return r.db.WithContext(ctx).
		Model(&models.Whatsapp{}).
		Where("id = ? AND \"tenantId\" = ?", session.ID, session.TenantID).
		Updates(fields).Error
}

// Delete removes the channel session with the given id under tenantID.
func (r *GORMChannelSessionRepository) Delete(ctx context.Context, id int, tenantID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("id = ? AND \"tenantId\" = ?", id, tenantID).
		Delete(&models.Whatsapp{}).Error
}

// ResetDefaultFlag sets isDefault=false for all sessions under tenantID.
func (r *GORMChannelSessionRepository) ResetDefaultFlag(ctx context.Context, tenantID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&models.Whatsapp{}).
		Where("\"tenantId\" = ?", tenantID).
		Update("isDefault", false).Error
}

// DeleteWithRelations removes a session and nullifies foreign keys in related entities.
func (r *GORMChannelSessionRepository) DeleteWithRelations(ctx context.Context, id int, tenantID uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Ticket{}).
			Where("\"whatsappId\" = ? AND \"tenantId\" = ?", id, tenantID).
			Update("whatsappId", nil).Error; err != nil {
			return err
		}

		if err := tx.Model(&models.User{}).
			Where("\"whatsappId\" = ? AND \"tenantId\" = ?", id, tenantID).
			Update("whatsappId", nil).Error; err != nil {
			return err
		}

		if err := tx.Model(&models.Flow{}).
			Where("\"whatsappId\" = ? AND \"tenantId\" = ?", id, tenantID).
			Update("whatsappId", nil).Error; err != nil {
			return err
		}

		if err := tx.Exec("DELETE FROM whatsapp_queues WHERE whatsapp_id = ?", id).Error; err != nil {
			return err
		}

		if err := tx.Where("id = ? AND \"tenantId\" = ?", id, tenantID).
			Delete(&models.Whatsapp{}).Error; err != nil {
			return err
		}

		return nil
	})
}

// --- Mapping helpers ---

func whatsappModelToDomain(m *models.Whatsapp) *domain.ChannelSession {
	return &domain.ChannelSession{
		ID:                m.ID,
		Session:           m.Session,
		Qrcode:            m.Qrcode,
		Status:            m.Status,
		Battery:           m.Battery,
		Plugged:           m.Plugged,
		Name:              m.Name,
		IsDefault:         m.IsDefault,
		Retries:           m.Retries,
		GreetingMessage:   m.GreetingMessage,
		FarewellMessage:   m.FarewellMessage,
		TenantID:          m.TenantID,
		SyncHistory:       m.SyncHistory,
		SyncPeriod:        m.SyncPeriod,
		Number:            m.Number,
		ProfilePicUrl:     m.ProfilePicUrl,
		KeepAlive:         m.KeepAlive,
		CreatedAt:         m.CreatedAt,
		UpdatedAt:         m.UpdatedAt,
		FirstConnection:   m.FirstConnection,
		LastConnectedAt:   m.LastConnectedAt,
		EngineType:        m.EngineType,
		ProxyMode:         m.ProxyMode,
		ProxyID:           m.ProxyID,
		ProxyGroupID:      m.ProxyGroupID,
		ConnectionGroupID: m.ConnectionGroupID,
		Wid:               m.Wid,

		IzapiaSessionID:        m.IzapiaSessionID,
		IzapiaWebhookSecretEnc: m.IzapiaWebhookSecretEnc,
	}
}

func channelSessionDomainToModel(d *domain.ChannelSession) *models.Whatsapp {
	return &models.Whatsapp{
		ID:                d.ID,
		Session:           d.Session,
		Qrcode:            d.Qrcode,
		Status:            d.Status,
		Battery:           d.Battery,
		Plugged:           d.Plugged,
		Name:              d.Name,
		IsDefault:         d.IsDefault,
		Retries:           d.Retries,
		GreetingMessage:   d.GreetingMessage,
		FarewellMessage:   d.FarewellMessage,
		TenantID:          d.TenantID,
		SyncHistory:       d.SyncHistory,
		SyncPeriod:        d.SyncPeriod,
		Number:            d.Number,
		ProfilePicUrl:     d.ProfilePicUrl,
		KeepAlive:         d.KeepAlive,
		CreatedAt:         d.CreatedAt,
		UpdatedAt:         d.UpdatedAt,
		FirstConnection:   d.FirstConnection,
		LastConnectedAt:   d.LastConnectedAt,
		EngineType:        d.EngineType,
		ProxyMode:         d.ProxyMode,
		ProxyID:           d.ProxyID,
		ProxyGroupID:      d.ProxyGroupID,
		ConnectionGroupID: d.ConnectionGroupID,
		Wid:               d.Wid,

		IzapiaSessionID:        d.IzapiaSessionID,
		IzapiaWebhookSecretEnc: d.IzapiaWebhookSecretEnc,
	}
}
