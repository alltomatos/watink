import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import Role from "../../models/Role";
import User from "../../models/User";
import Permission from "../../models/Permission";
import { RedisService } from "../../services/RedisService";

interface PermissionResult {
    authorized: boolean;
    scope?: any;
}

class PermissionService {
    private readonly CACHE_TTL = 60 * 5; // 5 minutes

    /**
     * Get all effective permissions for a user including scopes
     */
    async getUserPermissions(userId: number, tenantId: string | number): Promise<any[]> {
        const cacheKey = `perms:${tenantId}:${userId}`;
        const redis = RedisService.getInstance();

        // Try cache first
        const cached = await redis.getValue(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        let permissions: any[] = [];

        const user = await User.findByPk(userId, {
            include: [
                {
                    model: Role,
                    through: {
                        where: { tenantId }
                    },
                    include: [{
                        model: Permission,
                        as: "permissions"
                    }]
                },
                {
                    model: Permission,
                    as: "permissions",
                    through: {
                        where: { tenantId }
                    }
                }
            ]
        });

        if (user) {
            // 1. Get permissions from Roles
            if (user.roles) {
                const isAdmin = user.roles.some(r => r.name === "Admin");

                if (isAdmin) {
                    const allPermissions = await Permission.findAll();
                    permissions = allPermissions.map(p => ({
                        resource: p.resource,
                        action: p.action,
                        scope: null,
                        conditions: null
                    }));
                    // Admin has all permissions, return immediately
                    await redis.setValue(cacheKey, JSON.stringify(permissions), "EX", this.CACHE_TTL);
                    return permissions;
                }

                user.roles.forEach(role => {
                    if (role.permissions) {
                        role.permissions.forEach(permission => {
                            permissions.push({
                                resource: permission.resource,
                                action: permission.action,
                                scope: (permission as any).RolePermission?.scope,
                                conditions: (permission as any).RolePermission?.conditions
                            });
                        });
                    }
                });
            }

            // 2. Get direct permissions
            if (user.permissions) {
                user.permissions.forEach(permission => {
                    permissions.push({
                        resource: permission.resource,
                        action: permission.action,
                        scope: (permission as any).UserPermission?.scope,
                        conditions: (permission as any).UserPermission?.conditions
                    });
                });
            }
        }

        // Cache results
        await redis.setValue(cacheKey, JSON.stringify(permissions), "EX", this.CACHE_TTL);

        return permissions;
    }

    /**
     * Check if a user has a specific permission
     * Uses hierarchical check: required "tickets:read" is granted by "tickets:read", "tickets:*", or "*:*"
     */
    async check(userId: number, tenantId: string | number, requiredResource: string, requiredAction: string): Promise<PermissionResult> {
        const permissions = await this.getUserPermissions(userId, tenantId);

        // Check for exact match or wildcards
        const matchingPerms = permissions.filter(p => {
            const resourceMatch = p.resource === "*" || p.resource === requiredResource;
            const actionMatch = p.action === "*" || p.action === requiredAction;
            return resourceMatch && actionMatch;
        });

        if (matchingPerms.length > 0) {
            // Merge scopes if needed (simple merge for now)
            // In a real scenario, you might want to unite scopes (e.g. queue [1,2] + queue [3] = [1,2,3])
            // For now, return the first valid scope found or null if global
            return {
                authorized: true,
                scope: matchingPerms[0].scope
            };
        }

        return { authorized: false };
    }
}

export default new PermissionService();
