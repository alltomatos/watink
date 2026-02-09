import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableInfo = await queryInterface.describeTable("ActivityMaterials");

    if (!tableInfo["tenantId"]) {
      // 1. Add column as nullable first
      await queryInterface.addColumn("ActivityMaterials", "tenantId", {
        type: DataTypes.UUID,
        references: { model: "Tenants", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: true
      });

      // 2. Populate tenantId from parent Activity
      // We need to use raw query because models might not be available or synced
      await queryInterface.sequelize.query(`
        UPDATE "ActivityMaterials" AS am
        SET "tenantId" = a."tenantId"
        FROM "Activities" AS a
        WHERE am."activityId" = a.id
      `);

      // 3. Change to NOT NULL (optional, but good practice if model expects it)
      // Only do this if we are sure all rows were updated. 
      // If there are orphan materials, this might fail. 
      // For safety in this migration, we can leave it nullable or try to alter.
      // Let's try to alter, but wrap in try/catch or just leave as nullable if strictness isn't required by DB constraints yet.
      // The Model says `tenantId: string`, implies required.
      
      try {
          await queryInterface.changeColumn("ActivityMaterials", "tenantId", {
            type: DataTypes.UUID,
            references: { model: "Tenants", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
            allowNull: false
          });
      } catch (e) {
          console.warn("Could not set tenantId to NOT NULL, possibly due to orphan records or empty table.", e);
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableInfo = await queryInterface.describeTable("ActivityMaterials");
    if (tableInfo["tenantId"]) {
      await queryInterface.removeColumn("ActivityMaterials", "tenantId");
    }
  }
};
