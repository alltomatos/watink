import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Create Plugins table (catalog)
    await queryInterface.createTable("Plugins", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      slug: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      version: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "free"
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      iconUrl: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      downloadUrl: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      category: {
        type: DataTypes.STRING(100),
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

    // Create PluginInstallations table
    await queryInterface.createTable("PluginInstallations", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
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
      pluginId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "Plugins", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      installedVersion: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "inactive"
      },
      licenseKey: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      licenseValidUntil: {
        type: DataTypes.DATE,
        allowNull: true
      },
      installedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      activatedAt: {
        type: DataTypes.DATE,
        allowNull: true
      }
    });

    // Add unique constraint
    await queryInterface.addIndex("PluginInstallations", ["tenantId", "pluginId"], {
      unique: true,
      name: "plugin_installations_tenant_plugin_unique"
    });

    // Create Licenses table
    await queryInterface.createTable("Licenses", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      licenseKey: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false
      },
      pluginId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "Plugins", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      customerEmail: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      maxActivations: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      currentActivations: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      validUntil: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Seed initial plugins
    await queryInterface.bulkInsert("Plugins", [
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        slug: "clientes",
        name: "Plugin de Clientes",
        description: "Gestão completa de clientes com múltiplos contatos e endereços. Integração ViaCEP.",
        version: "1.0.0",
        type: "free",
        iconUrl: "https://plugins.watink.com/clientes/icon.png",
        category: "gestao",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440002",
        slug: "helpdesk",
        name: "Plugin de Helpdesk",
        description: "Sistema de protocolos de atendimento vinculados a tickets.",
        version: "1.0.0",
        type: "free",
        iconUrl: "https://plugins.watink.com/helpdesk/icon.png",
        category: "suporte",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440003",
        slug: "whatsmeow",
        name: "Motor WhatsMeow",
        description: "Engine de alta performance em Go para conexões WhatsApp.",
        version: "1.0.0",
        type: "premium",
        price: 199.90,
        iconUrl: "https://plugins.watink.com/whatsmeow/icon.png",
        category: "engine",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("Licenses");
    await queryInterface.dropTable("PluginInstallations");
    await queryInterface.dropTable("Plugins");
  }
};
