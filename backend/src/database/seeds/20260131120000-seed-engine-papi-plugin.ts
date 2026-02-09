import { QueryInterface } from "sequelize";
import { v4 as uuidv4 } from "uuid";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const pluginId = "550e8400-e29b-41d4-a716-446655440007";
        
        // 1. Create or Update Plugin Definition
        const existingPlugin = await queryInterface.sequelize.query(
            `SELECT id FROM "Plugins" WHERE id = '${pluginId}';`
        );

        if (existingPlugin[0].length === 0) {
            await queryInterface.bulkInsert("Plugins", [{
                id: pluginId,
                slug: "engine-papi",
                name: "Engine PAPI",
                description: "Integração com Pastorini API (WhatsApp)",
                version: "1.0.0",
                type: "free",
                iconUrl: "whatsapp",
                createdAt: new Date(),
                updatedAt: new Date()
            }]);
            console.log("Engine PAPI Plugin registered.");
        }

        // 2. Find the default tenant
        const tenants = await queryInterface.sequelize.query(
            `SELECT id FROM "Tenants" LIMIT 1;`
        );

        if (!tenants || !tenants[0] || tenants[0].length === 0) {
            return;
        }

        const tenantId = (tenants[0][0] as any).id;

        // 3. Check if already installed
        const existingInstallation = await queryInterface.sequelize.query(
            `SELECT id FROM "PluginInstallations" WHERE "tenantId" = '${tenantId}' AND "pluginId" = '${pluginId}';`
        );

        if (existingInstallation[0].length > 0) {
            return;
        }

        // 4. Install Plugin (Inactive by default, user must enable)
        await queryInterface.bulkInsert("PluginInstallations", [
            {
                id: uuidv4(),
                tenantId: tenantId,
                pluginId: pluginId,
                status: "inactive",
                installedAt: new Date(),
                activatedAt: null,
                updatedAt: new Date()
            }
        ]);
        console.log("Engine PAPI Plugin installed for default tenant.");
    },

    down: async (queryInterface: QueryInterface) => {
        const pluginId = "550e8400-e29b-41d4-a716-446655440007";
        await queryInterface.bulkDelete("PluginInstallations", { pluginId });
        await queryInterface.bulkDelete("Plugins", { id: pluginId });
    }
};
