import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const permissions = [
            { name: "view_pipelines", description: "Visualizar menu de Pipelines" },
            { name: "view_chats", description: "Visualizar menu de Chats/Tickets" },
            { name: "view_admin", description: "Visualizar menu de Administração" },
            { name: "view_admin_queues", description: "Gerenciar Filas (Admin)" },
            { name: "view_admin_settings", description: "Gerenciar Configurações (Admin)" },
            { name: "ticket_view_groups", description: "Visualizar Tickets de Grupos" },
            { name: "view_groups", description: "Gerenciar Grupos de Usuários" },
            { name: "view_users", description: "Gerenciar Usuários" }
        ];

        const now = new Date();

        await queryInterface.bulkInsert(
            "Permissions",
            permissions.map(p => ({
                ...p,
                createdAt: now,
                updatedAt: now
            })),
            { ignoreDuplicates: true } as any
        );
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.bulkDelete("Permissions", {});
    }
};
