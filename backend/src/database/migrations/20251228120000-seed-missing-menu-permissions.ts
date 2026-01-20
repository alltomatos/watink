import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const now = new Date();
        const permissions = [
            {
                name: "view_dashboard",
                description: "Visualizar Dashboard",
                createdAt: now,
                updatedAt: now,
            },
            {
                name: "view_pipelines",
                description: "Visualizar Pipelines",
                createdAt: now,
                updatedAt: now,
            },
            {
                name: "view_swagger",
                description: "Visualizar Swagger",
                createdAt: now,
                updatedAt: now,
            }
        ];

        const newPermissions = [];

        for (const p of permissions) {
            const [exists] = await queryInterface.sequelize.query(
                `SELECT id FROM "Permissions" WHERE name = '${p.name}';`
            );
            if (!exists || exists.length === 0) {
                newPermissions.push(p);
            }
        }

        if (newPermissions.length > 0) {
            await queryInterface.bulkInsert("Permissions", newPermissions);
        }


    },

    down: async (queryInterface: QueryInterface) => {
        const permissions = [
            "view_dashboard",
            "view_pipelines",
            "view_swagger"
        ];
        await queryInterface.bulkDelete("Permissions", { name: permissions });
    },
};
