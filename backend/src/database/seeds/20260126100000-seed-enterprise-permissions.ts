import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const permissions = [
            // Tickets
            { resource: "tickets", action: "read", description: "View tickets" },
            { resource: "tickets", action: "write", description: "Create/Edit tickets" },
            { resource: "tickets", action: "delete", description: "Delete tickets" },

            // Contacts
            { resource: "contacts", action: "read", description: "View contacts" },
            { resource: "contacts", action: "write", description: "Create/Edit contacts" },
            { resource: "contacts", action: "delete", description: "Delete contacts" },
            { resource: "contacts", action: "import", description: "Import contacts" },
            { resource: "contacts", action: "export", description: "Export contacts" },

            // Users
            { resource: "users", action: "read", description: "View users" },
            { resource: "users", action: "write", description: "Manage users" },

            // Queues
            { resource: "queues", action: "read", description: "View queues" },
            { resource: "queues", action: "write", description: "Manage queues" },

            // QuickAnswers
            { resource: "quick_answers", action: "read", description: "View quick answers" },
            { resource: "quick_answers", action: "write", description: "Manage quick answers" },

            // Flows
            { resource: "flows", action: "read", description: "View flows" },
            { resource: "flows", action: "write", description: "Manage flows" },

            // Clients
            { resource: "clients", action: "read", description: "View clients" },
            { resource: "clients", action: "write", description: "Manage clients" },
            { resource: "clients", action: "delete", description: "Delete clients" },

            // KnowledgeBases
            { resource: "knowledge_bases", action: "read", description: "View knowledge bases" },
            { resource: "knowledge_bases", action: "write", description: "Manage knowledge bases" },

            // Tags
            { resource: "tags", action: "read", description: "View tags" },
            { resource: "tags", action: "write", description: "Manage tags" },
            { resource: "tags", action: "apply", description: "Apply tags" },

            // System
            { resource: "system", action: "settings", description: "Manage system settings" },
        ];

        const timestamp = new Date();

        // Insert permissions ignoring duplicates
        for (const p of permissions) {
            await queryInterface.sequelize.query(`
            INSERT INTO "Permissions" ("resource", "action", "description", "createdAt", "updatedAt", "isSystem")
            VALUES (:resource, :action, :description, :now, :now, true)
            ON CONFLICT ("resource", "action") DO NOTHING;
        `, {
                replacements: { ...p, now: timestamp }
            });
        }

        // Assign all permissions to 'Admin' role for all tenants
        // 1. Get all Tenants
        const tenants = await queryInterface.sequelize.query(
            `SELECT id FROM "Tenants"`,
            { type: "SELECT" }
        ) as { id: string }[];

        if (tenants.length === 0) return;

        // 2. Ensure Admin Role exists for all tenants
        for (const tenant of tenants) {
            // Create Admin Role if not exists
            await queryInterface.sequelize.query(`
            INSERT INTO "Roles" ("name", "description", "isSystem", "tenantId", "createdAt", "updatedAt")
            VALUES ('Admin', 'Administrator with full access', true, :tenantId, :now, :now)
            ON CONFLICT ("name", "tenantId") DO NOTHING;
        `, {
                replacements: { tenantId: tenant.id, now: timestamp }
            });

            // Get Admin Role ID
            const adminRole = await queryInterface.sequelize.query(
                `SELECT id FROM "Roles" WHERE "name" = 'Admin' AND "tenantId" = :tenantId`,
                { replacements: { tenantId: tenant.id }, type: "SELECT" }
            ) as { id: number }[];

            if (adminRole.length > 0) {
                const roleId = adminRole[0].id;

                // Get all permission IDs
                const allPerms = await queryInterface.sequelize.query(
                    `SELECT id FROM "Permissions"`,
                    { type: "SELECT" }
                ) as { id: number }[];

                // Map permission to Admin Role
                for (const perm of allPerms) {
                    // Check simple existence to avoid PK violation if re-running
                    // Ideally use ON CONFLICT but RolePermissions PK might be auto inc without unique constraint on (roleId, permId) yet?
                    // We didn't define unique constraint on RolePermissions(roleId, permId) in migration... let's check
                    // Actually good practice is to have it. But for now let's use insert select not exists

                    await queryInterface.sequelize.query(`
                    INSERT INTO "RolePermissions" ("roleId", "permissionId", "tenantId", "createdAt", "updatedAt")
                    SELECT :roleId, :permId, :tenantId, :now, :now
                    WHERE NOT EXISTS (
                        SELECT 1 FROM "RolePermissions" WHERE "roleId" = :roleId AND "permissionId" = :permId
                    );
                `, {
                        replacements: { roleId, permId: perm.id, tenantId: tenant.id, now: timestamp }
                    });
                }
            }
        }
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.bulkDelete("Permissions", null, {});
    }
};
