import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Create Protocols table
        await queryInterface.createTable("Protocols", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            tenantId: {
                type: DataTypes.UUID,
                allowNull: false,
                references: { model: "Tenants", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            protocolNumber: {
                type: DataTypes.STRING(50),
                allowNull: false
            },
            ticketId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "Tickets", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL"
            },
            contactId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "Contacts", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL"
            },
            userId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "Users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL"
            },
            subject: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            status: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: "open" // open, in_progress, pending, resolved, closed
            },
            priority: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: "medium" // low, medium, high, urgent
            },
            category: {
                type: DataTypes.STRING(100),
                allowNull: true
            },
            dueDate: {
                type: DataTypes.DATE,
                allowNull: true
            },
            resolvedAt: {
                type: DataTypes.DATE,
                allowNull: true
            },
            closedAt: {
                type: DataTypes.DATE,
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

        // Create ProtocolHistory table
        await queryInterface.createTable("ProtocolHistories", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            protocolId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "Protocols", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            userId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "Users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL"
            },
            action: {
                type: DataTypes.STRING(50),
                allowNull: false // created, status_changed, assigned, commented, resolved, closed
            },
            previousValue: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            newValue: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            comment: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });

        // Add indexes
        await queryInterface.addIndex("Protocols", ["tenantId"]);
        await queryInterface.addIndex("Protocols", ["protocolNumber"]);
        await queryInterface.addIndex("Protocols", ["ticketId"]);
        await queryInterface.addIndex("Protocols", ["contactId"]);
        await queryInterface.addIndex("Protocols", ["status"]);
        await queryInterface.addIndex("ProtocolHistories", ["protocolId"]);
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("ProtocolHistories");
        await queryInterface.dropTable("Protocols");
    }
};
