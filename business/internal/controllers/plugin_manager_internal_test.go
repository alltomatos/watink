package controllers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type instanceStatsResponse struct {
	Users            int64  `json:"users"`
	Connections      int64  `json:"connections"`
	MessagesSent     int64  `json:"messagesSent"`
	MessagesReceived int64  `json:"messagesReceived"`
	GitCommit        string `json:"gitCommit"`
	GitBranch        string `json:"gitBranch"`
	DbEngine         string `json:"dbEngine"`
	Admins           []struct {
		TenantName string `json:"tenantName"`
		OwnerEmail string `json:"ownerEmail"`
	} `json:"admins"`
}

func TestInstanceStats_SemDados_DevolveZeros(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testutil.NewTestDB(t)
	ctrl := NewPluginManagerInternalController(db, BuildInfo{GitCommit: "abc1234", GitBranch: "develop", GitCommitDate: "2026-08-01T00:00:00Z"})

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/internal/plugin-manager/instance-stats", nil)

	ctrl.InstanceStats(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var result instanceStatsResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.Equal(t, int64(0), result.Users)
	assert.Equal(t, int64(0), result.Connections)
	assert.Equal(t, int64(0), result.MessagesSent)
	assert.Equal(t, int64(0), result.MessagesReceived)
	assert.Len(t, result.Admins, 0)
	assert.Equal(t, "abc1234", result.GitCommit)
	assert.Equal(t, "develop", result.GitBranch)
	assert.Equal(t, "PostgreSQL", result.DbEngine)
}

func TestInstanceStats_SomaTodosOsTenants(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testutil.NewTestDB(t)
	ctrl := NewPluginManagerInternalController(db, BuildInfo{GitCommit: "abc1234", GitBranch: "develop", GitCommitDate: "2026-08-01T00:00:00Z"})

	tenantA := models.Tenant{ID: uuid.New(), Name: "Tenant A"}
	require.NoError(t, db.Create(&tenantA).Error)
	tenantB := models.Tenant{ID: uuid.New(), Name: "Tenant B"}
	require.NoError(t, db.Create(&tenantB).Error)

	ownerA := models.User{Name: "Owner A", Email: "owner-a@example.com", PasswordHash: "x", TenantID: tenantA.ID}
	require.NoError(t, db.Create(&ownerA).Error)
	db.Model(&tenantA).Update("ownerId", ownerA.ID)

	userB := models.User{Name: "User B", Email: "user-b@example.com", PasswordHash: "x", TenantID: tenantB.ID}
	require.NoError(t, db.Create(&userB).Error)

	require.NoError(t, db.Create(&models.Whatsapp{Name: "conn-a", TenantID: tenantA.ID}).Error)
	require.NoError(t, db.Create(&models.Whatsapp{Name: "conn-b", TenantID: tenantB.ID}).Error)

	require.NoError(t, db.Create(&models.Message{ID: "m1", Body: "oi", TicketID: 1, FromMe: true, TenantID: tenantA.ID}).Error)
	require.NoError(t, db.Create(&models.Message{ID: "m2", Body: "oi", TicketID: 1, FromMe: false, TenantID: tenantA.ID}).Error)
	require.NoError(t, db.Create(&models.Message{ID: "m3", Body: "oi", TicketID: 2, FromMe: false, TenantID: tenantB.ID}).Error)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/internal/plugin-manager/instance-stats", nil)

	ctrl.InstanceStats(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var result instanceStatsResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.Equal(t, int64(2), result.Users)
	assert.Equal(t, int64(2), result.Connections)
	assert.Equal(t, int64(1), result.MessagesSent)
	assert.Equal(t, int64(2), result.MessagesReceived)
	require.Len(t, result.Admins, 2)

	emails := map[string]string{}
	for _, admin := range result.Admins {
		emails[admin.TenantName] = admin.OwnerEmail
	}
	assert.Equal(t, "owner-a@example.com", emails["Tenant A"])
	assert.Equal(t, "", emails["Tenant B"])
}
