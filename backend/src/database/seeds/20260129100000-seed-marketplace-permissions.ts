import { QueryInterface } from "sequelize";

export default {
  up: async (queryInterface: QueryInterface) => {
    const now = new Date();

    // 1. Define Permissions
    const permissions = [
      { resource: "marketplace", action: "read", description: "Visualizar Marketplace", isSystem: true },
      { resource: "marketplace", action: "write", description: "Gerenciar Marketplace", isSystem: true },
    ];

    // 2. Insert Permissions
    for (const p of permissions) {
      // Check if exists first to avoid constraint issues if index name varies
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM "Permissions" WHERE resource = :resource AND action = :action`,
        { replacements: { resource: p.resource, action: p.action } }
      );

      if (existing.length === 0) {
        await queryInterface.sequelize.query(`
          INSERT INTO "Permissions" (resource, action, description, "createdAt", "updatedAt", "isSystem")
          VALUES (:resource, :action, :description, :now, :now, :isSystem);
        `, {
          replacements: { ...p, now }
        });
      } else {
        await queryInterface.sequelize.query(`
          UPDATE "Permissions" 
          SET description = :description, "updatedAt" = :now
          WHERE resource = :resource AND action = :action;
        `, {
          replacements: { ...p, now }
        });
      }
    }

    // 3. Assign to Admin Role
    // Get Admin Role ID
    const [roles]: any = await queryInterface.sequelize.query(
      `SELECT id, "tenantId" FROM "Roles" WHERE name = 'Admin';`
    );
    
    // Get Permission IDs
    const [dbPermissions]: any = await queryInterface.sequelize.query(
      `SELECT id FROM "Permissions" WHERE resource = 'marketplace';`
    );

    if (roles.length > 0 && dbPermissions.length > 0) {
      for (const role of roles) {
        for (const p of dbPermissions) {
          const [existingRP] = await queryInterface.sequelize.query(
            `SELECT id FROM "RolePermissions" WHERE "roleId" = :roleId AND "permissionId" = :permissionId`,
            { replacements: { roleId: role.id, permissionId: p.id } }
          );

          if (existingRP.length === 0) {
            await queryInterface.sequelize.query(`
              INSERT INTO "RolePermissions" ("roleId", "permissionId", "createdAt", "updatedAt", "tenantId")
              VALUES (:roleId, :permissionId, :now, :now, :tenantId);
            `, {
              replacements: {
                roleId: role.id,
                permissionId: p.id,
                now,
                tenantId: role.tenantId
              }
            });
          }
        }
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
     await queryInterface.sequelize.query(`
      DELETE FROM "Permissions" WHERE resource = 'marketplace';
     `);
  }
};
