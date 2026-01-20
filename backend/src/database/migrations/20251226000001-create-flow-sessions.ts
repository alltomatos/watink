import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("FlowSessions", {
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
      currentStepId: {
        type: DataTypes.STRING,
        allowNull: true // Null means flow finished or just started
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: "active", // active, completed, failed
        allowNull: false
      },
      context: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      entityId: {
        type: DataTypes.INTEGER,
        allowNull: true // Can be ticketId, dealId, etc.
      },
      entityType: {
        type: DataTypes.STRING,
        allowNull: true // 'ticket', 'deal', 'contact'
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
    return queryInterface.dropTable("FlowSessions");
  }
};
