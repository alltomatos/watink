import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.createTable("TenantSmtpSettings", {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            tenantId: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: "Tenants",
                    key: "id"
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            host: {
                type: DataTypes.STRING,
                allowNull: false
            },
            port: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 587
            },
            user: {
                type: DataTypes.STRING,
                allowNull: false
            },
            password: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            secure: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            emailFrom: {
                type: DataTypes.STRING,
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

        // Add unique constraint for tenant (one SMTP config per tenant)
        await queryInterface.addIndex("TenantSmtpSettings", ["tenantId"], {
            unique: true,
            name: "tenant_smtp_settings_tenant_id_unique"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("TenantSmtpSettings");
    }
};
