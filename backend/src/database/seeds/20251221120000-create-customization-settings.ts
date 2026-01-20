import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Check if systemTitle exists
        const titleExists = await queryInterface.sequelize.query(
            `SELECT * FROM "Settings" WHERE key = 'systemTitle'`
        );
        if ((titleExists[0] as any[]).length === 0) {
            await queryInterface.bulkInsert(
                "Settings",
                [
                    {
                        key: "systemTitle",
                        value: "Watink",
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ],
                {}
            );
        }

        // Check if systemLogo exists
        const logoExists = await queryInterface.sequelize.query(
            `SELECT * FROM "Settings" WHERE key = 'systemLogo'`
        );
        if ((logoExists[0] as any[]).length === 0) {
            await queryInterface.bulkInsert(
                "Settings",
                [
                    {
                        key: "systemLogo",
                        value: "",
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ],
                {}
            );
        }

        // Check if systemLogoEnabled exists
        const logoEnabledExists = await queryInterface.sequelize.query(
            `SELECT * FROM "Settings" WHERE key = 'systemLogoEnabled'`
        );
        if ((logoEnabledExists[0] as any[]).length === 0) {
            await queryInterface.bulkInsert(
                "Settings",
                [
                    {
                        key: "systemLogoEnabled",
                        value: "true",
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ],
                {}
            );
        }

        // Check if systemFavicon exists
        const faviconExists = await queryInterface.sequelize.query(
            `SELECT * FROM "Settings" WHERE key = 'systemFavicon'`
        );
        if ((faviconExists[0] as any[]).length === 0) {
            await queryInterface.bulkInsert(
                "Settings",
                [
                    {
                        key: "systemFavicon",
                        value: "",
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ],
                {}
            );
        }
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.bulkDelete("Settings", { key: "systemTitle" } as any);
        await queryInterface.bulkDelete("Settings", { key: "systemLogo" } as any);
        await queryInterface.bulkDelete("Settings", { key: "systemLogoEnabled" } as any);
        await queryInterface.bulkDelete("Settings", { key: "systemFavicon" } as any);
    }
};
