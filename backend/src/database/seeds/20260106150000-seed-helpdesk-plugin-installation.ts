import { QueryInterface } from "sequelize";
import { v4 as uuidv4 } from "uuid";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // 1. Find the default tenant
        const tenants = await queryInterface.sequelize.query(
            `SELECT id FROM "Tenants" LIMIT 1;`
        );

        if (!tenants || !tenants[0] || tenants[0].length === 0) {
            console.log("No tenant found. Skipping Helpdesk plugin installation seed.");
            return;
        }

        const tenantId = (tenants[0][0] as any).id;
        const helpdeskPluginId = "550e8400-e29b-41d4-a716-446655440002"; // ID from create-plugins-tables migration

        // 2. Check if already installed
        const existingInstallation = await queryInterface.sequelize.query(
            `SELECT id FROM "PluginInstallations" WHERE "tenantId" = '${tenantId}' AND "pluginId" = '${helpdeskPluginId}';`
        );

        if (existingInstallation[0].length > 0) {
            console.log("Helpdesk plugin already installed for default tenant. Keeping current status.");
            // Do NOT force activation - respect user's choice
            return;
        }

        // 3. Install Helpdesk Plugin as INACTIVE by default
        await queryInterface.bulkInsert("PluginInstallations", [
            {
                id: uuidv4(),
                tenantId: tenantId,
                pluginId: helpdeskPluginId,
                status: "inactive", // Plugin comes disabled by default
                installedAt: new Date(),
                activatedAt: null,
                updatedAt: new Date()
            }
        ]);
        console.log("Helpdesk plugin installed as INACTIVE for default tenant.");
    },

    down: async (queryInterface: QueryInterface) => {
        const helpdeskPluginId = "550e8400-e29b-41d4-a716-446655440002";
        await queryInterface.bulkDelete("PluginInstallations", {
            pluginId: helpdeskPluginId
        });
    }
};
