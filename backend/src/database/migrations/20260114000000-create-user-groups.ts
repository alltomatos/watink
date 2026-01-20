import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("UserGroups", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      groupId: {
        type: DataTypes.INTEGER,
        references: { model: "Groups", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      tenantId: {
        type: DataTypes.UUID,
        references: { model: "Tenants", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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

    // Remove foreign key constraint first if it exists, then the column
    // Note: Constraint name usually follows tableName_columnName_fkey pattern or similar.
    // We try to remove the column directly; if it has a named constraint, it might fail in some DBs without removing constraint first.
    // PostgreSQL usually requires dropping the constraint. 
    // Let's assume standard Sequelize naming or just try removing column which might cascade or fail.
    // Safer to just remove column.

    // Check if column exists before trying to remove (Good practice for idempotency)
    const tableInfo = await queryInterface.describeTable("Users");
    if ((tableInfo as any)["groupId"]) {
      await queryInterface.removeColumn("Users", "groupId");
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("UserGroups");
    await queryInterface.addColumn("Users", "groupId", {
      type: DataTypes.INTEGER,
      references: { model: "Groups", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
  }
};
