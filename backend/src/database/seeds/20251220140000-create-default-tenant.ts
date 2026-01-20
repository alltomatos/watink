import { QueryInterface } from "sequelize";
import { v4 as uuidv4 } from "uuid";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tenants = await queryInterface.sequelize.query(
      `SELECT id FROM "Tenants" LIMIT 1;`
    );

    let tenantId;

    if (tenants[0].length === 0) {
      tenantId = process.env.DEFAULT_TENANT_UUID || uuidv4();
      await queryInterface.bulkInsert("Tenants", [
        {
          id: tenantId,
          name: "Default Tenant",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    } else {
      tenantId = (tenants[0][0] as any).id;
    }

    // Update existing users to belong to this tenant
    await queryInterface.sequelize.query(
      `UPDATE "Users" SET "tenantId" = '${tenantId}' WHERE "tenantId" IS NULL;`
    );
  },

  down: async (queryInterface: QueryInterface) => {
    // We don't want to delete the tenant on down if it has data, but for completeness:
    // await queryInterface.bulkDelete("Tenants", {});
  }
};
