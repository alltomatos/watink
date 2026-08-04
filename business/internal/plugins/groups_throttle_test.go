package plugins

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGroupsThrottle_AllowsUpToLimit(t *testing.T) {
	th := newGroupsThrottle()
	th.limit = 3
	tenant := uuid.New()

	for i := 0; i < 3; i++ {
		assert.True(t, th.Allow(tenant, 1), "call %d should be allowed", i+1)
	}
	assert.False(t, th.Allow(tenant, 1), "4th call within the window must be rejected")
}

func TestGroupsThrottle_DifferentConnectionsAreIndependent(t *testing.T) {
	th := newGroupsThrottle()
	th.limit = 1
	tenant := uuid.New()

	assert.True(t, th.Allow(tenant, 1))
	assert.False(t, th.Allow(tenant, 1), "connection 1 is now over budget")
	assert.True(t, th.Allow(tenant, 2), "connection 2 must not be affected by connection 1's usage")
}

func TestGroupsThrottle_DifferentTenantsAreIndependent(t *testing.T) {
	th := newGroupsThrottle()
	th.limit = 1
	tenantA := uuid.New()
	tenantB := uuid.New()

	assert.True(t, th.Allow(tenantA, 1))
	assert.False(t, th.Allow(tenantA, 1))
	assert.True(t, th.Allow(tenantB, 1), "tenant B must not share tenant A's bucket even for the same whatsappID")
}

func TestGroupsThrottle_WindowResets(t *testing.T) {
	th := newGroupsThrottle()
	th.limit = 1
	th.window = 0 // any elapsed time resets the window immediately
	tenant := uuid.New()

	assert.True(t, th.Allow(tenant, 1))
	assert.True(t, th.Allow(tenant, 1), "a zero-width window must always reset before the next call")
}
