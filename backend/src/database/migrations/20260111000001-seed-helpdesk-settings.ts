import { QueryInterface, QueryTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // 1. Get all Tenant IDs
        // 1. Get all Tenant IDs
        let tenants: any[] = [];
        try {
            tenants = await queryInterface.sequelize.query('SELECT id FROM "Tenants"', {
                type: "SELECT" as any
            }) as any[];
        } catch (e) {
            console.warn("Table Tenants does not exist, defaulting to tenantId 1");
        }

        const defaultCategories = JSON.stringify([
            "Incidente",
            "Requisição de Serviço",
            "Problema",
            "Mudança"
        ]);

        const defaultSla = JSON.stringify({
            low: 24,
            medium: 12,
            high: 4,
            urgent: 1
        });

        const settingsToInsert = [];

        if (tenants.length > 0) {
            for (const tenant of tenants) {
                const tenantId = tenant.id;
                const now = new Date();

                settingsToInsert.push(
                    { key: "helpdesk_settings_enabled", value: "false", createdAt: now, updatedAt: now, tenantId },
                    { key: "helpdesk_categories", value: defaultCategories, createdAt: now, updatedAt: now, tenantId },
                    { key: "helpdesk_sla_config", value: defaultSla, createdAt: now, updatedAt: now, tenantId }
                );
            }
        } else {
            // Fallback for single tenant / no tenants table
            const tenantId = 1;
            const now = new Date();
            settingsToInsert.push(
                { key: "helpdesk_settings_enabled", value: "false", createdAt: now, updatedAt: now, tenantId },
                { key: "helpdesk_categories", value: defaultCategories, createdAt: now, updatedAt: now, tenantId },
                { key: "helpdesk_sla_config", value: defaultSla, createdAt: now, updatedAt: now, tenantId }
            );
        }

        if (settingsToInsert.length > 0) {
            // Use bulkInsert with ignoreDuplicates to avoid errors if they already exist
            await queryInterface.bulkInsert("Settings", settingsToInsert, {
                ignoreDuplicates: true
            } as any);
        }
    },

    down: async (queryInterface: QueryInterface) => {
        // Optional: Delete these settings
        await queryInterface.bulkDelete("Settings", {
            key: ["helpdesk_settings_enabled", "helpdesk_categories", "helpdesk_sla_config"]
        });
    }
};
