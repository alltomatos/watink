
import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const pluginId = "550e8400-e29b-41d4-a716-446655440006"; // Unique ID for WhatsMeow

        const existingPlugin = await queryInterface.rawSelect(
            "Plugins",
            {
                where: {
                    slug: "whatsmeow",
                },
            },
            ["id"]
        );

        if (!existingPlugin) {
            await queryInterface.bulkInsert("Plugins", [
                {
                    id: pluginId,
                    slug: "whatsmeow",
                    name: "WhatsMeow",
                    description: "Integração de alto desempenho com WhatsApp utilizando a biblioteca WhatsMeow (Go).",
                    version: "1.0.0",
                    type: "free",
                    iconUrl: "https://plugins.watink.com/whatsmeow/icon.png",
                    category: "canal",
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ]);
        }
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.bulkDelete("Plugins", { slug: "whatsmeow" });
    }
};
