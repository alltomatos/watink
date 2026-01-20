import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.addColumn("Tenants", "logo", {
            type: DataTypes.STRING,
            allowNull: true
        });

        await queryInterface.addColumn("Tenants", "document", {
            type: DataTypes.STRING,
            allowNull: true
        });

        await queryInterface.addColumn("Tenants", "businessHours", {
            type: DataTypes.JSON,
            allowNull: true
        });

        await queryInterface.addColumn("Tenants", "message", {
            type: DataTypes.STRING,
            allowNull: true
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.removeColumn("Tenants", "message");
        await queryInterface.removeColumn("Tenants", "businessHours");
        await queryInterface.removeColumn("Tenants", "document");
        await queryInterface.removeColumn("Tenants", "logo");
    }
};
