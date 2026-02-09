import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. Add fields to ActivityMaterials
    const tableInfo = await queryInterface.describeTable("ActivityMaterials");

    // "unit" is already defined in 20260201220001-create-activities.ts
    // We only need to add "isBillable"
    
    if (!tableInfo["isBillable"]) {
      await queryInterface.addColumn("ActivityMaterials", "isBillable", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    // 2. Create ActivityOccurrences table
    try {
      await queryInterface.createTable("ActivityOccurrences", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        activityId: {
          type: DataTypes.INTEGER,
          references: { model: "Activities", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        tenantId: {
          type: DataTypes.UUID,
          references: { model: "Tenants", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        type: {
          type: DataTypes.ENUM("info", "impediment", "delay"),
          allowNull: false,
          defaultValue: "info"
        },
        timeImpact: {
          type: DataTypes.INTEGER, // minutes
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false
        }
      });
    } catch (error: any) {
      if (!error.message.includes("already exists")) {
        throw error;
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("ActivityOccurrences");
    
    const tableInfo = await queryInterface.describeTable("ActivityMaterials");
    
    if (tableInfo["isBillable"]) {
      await queryInterface.removeColumn("ActivityMaterials", "isBillable");
    }
  }
};
