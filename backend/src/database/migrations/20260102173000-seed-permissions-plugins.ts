
import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const permissions = [
            // Permissions for Clients Plugin
            {
                name: "view_clients",
                description: "Visualizar Clientes",
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: "edit_clients",
                description: "Editar Clientes",
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: "delete_clients",
                description: "Deletar Clientes",
                createdAt: new Date(),
                updatedAt: new Date()
            },
            // Permissions for Helpdesk Plugin
            {
                name: "view_helpdesk",
                description: "Visualizar Helpdesk",
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: "edit_helpdesk",
                description: "Editar Helpdesk",
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: "view_protocols",
                description: "Visualizar Protocolos",
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        // Use bulkInsert with ignoreDuplicates option (specific syntax depends on dialect, but for Postgres usually handled via ON CONFLICT DO NOTHING or manual check)
        // Sequelize bulkInsert doesn't natively support ignoreDuplicates across all dialects perfectly in older versions, 
        // but for Postgres we can use the following approach or just a raw query if needed.
        // However, simplest standar way:

        return queryInterface.bulkInsert("Permissions", permissions, { ignoreDuplicates: true } as any);
    },

    down: async (queryInterface: QueryInterface) => {
        return queryInterface.bulkDelete("Permissions", {
            name: [
                "view_clients",
                "edit_clients",
                "delete_clients",
                "view_helpdesk",
                "edit_helpdesk",
                "view_protocols"
            ]
        }, {});
    }
};
