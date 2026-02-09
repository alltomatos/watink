"use strict";

import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Update Helpdesk plugin version to 2.0.0
        await queryInterface.sequelize.query(`
            UPDATE "Plugins" 
            SET 
                version = '2.0.0',
                description = 'Sistema completo de Helpdesk com protocolos, RAT (Relatório de Atendimento Técnico), templates de atividade, checklist dinâmico e geração de PDF.',
                "updatedAt" = NOW()
            WHERE slug = 'helpdesk';
        `);

        // Also update any existing installations to reflect new version
        await queryInterface.sequelize.query(`
            UPDATE "PluginInstallations" 
            SET 
                "installedVersion" = '2.0.0',
                "updatedAt" = NOW()
            WHERE "pluginId" = '550e8400-e29b-41d4-a716-446655440002';
        `);

        console.log("Helpdesk plugin updated to v2.0.0");
    },

    down: async (queryInterface: QueryInterface) => {
        // Revert to 1.0.0
        await queryInterface.sequelize.query(`
            UPDATE "Plugins" 
            SET 
                version = '1.0.0',
                description = 'Sistema de protocolos de atendimento vinculados a tickets.',
                "updatedAt" = NOW()
            WHERE slug = 'helpdesk';
        `);

        await queryInterface.sequelize.query(`
            UPDATE "PluginInstallations" 
            SET 
                "installedVersion" = '1.0.0',
                "updatedAt" = NOW()
            WHERE "pluginId" = '550e8400-e29b-41d4-a716-446655440002';
        `);
    }
};
