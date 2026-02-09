"use strict";

import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Tabela de Atividades (vinculada ao Protocol)
        await queryInterface.createTable("Activities", {
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
            protocolId: {
                type: DataTypes.INTEGER,
                references: { model: "Protocols", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            templateId: {
                type: DataTypes.INTEGER,
                references: { model: "ActivityTemplates", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
                allowNull: true
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            status: {
                type: DataTypes.ENUM("pending", "in_progress", "done", "cancelled"),
                defaultValue: "pending"
            },
            userId: {
                type: DataTypes.INTEGER,
                references: { model: "Users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
                allowNull: true
            },
            clientSignature: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            technicianSignature: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            startedAt: {
                type: DataTypes.DATE,
                allowNull: true
            },
            finishedAt: {
                type: DataTypes.DATE,
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

        // Tabela de Itens da Atividade (Checklist)
        await queryInterface.createTable("ActivityItems", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            activityId: {
                type: DataTypes.INTEGER,
                references: { model: "Activities", key: "id" },
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
            value: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            isDone: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
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

        // Tabela de Materiais utilizados na Atividade
        await queryInterface.createTable("ActivityMaterials", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            activityId: {
                type: DataTypes.INTEGER,
                references: { model: "Activities", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            materialName: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            quantity: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 1
            },
            unit: {
                type: DataTypes.STRING(50),
                allowNull: true
            },
            notes: {
                type: DataTypes.TEXT,
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

        // Índices para performance
        await queryInterface.addIndex("Activities", ["tenantId"]);
        await queryInterface.addIndex("Activities", ["protocolId"]);
        await queryInterface.addIndex("Activities", ["userId"]);
        await queryInterface.addIndex("Activities", ["status"]);
        await queryInterface.addIndex("ActivityItems", ["activityId"]);
        await queryInterface.addIndex("ActivityMaterials", ["activityId"]);
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("ActivityMaterials");
        await queryInterface.dropTable("ActivityItems");
        await queryInterface.dropTable("Activities");
    }
};
