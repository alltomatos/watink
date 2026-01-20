import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("FlowTriggers", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      flowId: {
        type: DataTypes.INTEGER,
        references: { model: "Flows", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false // 'whatsapp_message', 'ticket_create', 'kanban_move', 'manual'
      },
      condition: {
        type: DataTypes.JSONB,
        defaultValue: {}
        // Example: { "queueId": 1, "keywords": ["help"] }
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      tenantId: {
        type: DataTypes.UUID,
        references: { model: "Tenants", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
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
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("FlowTriggers");
  }
};
