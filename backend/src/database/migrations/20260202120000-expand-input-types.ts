"use strict";

import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // 1. Alterar o ENUM de inputType em ActivityTemplateItems
        // PostgreSQL requer recriar a coluna para alterar ENUM
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_ActivityTemplateItems_inputType" 
            ADD VALUE IF NOT EXISTS 'radio';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_ActivityTemplateItems_inputType" 
            ADD VALUE IF NOT EXISTS 'select';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_ActivityTemplateItems_inputType" 
            ADD VALUE IF NOT EXISTS 'multiselect';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_ActivityTemplateItems_inputType" 
            ADD VALUE IF NOT EXISTS 'textarea';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_ActivityTemplateItems_inputType" 
            ADD VALUE IF NOT EXISTS 'date';
        `);

        // 2. Adicionar coluna options (JSONB) para armazenar opções de escolha
        await queryInterface.addColumn("ActivityTemplateItems", "options", {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
            comment: "Array de opções para tipos radio, select e multiselect"
        });

        // 3. Fazer o mesmo para ActivityItems (execução)
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_ActivityItems_inputType" 
            ADD VALUE IF NOT EXISTS 'radio';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_ActivityItems_inputType" 
            ADD VALUE IF NOT EXISTS 'select';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_ActivityItems_inputType" 
            ADD VALUE IF NOT EXISTS 'multiselect';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_ActivityItems_inputType" 
            ADD VALUE IF NOT EXISTS 'textarea';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_ActivityItems_inputType" 
            ADD VALUE IF NOT EXISTS 'date';
        `);

        await queryInterface.addColumn("ActivityItems", "options", {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
            comment: "Array de opções para tipos radio, select e multiselect"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        // Remover colunas options
        await queryInterface.removeColumn("ActivityTemplateItems", "options");
        await queryInterface.removeColumn("ActivityItems", "options");

        // Nota: Não é possível remover valores de ENUM no PostgreSQL sem recriar
        // Por simplicidade, deixamos os valores no ENUM
    }
};
