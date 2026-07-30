package izapia

import (
	"context"
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestProvider_GetContactPictureURL_CacheHitSkipsClient(t *testing.T) {
	db := testutil.NewTestDB(t)
	p := New(db, nil)

	sid := "sess-1"
	w := models.Whatsapp{ID: 1, TenantID: uuid.New(), IzapiaSessionID: &sid}

	// Pre-seed the cache directly -- a cache hit must return immediately
	// without ever calling clientFor (which would fail here: no
	// IzapiaConfig row exists for this tenant).
	cacheKey := "1:5511999990002@s.whatsapp.net"
	p.picCacheMu.Lock()
	p.picCache[cacheKey] = picCacheEntry{
		url:       "https://cached.example.com/pic.jpg",
		expiresAt: time.Now().Add(picCacheTTL),
	}
	p.picCacheMu.Unlock()

	got := p.GetContactPictureURL(context.Background(), w, "5511999990002@s.whatsapp.net")
	assert.Equal(t, "https://cached.example.com/pic.jpg", got)
}

func TestProvider_GetContactPictureURL_ExpiredCacheIsNotUsed(t *testing.T) {
	db := testutil.NewTestDB(t)
	p := New(db, nil)

	sid := "sess-1"
	w := models.Whatsapp{ID: 1, TenantID: uuid.New(), IzapiaSessionID: &sid}

	cacheKey := "1:5511999990003@s.whatsapp.net"
	p.picCacheMu.Lock()
	p.picCache[cacheKey] = picCacheEntry{
		url:       "https://stale.example.com/pic.jpg",
		expiresAt: time.Now().Add(-time.Minute), // already expired
	}
	p.picCacheMu.Unlock()

	// Falls through to clientFor, which fails (no IzapiaConfig seeded for
	// this tenant) -- must return "" gracefully, never the stale cached URL.
	got := p.GetContactPictureURL(context.Background(), w, "5511999990003@s.whatsapp.net")
	assert.Equal(t, "", got, "an expired cache entry must not be returned")
}

func TestProvider_GetContactPictureURL_NoSessionID_ReturnsEmpty(t *testing.T) {
	db := testutil.NewTestDB(t)
	p := New(db, nil)

	w := models.Whatsapp{ID: 1, TenantID: uuid.New(), IzapiaSessionID: nil}

	got := p.GetContactPictureURL(context.Background(), w, "5511999990004@s.whatsapp.net")
	assert.Equal(t, "", got)
}

func TestProvider_GetContactPictureURL_EmptyJID_ReturnsEmpty(t *testing.T) {
	db := testutil.NewTestDB(t)
	p := New(db, nil)

	sid := "sess-1"
	w := models.Whatsapp{ID: 1, TenantID: uuid.New(), IzapiaSessionID: &sid}

	got := p.GetContactPictureURL(context.Background(), w, "")
	assert.Equal(t, "", got)
}
