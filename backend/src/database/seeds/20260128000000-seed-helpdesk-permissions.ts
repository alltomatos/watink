import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const permissions = [
            // Helpdesk (Protocols)
            { resource: "helpdesk", action: "read", description: "View helpdesk/protocols" },
            { resource: "helpdesk", action: "write", description: "Create/Edit helpdesk/protocols" },
            { resource: "helpdesk", action: "delete", description: "Delete helpdesk/protocols" },
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
                            // Insert into RolePermissions
                            await queryInterface.sequelize.query(`
                                INSERT INTO "RolePermissions" ("roleId", "permissionId", "tenantId", "createdAt", "updatedAt")
                                SELECT :roleId, :permId, :tenantId, :now, :now
                                WHERE NOT EXISTS (
                                    SELECT 1 FROM "RolePermissions" WHERE "roleId" = :roleId AND "permissionId" = :permId
                                );
                            `, {
                                replacements: { roleId, permId, tenantId: tenant.id, now: timestamp }
                            });
                        }
                    }
                }
            }
        }
    },

    down: async (queryInterface: QueryInterface) => {
        // We generally don't delete permissions in down migrations to avoid data loss on rollback, 
        // but if strictly required:
        // await queryInterface.sequelize.query(`DELETE FROM "Permissions" WHERE resource = 'helpdesk';`);
    }
};
