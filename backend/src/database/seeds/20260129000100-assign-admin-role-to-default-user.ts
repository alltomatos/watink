
import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // 1. Get the default user
        const adminUser = (await queryInterface.sequelize.query(
            `SELECT id, "tenantId" FROM "Users" WHERE email = 'admin@admin.com'`,
            { type: "SELECT" }
        )) as { id: number, tenantId: string }[];

        if (adminUser.length === 0) return;

        const { id: userId, tenantId } = adminUser[0];

        // 2. Get the Admin role for this tenant
        const adminRole = (await queryInterface.sequelize.query(
            `SELECT id FROM "Roles" WHERE "name" = 'Admin' AND "tenantId" = :tenantId`,
            { replacements: { tenantId }, type: "SELECT" }
        )) as { id: number }[];

        if (adminRole.length === 0) return;

        const roleId = adminRole[0].id;

        // 3. Assign Admin Role to the user
        await queryInterface.sequelize.query(`
            INSERT INTO "UserRoles" ("userId", "roleId", "tenantId", "createdAt", "updatedAt")
            SELECT :userId, :roleId, :tenantId, NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM "UserRoles" WHERE "userId" = :userId AND "roleId" = :roleId
            );
        `, {
            replacements: { userId, roleId, tenantId }
        });
    },

    down: async (queryInterface: QueryInterface) => {
        // Rollback assignment if needed
    }
};
