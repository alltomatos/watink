import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.createTable("ProtocolAttachments", {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            protocolId: {
                type: DataTypes.INTEGER,
                references: { model: "Protocols", key: "id" },
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
            fileName: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            originalName: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            filePath: {
                type: DataTypes.STRING(500),
                allowNull: false
            },
            fileType: {
                type: DataTypes.STRING(100),
                allowNull: false
            },
            fileSize: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            uploadedBy: {
                type: DataTypes.INTEGER,
                references: { model: "Users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
                allowNull: true
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });

        // Index para busca rápida por protocolo
        await queryInterface.addIndex("ProtocolAttachments", ["protocolId"]);
        await queryInterface.addIndex("ProtocolAttachments", ["tenantId"]);
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("ProtocolAttachments");
    }
};
