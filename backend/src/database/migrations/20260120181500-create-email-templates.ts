import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.createTable("EmailTemplates", {
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
            subject: {
                type: DataTypes.STRING,
                allowNull: false
            },
            html: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            text: {
                type: DataTypes.TEXT,
                allowNull: true
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

        // Add unique constraint for name per tenant to ensure unique template names
        await queryInterface.addIndex("EmailTemplates", ["tenantId", "name"], {
            unique: true,
            name: "email_templates_tenant_name_unique"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("EmailTemplates");
    }
};
