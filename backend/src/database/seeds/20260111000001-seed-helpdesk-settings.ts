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
            const tenantId = process.env.DEFAULT_TENANT_UUID || "550e8400-e29b-41d4-a716-446655440000";
            const now = new Date();
            // Only insert if we have a valid UUID-like string, otherwise we might still violate FK if tenant doesn't exist
            // But relying on the Default Tenant being created by previous seeder is the standard way.
            
            // However, inserting a setting for a tenant that doesn't exist WILL fail FK constraint.
            // If no tenants found, we should probably SKIP or try to ensure the default tenant ID matches what we expect.
            // Since we can't create a tenant here easily without duplicating logic, 
            // and this is likely running AFTER create-default-tenant, if we are here it means NO tenants exist.
            // If NO tenants exist, we CANNOT insert settings due to FK.
            
            console.warn("No tenants found in 'Tenants' table. Skipping Helpdesk Settings seed to avoid FK violation.");
            // Do not push to settingsToInsert
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
