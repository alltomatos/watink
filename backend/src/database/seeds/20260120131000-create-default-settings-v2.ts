import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // 1. Find ALL Tenants
        let tenants: any[] = [];
        try {
            tenants = await queryInterface.sequelize.query('SELECT id FROM "Tenants"', { type: "SELECT" as any }) as any[];
        } catch (e) { }

        if (tenants.length === 0) {
            const raw = await queryInterface.sequelize.query('SELECT id FROM "Tenants"');
            if (raw[0] && (raw[0] as any[]).length > 0) tenants = raw[0] as any[];
        }

        if (tenants.length === 0) {
            console.warn("Skipping Default Settings (userCreation) seed: No tenants found.");
            return;
        }

        const settingsToInsert = [];

        for (const tenant of tenants) {
            const tenantId = tenant.id;
            const existing = await queryInterface.sequelize.query(
                `SELECT * FROM "Settings" WHERE key = 'userCreation' AND "tenantId" = '${tenantId}'`
            );

            if ((existing[0] as any[]).length === 0) {
                settingsToInsert.push({
                    key: "userCreation",
                    value: "disabled",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    tenantId: tenantId
                });
            }
        }

        if (settingsToInsert.length > 0) {
            return queryInterface.bulkInsert("Settings", settingsToInsert, {});
        }
    },

    down: (queryInterface: QueryInterface) => {
        return queryInterface.bulkDelete("Settings", { key: "userCreation" });
    }
};
