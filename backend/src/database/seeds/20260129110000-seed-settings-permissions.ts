import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const permissions = [
      { resource: "settings", action: "read", description: "View settings" },
      { resource: "settings", action: "edit", description: "Edit settings" }
    ];

    const timestamp = new Date();

    // 1. Insert permissions
    for (const p of permissions) {
      await queryInterface.sequelize.query(`
        INSERT INTO "Permissions" ("resource", "action", "description", "createdAt", "updatedAt", "isSystem")
        VALUES (:resource, :action, :description, :now, :now, true)
        ON CONFLICT ("resource", "action") DO NOTHING;
      `, {
        replacements: { ...p, now: timestamp }
      });
    }

    // 2. Assign to Admin role for all tenants
    const tenants = await queryInterface.sequelize.query(
      `SELECT id FROM "Tenants"`,
      { type: "SELECT" }
    ) as { id: string }[];

    if (tenants.length === 0) return;

    for (const tenant of tenants) {
      // Get Admin Role ID
      const adminRole = await queryInterface.sequelize.query(
        `SELECT id FROM "Roles" WHERE "name" = 'Admin' AND "tenantId" = :tenantId`,
        { replacements: { tenantId: tenant.id }, type: "SELECT" }
      ) as { id: number }[];

      if (adminRole.length > 0) {
        const roleId = adminRole[0].id;

        // Get IDs of new permissions
        const newPerms = await queryInterface.sequelize.query(
          `SELECT id FROM "Permissions" WHERE resource = 'settings' AND action IN ('read', 'edit')`,
          { type: "SELECT" }
        ) as { id: number }[];

        for (const perm of newPerms) {
          await queryInterface.sequelize.query(`
            INSERT INTO "RolePermissions" ("roleId", "permissionId", "tenantId", "createdAt", "updatedAt")
            VALUES (:roleId, :permissionId, :tenantId, :now, :now)
            ON CONFLICT ("roleId", "permissionId") DO NOTHING;
          `, {
            replacements: { roleId, permissionId: perm.id, tenantId: tenant.id, now: timestamp }
          });
        }
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
    // Optional: remove permissions
  }
};
