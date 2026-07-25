package repository

import (
	"context"
	"errors"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var _ domain.QueueRepository = (*GORMQueueRepository)(nil)

type GORMQueueRepository struct {
	db *gorm.DB
}

func NewGORMQueueRepo(db *gorm.DB) *GORMQueueRepository {
	return &GORMQueueRepository{db: db}
}

// FindQueueIDsByChannel returns the queue IDs linked to the given channel via the
// whatsapp_queues join table. The join table uses snake_case columns
// (whatsapp_id, queue_id) created by GORM's many2many default naming.
func (r *GORMQueueRepository) FindQueueIDsByChannel(ctx context.Context, channelID int, tenantID uuid.UUID) ([]int, error) {
	var ids []int
	err := r.db.WithContext(ctx).
		Table("whatsapp_queues AS wq").
		Joins(`JOIN "Queues" q ON q.id = wq.queue_id`).
		Where(`wq.whatsapp_id = ? AND q."tenantId" = ?`, channelID, tenantID).
		Pluck("wq.queue_id", &ids).Error
	if err != nil {
		return nil, err
	}
	return ids, nil
}

func (r *GORMQueueRepository) FindByID(ctx context.Context, id int, tenantID uuid.UUID) (*domain.Queue, error) {
	var m models.Queue
	err := r.db.WithContext(ctx).
		Where("id = ? AND \"tenantId\" = ?", id, tenantID).
		First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return queueModelToDomain(&m), nil
}

func (r *GORMQueueRepository) FindByIDWithAssociations(ctx context.Context, id int, tenantID uuid.UUID) (*domain.Queue, error) {
	var m models.Queue
	err := r.db.WithContext(ctx).
		Where("id = ? AND \"tenantId\" = ?", id, tenantID).
		Preload("Whatsapps").
		First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return queueModelWithAssocToDomain(&m), nil
}

func (r *GORMQueueRepository) FindAll(ctx context.Context, tenantID uuid.UUID) ([]domain.Queue, error) {
	var m []models.Queue
	err := r.db.WithContext(ctx).
		Where("\"tenantId\" = ?", tenantID).
		Find(&m).Error
	if err != nil {
		return nil, err
	}
	var queues []domain.Queue
	for _, q := range m {
		queues = append(queues, *queueModelToDomain(&q))
	}
	return queues, nil
}

func (r *GORMQueueRepository) FindAllWithAssociations(ctx context.Context, tenantID uuid.UUID) ([]domain.Queue, error) {
	var m []models.Queue
	err := r.db.WithContext(ctx).
		Where("\"tenantId\" = ?", tenantID).
		Preload("Whatsapps").
		Order("COALESCE(\"parentId\", id), \"parentId\" IS NOT NULL, name ASC").
		Find(&m).Error
	if err != nil {
		return nil, err
	}
	var queues []domain.Queue
	for _, q := range m {
		queues = append(queues, *queueModelWithAssocToDomain(&q))
	}
	return queues, nil
}

func (r *GORMQueueRepository) Create(ctx context.Context, queue *domain.Queue, whatsappIDs []int) error {
	m := queueDomainToModel(queue)

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(m).Error; err != nil {
			return err
		}
		// Update domain ID after creation
		queue.ID = m.ID

		if len(whatsappIDs) > 0 {
			var whatsapps []models.Whatsapp
			if err := tx.Where("id IN ? AND \"tenantId\" = ?", whatsappIDs, queue.TenantID).Find(&whatsapps).Error; err != nil {
				return err
			}
			if err := tx.Model(m).Association("Whatsapps").Replace(&whatsapps); err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *GORMQueueRepository) Update(ctx context.Context, queue *domain.Queue, fields map[string]interface{}, whatsappIDs []int) error {
	m := queueDomainToModel(queue)

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(m).Updates(fields).Error; err != nil {
			return err
		}

		// Update Whatsapps association
		var whatsapps []models.Whatsapp
		if len(whatsappIDs) > 0 {
			if err := tx.Where("id IN ? AND \"tenantId\" = ?", whatsappIDs, queue.TenantID).Find(&whatsapps).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(m).Association("Whatsapps").Replace(&whatsapps); err != nil {
			return err
		}

		return nil
	})
}

func (r *GORMQueueRepository) Save(ctx context.Context, queue *domain.Queue) error {
	m := queueDomainToModel(queue)
	return r.db.WithContext(ctx).Save(m).Error
}

func (r *GORMQueueRepository) Delete(ctx context.Context, id int, tenantID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("id = ? AND \"tenantId\" = ?", id, tenantID).
		Delete(&models.Queue{}).Error
}

// --- Model <-> Domain mappers ---

func queueModelToDomain(m *models.Queue) *domain.Queue {
	return &domain.Queue{
		ID:                   m.ID,
		Name:                 m.Name,
		Color:                m.Color,
		GreetingMessage:      m.GreetingMessage,
		DistributionStrategy: m.DistributionStrategy,
		PrioritizeWallet:     m.PrioritizeWallet,
		ParentID:             m.ParentID,
		TenantID:             m.TenantID,
		CreatedAt:            m.CreatedAt,
		UpdatedAt:            m.UpdatedAt,
	}
}

func queueModelWithAssocToDomain(m *models.Queue) *domain.Queue {
	d := queueModelToDomain(m)
	// Map associated Whatsapp sessions to domain ChannelSession references
	for _, w := range m.Whatsapps {
		d.Whatsapps = append(d.Whatsapps, domain.QueueWhatsapp{
			ID:     w.ID,
			Name:   w.Name,
			Status: w.Status,
			Number: w.Number,
		})
	}
	return d
}

func queueDomainToModel(d *domain.Queue) *models.Queue {
	return &models.Queue{
		ID:                   d.ID,
		Name:                 d.Name,
		Color:                d.Color,
		GreetingMessage:      d.GreetingMessage,
		DistributionStrategy: d.DistributionStrategy,
		PrioritizeWallet:     d.PrioritizeWallet,
		ParentID:             d.ParentID,
		TenantID:             d.TenantID,
		CreatedAt:            d.CreatedAt,
		UpdatedAt:            d.UpdatedAt,
	}
}
