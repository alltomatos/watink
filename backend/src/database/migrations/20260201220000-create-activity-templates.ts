"use strict";

import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Tabela de Templates de Atividade
        await queryInterface.createTable("ActivityTemplates", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            tenantId: {
                type: DataTypes.UUID,
                references: { model: "Tenants", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
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
            isActive: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
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

        // Tabela de Itens do Template
        await queryInterface.createTable("ActivityTemplateItems", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            templateId: {
                type: DataTypes.INTEGER,
                references: { model: "ActivityTemplates", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            label: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            inputType: {
                type: DataTypes.ENUM("checkbox", "text", "photo", "number"),
                allowNull: false,
                defaultValue: "checkbox"
            },
            isRequired: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            order: {
                type: DataTypes.INTEGER,
                defaultValue: 0
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

        // Índices para performance
        await queryInterface.addIndex("ActivityTemplates", ["tenantId"]);
        await queryInterface.addIndex("ActivityTemplateItems", ["templateId"]);
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("ActivityTemplateItems");
        await queryInterface.dropTable("ActivityTemplates");
    }
};
