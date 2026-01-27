import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.createTable("Groups", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            tenantId: {
                type: DataTypes.UUID,
                allowNull: false,
                references: { model: "Tenants", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
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

        /* LEGACY RBAC TABLES REMOVED - REPLACED BY ENTERPRISE RBAC */
        /*
        await queryInterface.createTable("Permissions", { ... });
        await queryInterface.createTable("GroupPermissions", { ... });
        await queryInterface.createTable("UserPermissions", { ... });
        */
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("UserPermissions");
        await queryInterface.removeColumn("Users", "groupId");
        await queryInterface.dropTable("GroupPermissions");
        await queryInterface.dropTable("Permissions");
        await queryInterface.dropTable("Groups");
    }
};
