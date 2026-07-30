package repository

import (
	"context"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupContactTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	return testutil.NewTestDB(t)
}

func seedTwoTenantsContacts(t *testing.T, db *gorm.DB) (tenantA, tenantB uuid.UUID, contactA, contactB *models.Contact) {
	t.Helper()
	tenantA = uuid.New()
	tenantB = uuid.New()

	require.NoError(t, db.Create(&TenantTest{ID: tenantA, Name: "Tenant A"}).Error)
	require.NoError(t, db.Create(&TenantTest{ID: tenantB, Name: "Tenant B"}).Error)

	contactA = &models.Contact{
		Name:     "Carlos A",
		Number:   "5599991111",
		Email:    "carlos@tenant-a.com",
		IsGroup:  false,
		TenantID: tenantA,
	}
	contactB = &models.Contact{
		Name:     "Diana B",
		Number:   "5599992222",
		Email:    "diana@tenant-b.com",
		IsGroup:  false,
		TenantID: tenantB,
	}
	require.NoError(t, db.Create(contactA).Error)
	require.NoError(t, db.Create(contactB).Error)
	return
}

func TestGORMContactRepo_FindByID_TenantIsolation(t *testing.T) {
	db := setupContactTestDB(t)
	tenantA, tenantB, contactA, _ := seedTwoTenantsContacts(t, db)
	repo := NewGORMContactRepo(db)
	ctx := context.Background()

	// Buscar contactA com tenantA → deve encontrar
	found, err := repo.FindByID(ctx, contactA.ID, tenantA)
	assert.NoError(t, err)
	assert.NotNil(t, found, "deveria encontrar o contato do próprio tenant")
	assert.Equal(t, "Carlos A", found.Name)

	// Buscar contactA com tenantB → deve retornar nil (isolamento)
	leaked, err := repo.FindByID(ctx, contactA.ID, tenantB)
	assert.NoError(t, err)
	assert.Nil(t, leaked, "VAZAMENTO DE DADOS: encontrou contato de outro tenant via FindByID")
}

func TestGORMContactRepo_Find_TenantIsolation(t *testing.T) {
	db := setupContactTestDB(t)
	tenantA, tenantB, _, _ := seedTwoTenantsContacts(t, db)
	repo := NewGORMContactRepo(db)
	ctx := context.Background()

	// Find vazio tenantA → só Carlos
	contactsA, err := repo.Find(ctx, tenantA, "")
	assert.NoError(t, err)
	assert.Len(t, contactsA, 1, "tenantA deveria ter exatamente 1 contato")
	assert.Equal(t, "Carlos A", contactsA[0].Name)

	// Find vazio tenantB → só Diana
	contactsB, err := repo.Find(ctx, tenantB, "")
	assert.NoError(t, err)
	assert.Len(t, contactsB, 1, "tenantB deveria ter exatamente 1 contato")
	assert.Equal(t, "Diana B", contactsB[0].Name)
}

func TestGORMContactRepo_FindByNumber_TenantIsolation(t *testing.T) {
	db := setupContactTestDB(t)
	tenantA, tenantB, contactA, _ := seedTwoTenantsContacts(t, db)
	repo := NewGORMContactRepo(db)
	ctx := context.Background()

	// Buscar número do tenantA com tenantA → deve encontrar
	found, err := repo.FindByNumber(ctx, tenantA, contactA.Number, false)
	assert.NoError(t, err)
	assert.NotNil(t, found, "deveria encontrar contato pelo número no tenant correto")

	// Buscar número do tenantA com tenantB → nil (isolamento)
	leaked, err := repo.FindByNumber(ctx, tenantB, contactA.Number, false)
	assert.NoError(t, err)
	assert.Nil(t, leaked, "VAZAMENTO DE DADOS: encontrou contato de outro tenant via FindByNumber")
}

func TestGORMContactRepo_Delete_TenantIsolation(t *testing.T) {
	db := setupContactTestDB(t)
	tenantA, tenantB, contactA, _ := seedTwoTenantsContacts(t, db)
	repo := NewGORMContactRepo(db)
	ctx := context.Background()

	// Tentar deletar contactA usando tenantB → não deve afetar
	err := repo.Delete(ctx, contactA.ID, tenantB)
	assert.NoError(t, err, "delete com tenant errado não deveria causar erro do GORM")

	// contactA ainda deve existir para tenantA
	found, err := repo.FindByID(ctx, contactA.ID, tenantA)
	assert.NoError(t, err)
	assert.NotNil(t, found, "delete com tenant errado não deveria ter removido o contato")

	// Deletar com tenant correto
	err = repo.Delete(ctx, contactA.ID, tenantA)
	assert.NoError(t, err)

	found, err = repo.FindByID(ctx, contactA.ID, tenantA)
	assert.NoError(t, err)
	assert.Nil(t, found, "contato deveria ter sido removido após delete com tenant correto")
}

func TestGORMContactRepo_Update_TenantIsolation(t *testing.T) {
	db := setupContactTestDB(t)
	tenantA, tenantB, contactA, _ := seedTwoTenantsContacts(t, db)
	repo := NewGORMContactRepo(db)
	ctx := context.Background()

	// Tentar update com tenant errado
	domainContact := &domain.Contact{
		ID:       contactA.ID,
		TenantID: tenantB,
	}
	fields := map[string]interface{}{"name": "Hacked Contact"}
	err := repo.Update(ctx, domainContact, fields)
	assert.NoError(t, err, "update com tenant errado não deve causar erro GORM")

	// contactA não deve ter sido alterado
	found, err := repo.FindByID(ctx, contactA.ID, tenantA)
	assert.NoError(t, err)
	assert.NotNil(t, found)
	assert.Equal(t, "Carlos A", found.Name, "update com tenant errado não deveria alterar o nome")

	// Update com tenant correto
	domainContact.TenantID = tenantA
	err = repo.Update(ctx, domainContact, map[string]interface{}{"name": "Carlos Updated"})
	assert.NoError(t, err)

	found, err = repo.FindByID(ctx, contactA.ID, tenantA)
	assert.NoError(t, err)
	assert.NotNil(t, found)
	assert.Equal(t, "Carlos Updated", found.Name, "update com tenant correto deveria alterar o nome")
}

func TestGORMContactRepo_FindByLID(t *testing.T) {
	db := setupContactTestDB(t)
	tenantA, tenantB, _, _ := seedTwoTenantsContacts(t, db)
	repo := NewGORMContactRepo(db)
	ctx := context.Background()

	lid := "lid-abc123"
	c := &models.Contact{
		Name:     "LID Contact",
		Number:   "5599009900",
		TenantID: tenantA,
		Lid:      &lid,
	}
	require.NoError(t, db.Create(c).Error)

	// FindByLID com tenant correto
	found, err := repo.FindByLID(ctx, tenantA, lid, false)
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, "LID Contact", found.Name)

	// FindByLID com tenant errado → nil (isolamento)
	leaked, err := repo.FindByLID(ctx, tenantB, lid, false)
	require.NoError(t, err)
	assert.Nil(t, leaked, "FindByLID com tenant errado deve retornar nil")

	// FindByLID com LID inexistente → nil
	notFound, err := repo.FindByLID(ctx, tenantA, "nonexistent-lid", false)
	require.NoError(t, err)
	assert.Nil(t, notFound)
}

func TestGORMContactRepo_Create(t *testing.T) {
	db := setupContactTestDB(t)
	tenantA, _, _, _ := seedTwoTenantsContacts(t, db)
	repo := NewGORMContactRepo(db)
	ctx := context.Background()

	contact := &domain.Contact{
		Name:     "New Contact",
		Number:   "5599887766",
		Email:    "new@tenant-a.com",
		TenantID: tenantA,
	}
	err := repo.Create(ctx, contact)
	require.NoError(t, err)

	found, err := repo.FindByNumber(ctx, tenantA, "5599887766", false)
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, "New Contact", found.Name)
	assert.Equal(t, tenantA, found.TenantID)
}

func TestGORMContactRepo_FindOrCreate_TenantIsolation(t *testing.T) {
	db := setupContactTestDB(t)
	tenantA, _, _, _ := seedTwoTenantsContacts(t, db)
	repo := NewGORMContactRepo(db)
	ctx := context.Background()

	// FindOrCreate com novo número → deve criar no tenant correto
	created, err := repo.FindOrCreate(ctx, tenantA, "5599993333", "New Contact", "", false, false, "")
	assert.NoError(t, err)
	assert.NotNil(t, created, "FindOrCreate deveria retornar o contato criado")
	assert.Equal(t, "New Contact", created.Name)
	assert.Equal(t, tenantA, created.TenantID)

	// FindOrCreate com mesmo número e tenantA → deve retornar existente
	found, err := repo.FindOrCreate(ctx, tenantA, "5599993333", "Other Name", "", false, false, "")
	assert.NoError(t, err)
	assert.NotNil(t, found)
	assert.Equal(t, created.ID, found.ID, "FindOrCreate deveria retornar o mesmo contato")
}

func TestGORMContactRepo_FindOrCreate_RefreshesExpiredProfilePicUrl(t *testing.T) {
	db := setupContactTestDB(t)
	tenantA, _, _, _ := seedTwoTenantsContacts(t, db)
	repo := NewGORMContactRepo(db)
	ctx := context.Background()

	created, err := repo.FindOrCreate(ctx, tenantA, "5599994444", "Ana", "https://cdn.example.com/old.jpg", false, false, "")
	require.NoError(t, err)
	require.Equal(t, "https://cdn.example.com/old.jpg", created.ProfilePicUrl)

	// URL da CDN expirou e uma nova chega -- deve substituir a antiga, não
	// ficar travada porque o campo já estava preenchido.
	updated, err := repo.FindOrCreate(ctx, tenantA, "5599994444", "Ana", "https://cdn.example.com/new.jpg", false, false, "")
	require.NoError(t, err)
	assert.Equal(t, "https://cdn.example.com/new.jpg", updated.ProfilePicUrl)
}

func TestGORMContactRepo_FindOrCreate_NeverErasesProfilePicUrlWithEmpty(t *testing.T) {
	db := setupContactTestDB(t)
	tenantA, _, _, _ := seedTwoTenantsContacts(t, db)
	repo := NewGORMContactRepo(db)
	ctx := context.Background()

	created, err := repo.FindOrCreate(ctx, tenantA, "5599995555", "Bruno", "https://cdn.example.com/pic.jpg", false, false, "")
	require.NoError(t, err)
	require.Equal(t, "https://cdn.example.com/pic.jpg", created.ProfilePicUrl)

	// Falha transitória de busca de foto chega como string vazia -- nunca
	// deve apagar a URL já persistida.
	updated, err := repo.FindOrCreate(ctx, tenantA, "5599995555", "Bruno", "", false, false, "")
	require.NoError(t, err)
	assert.Equal(t, "https://cdn.example.com/pic.jpg", updated.ProfilePicUrl)
}
