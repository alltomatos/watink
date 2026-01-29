import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const permissions = [
            // Dashboard
            { resource: "dashboard", action: "read", description: "View dashboard" },

            // Pipelines
            { resource: "pipelines", action: "read", description: "View pipelines" },
            { resource: "pipelines", action: "write", description: "Manage pipelines" },

            // Groups
          { resource: "groups", action: "read", description: "View groups" },
          { resource: "groups", action: "write", description: "Manage groups" },
          // Marketplace
          { resource: "marketplace", action: "read", description: "View marketplace" },
          { resource: "marketplace", action: "write", description: "Manage marketplace" },

            // Connections
            { resource: "connections", action: "read", description: "View connections" },
            { resource: "connections", action: "write", description: "Manage connections" },

            // Swagger
            { resource: "swagger", action: "read", description: "View swagger docs" },

            // Settings (Standardizing)
            { resource: "settings", action: "read", description: "View settings" },
            { resource: "settings", action: "write", description: "Manage settings" },
        ];

        const timestamp = new Date();

        // 1. Insert permissions ignoring duplicates
        for (const p of permissions) {
            await queryInterface.sequelize.query(`
                INSERT INTO "Permissions" ("resource", "action", "description", "createdAt", "updatedAt", "isSystem")
                VALUES (:resource, :action, :description, :createdAt, :updatedAt, false)
                ON CONFLICT ("resource", "action") DO NOTHING;
            `, {
                replacements: {
                    resource: p.resource,
                    action: p.action,
                    description: p.description,
                    createdAt: timestamp,
                    updatedAt: timestamp
                }
            });
        }

        // 2. Assign permissions to Admin role for all tenants
        const tenants = await queryInterface.sequelize.query(
            `SELECT id FROM "Tenants"`,
            { type: "SELECT" }
        ) as { id: string }[];

        if (tenants.length > 0) {
            for (const tenant of tenants) {
                // Get Admin Role ID
                const adminRole = await queryInterface.sequelize.query(
                    `SELECT id FROM "Roles" WHERE "name" = 'Admin' AND "tenantId" = :tenantId`,
                    { replacements: { tenantId: tenant.id }, type: "SELECT" }
                ) as { id: number }[];

                if (adminRole.length > 0) {
                    const roleId = adminRole[0].id;

                    for (const p of permissions) {
                        // Get Permission ID
                        const perm = await queryInterface.sequelize.query(
                            `SELECT id FROM "Permissions" WHERE "resource" = :resource AND "action" = :action`,
                            { replacements: { resource: p.resource, action: p.action }, type: "SELECT" }
                        ) as { id: number }[];

                        if (perm.length > 0) {
                            const permId = perm[0].id;

                            // Assign permission to role if not exists
                            await queryInterface.sequelize.query(`
                                INSERT INTO "RolePermissions" ("roleId", "permissionId", "tenantId", "createdAt", "updatedAt")
                                SELECT :roleId, :permId, :tenantId, :now, :now
                                WHERE NOT EXISTS (SELECT 1 FROM "RolePermissions" WHERE "roleId" = :roleId AND "permissionId" = :permId);
                            `, {
                                replacements: {
                                    roleId,
                                    permId,
                                    tenantId: tenant.id,
                                    now: timestamp
                                }
                            });
                        }
                    }
                }
            }
        }
    },

    down: async (queryInterface: QueryInterface) => {
        // We usually don't remove permissions in down migrations to avoid breaking existing data
        // unless strictly necessary.
    }
};
