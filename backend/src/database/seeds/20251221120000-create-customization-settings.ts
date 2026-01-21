import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        let tenants: any[] = [];
        try {
            tenants = await queryInterface.sequelize.query('SELECT id FROM "Tenants"', {
                type: "SELECT" as any
            }) as any[];
        } catch (e) {
            console.warn("Table Tenants query failed");
        }

        if (tenants.length === 0) {
            // Fallback for clean install if previous seed worked but return format differs?
            // Or maybe running standalone?
            // Let's try raw query result inspection if type is issue
            const rawTenants = await queryInterface.sequelize.query('SELECT id FROM "Tenants"');
            if (rawTenants[0] && (rawTenants[0] as any[]).length > 0) {
                tenants = rawTenants[0] as any[];
            }
        }

        if (tenants.length === 0) {
            console.warn("Skipping Customization Settings seed: No tenants found.");
            return;
        }

        const settingsKeys = ["systemTitle", "systemLogo", "systemLogoEnabled", "systemFavicon"];
        const defaults = {
            "systemTitle": "Watink",
            "systemLogo": "",
            "systemLogoEnabled": "true",
            "systemFavicon": ""
        };

        const settingsToInsert = [];

        for (const tenant of tenants) {
            const tenantId = tenant.id;

            for (const key of settingsKeys) {
                // Check existence for THIS tenant
                const existing = await queryInterface.sequelize.query(
                    `SELECT * FROM "Settings" WHERE key = '${key}' AND "tenantId" = '${tenantId}'`
                );

                if ((existing[0] as any[]).length === 0) {
                    settingsToInsert.push({
                        key,
                        value: defaults[key as keyof typeof defaults],
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        tenantId
                    });
                }
            }
        }

        if (settingsToInsert.length > 0) {
            await queryInterface.bulkInsert("Settings", settingsToInsert, {});
        }
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.bulkDelete("Settings", { key: "systemTitle" } as any);
        await queryInterface.bulkDelete("Settings", { key: "systemLogo" } as any);
        await queryInterface.bulkDelete("Settings", { key: "systemLogoEnabled" } as any);
        await queryInterface.bulkDelete("Settings", { key: "systemFavicon" } as any);
    }
};
