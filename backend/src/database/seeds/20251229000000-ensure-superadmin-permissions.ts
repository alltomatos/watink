import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // 1. Find the admin user
        const users = await queryInterface.sequelize.query(
            `SELECT id, "tenantId" FROM "Users" WHERE email = 'admin@admin.com' LIMIT 1;`
        );

        if ((users[0] as any[]).length === 0) {
            console.log("User admin@admin.com not found. Skipping Ensure Super Admin Permissions seed.");
            return;
        }

        const user = (users[0] as any[])[0];
        const tenantId = user.tenantId;

        if (!tenantId) {
            console.log("User admin@admin.com has no tenantId. Skipping.");
            return;
        }

        // 2. Fetch all permissions
        const permissions = await queryInterface.sequelize.query(
            `SELECT id FROM "Permissions";`
        );
        const allPermissions = (permissions[0] as any[]);

        if (allPermissions.length === 0) {
            console.log("No permissions found to assign.");
            return;
        }

        // 3. Fetch existing user permissions to avoid duplicates
        const existingUserPermissions = await queryInterface.sequelize.query(
            `SELECT "permissionId" FROM "UserPermissions" WHERE "userId" = ${user.id}`
        );
        const existingPermIds = (existingUserPermissions[0] as any[]).map(p => p.permissionId);

        // 4. Filter out permissions the user already has
        const newPermissions = allPermissions
            .filter(p => !existingPermIds.includes(p.id))
            .map(p => ({
                userId: user.id,
                permissionId: p.id,
                tenantId: tenantId,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

        if (newPermissions.length > 0) {
            await queryInterface.bulkInsert("UserPermissions", newPermissions);
            console.log(`Assigned ${newPermissions.length} new permissions to admin@admin.com`);
        } else {
            console.log("admin@admin.com already has all permissions.");
        }
    },

    down: async (queryInterface: QueryInterface) => {
        // Strictly speaking, we might not want to remove permissions on down
        // as they might have been manually assigned.
        // Keeping empty for safety.
    }
};
