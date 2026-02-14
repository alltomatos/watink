import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // 1. Find admin user
        const users = await queryInterface.sequelize.query(
            `SELECT id, "tenantId" FROM "Users" WHERE email = 'admin@admin.com' LIMIT 1;`
        );

        if ((users[0] as any[]).length === 0) {
            console.log("User admin@admin.com not found. Skipping Admin Group seed.");
            return;
        }

        const user = (users[0] as any[])[0];
        let tenantId = user.tenantId;

        // 2. If user has no tenant, try to find default tenant
        if (!tenantId) {
            const tenants = await queryInterface.sequelize.query(
                `SELECT id FROM "Tenants" LIMIT 1;`
            );
            if ((tenants[0] as any[]).length > 0) {
                tenantId = (tenants[0] as any[])[0].id;
            }
        }

        if (!tenantId) {
            console.log("No tenant found. Skipping Admin Group seed.");
            return;
        }

        // 3. Find or Create Admin Group
        let groupId;
        const groups = await queryInterface.sequelize.query(
            `SELECT id FROM "Groups" WHERE name = 'Admin' AND "tenantId" = '${tenantId}' LIMIT 1;`
        );

        if ((groups[0] as any[]).length > 0) {
            groupId = (groups[0] as any[])[0].id;
        } else {
            const now = new Date();
            await queryInterface.bulkInsert("Groups", [{
                name: "Admin",
                tenantId: tenantId,
                createdAt: now,
                updatedAt: now
            }]);

            // Fetch the created group ID
            const newGroups = await queryInterface.sequelize.query(
                `SELECT id FROM "Groups" WHERE name = 'Admin' AND "tenantId" = '${tenantId}' LIMIT 1;`
            );
            groupId = (newGroups[0] as any[])[0].id;
        }

        // 4. Update User to belong to this Group
        await queryInterface.sequelize.query(
            `UPDATE "Users" SET "groupId" = ${groupId} WHERE id = ${user.id}`
        );

        // 5. Get All Permissions
        const permissions = await queryInterface.sequelize.query(
            `SELECT id FROM "Permissions"`
        );
        const allPermissions = (permissions[0] as any[]);

        // 6. Associate All Permissions to the Group
        // We can just bulk insert and ignore duplicates if possible, or check what's missing.
        // Simpler approach for seed: Fetch existing group permissions and filter.

        const existingGroupPermissions = await queryInterface.sequelize.query(
            `SELECT "permissionId" FROM "GroupPermissions" WHERE "groupId" = ${groupId}`
        );
        const existingPermIds = (existingGroupPermissions[0] as any[]).map(p => p.permissionId);

        const newGroupPermissions = allPermissions
            .filter(p => !existingPermIds.includes(p.id))
            .map(p => ({
                groupId: groupId,
                permissionId: p.id,
                tenantId: tenantId,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

        if (newGroupPermissions.length > 0) {
            await queryInterface.bulkInsert("GroupPermissions", newGroupPermissions);
        }
    },

    down: async (queryInterface: QueryInterface) => {
        // Reverting this is tricky without affecting manual changes. 
        // Generally seeds don't need strict down logic if they are just data population.
    }
};
