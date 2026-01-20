import { QueryInterface, QueryTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // 1. Get all Tenant IDs
        let tenants: any[] = [];
        try {
            tenants = await queryInterface.sequelize.query('SELECT id FROM "Tenants"', {
                type: "SELECT" as any
            }) as any[];
        } catch (e) {
            console.warn("Table Tenants does not exist yet.");
            return;
        }

        // If no tenants, create the default one (Migration-first approach)
        if (tenants.length === 0) {
            const tenantId = process.env.DEFAULT_TENANT_UUID || "550e8400-e29b-41d4-a716-446655440000";
            const now = new Date();
            try {
                await queryInterface.bulkInsert("Tenants", [{
                    id: tenantId,
                    name: "Default Tenant",
                    status: "active",
                    createdAt: now,
                    updatedAt: now
                }]);
                tenants.push({ id: tenantId });
            } catch (error) {
                console.error("Error ensuring default tenant in helpdesk seed:", error);
                // Try to fetch again in case of race condition
                tenants = await queryInterface.sequelize.query('SELECT id FROM "Tenants"', {
                    type: "SELECT" as any
                }) as any[];
            }
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

            if (settingsToInsert.length > 0) {
                // Use bulkInsert with ignoreDuplicates to avoid errors if they already exist
                await queryInterface.bulkInsert("Settings", settingsToInsert, {
                    ignoreDuplicates: true
                } as any);
            }
        }
    },

    down: async (queryInterface: QueryInterface) => {
        // Optional: Delete these settings
        await queryInterface.bulkDelete("Settings", {
            key: ["helpdesk_settings_enabled", "helpdesk_categories", "helpdesk_sla_config"]
        });
    }
};
