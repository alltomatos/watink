import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Create Clients table
        await queryInterface.createTable("Clients", {
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
            type: {
                type: DataTypes.STRING(10),
                allowNull: false,
                defaultValue: "pf" // pf = pessoa física, pj = pessoa jurídica
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            document: {
                type: DataTypes.STRING(20),
                allowNull: true // CPF ou CNPJ
            },
            email: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            phone: {
                type: DataTypes.STRING(20),
                allowNull: true
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            isActive: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
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

        // Create ClientContacts table (multiple contacts per client)
        await queryInterface.createTable("ClientContacts", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            clientId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "Clients", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            contactId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "Contacts", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL"
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            role: {
                type: DataTypes.STRING(100),
                allowNull: true // Cargo/função
            },
            phone: {
                type: DataTypes.STRING(20),
                allowNull: true
            },
            email: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            isPrimary: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
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

        // Create ClientAddresses table (multiple addresses per client)
        await queryInterface.createTable("ClientAddresses", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            clientId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "Clients", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            label: {
                type: DataTypes.STRING(100),
                allowNull: true // ex: "Sede", "Filial", "Residência"
            },
            zipCode: {
                type: DataTypes.STRING(10),
                allowNull: true
            },
            street: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            number: {
                type: DataTypes.STRING(20),
                allowNull: true
            },
            complement: {
                type: DataTypes.STRING(100),
                allowNull: true
            },
            neighborhood: {
                type: DataTypes.STRING(100),
                allowNull: true
            },
            city: {
                type: DataTypes.STRING(100),
                allowNull: true
            },
            state: {
                type: DataTypes.STRING(2),
                allowNull: true
            },
            isPrimary: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
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

        // Add indexes
        await queryInterface.addIndex("Clients", ["tenantId"]);
        await queryInterface.addIndex("Clients", ["document"]);
        await queryInterface.addIndex("ClientContacts", ["clientId"]);
        await queryInterface.addIndex("ClientContacts", ["contactId"]);
        await queryInterface.addIndex("ClientAddresses", ["clientId"]);
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("ClientAddresses");
        await queryInterface.dropTable("ClientContacts");
        await queryInterface.dropTable("Clients");
    }
};
