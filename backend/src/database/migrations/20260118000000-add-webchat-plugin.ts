
import { QueryInterface, DataTypes } from "sequelize";
import { v4 as uuidv4 } from "uuid";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const pluginId = "550e8400-e29b-41d4-a716-446655440005"; // Unique ID for Webchat

        const existingPlugin = await queryInterface.rawSelect(
            "Plugins",
            {
                where: {
                    slug: "webchat",
                },
            },
            ["id"]
        );

        if (!existingPlugin) {
            await queryInterface.bulkInsert("Plugins", [
                {
                    id: pluginId,
                    slug: "webchat",
                    name: "Webchat",
                    description: "Permite adicionar um chat via web em seu site para atendimento direto.",
                    version: "1.0.0",
                    type: "free",
                    iconUrl: "https://plugins.watink.com/webchat/icon.png",
                    category: "canal",
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ]);
        }
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.bulkDelete("Plugins", { slug: "webchat" });
    }
};
