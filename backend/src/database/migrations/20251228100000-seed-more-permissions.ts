import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const permissions = [
            // Contacts
            { name: "create_contacts", description: "Criar/Importar Contatos" },
            { name: "edit_contacts", description: "Editar Contatos" },
            { name: "delete_contacts", description: "Excluir Contatos" },

            // Tickets
            { name: "delete_tickets", description: "Excluir Tickets" },

            // Quick Answers
            { name: "view_quick_answers", description: "Visualizar Respostas Rápidas" },
            { name: "manage_quick_answers", description: "Gerenciar Respostas Rápidas" },

            // Flows
            { name: "view_flows", description: "Visualizar Fluxos (Flow Builder)" },
            { name: "manage_flows", description: "Gerenciar Fluxos (Flow Builder)" },

            // Knowledge Bases
            { name: "view_knowledge_bases", description: "Visualizar Bases de Conhecimento" },
            { name: "manage_knowledge_bases", description: "Gerenciar Bases de Conhecimento" },

            // Connections (WhatsApp)
            { name: "view_connections", description: "Visualizar Conexões" },
            { name: "manage_connections", description: "Gerenciar Conexões" }
        ];

        const now = new Date();

        await queryInterface.bulkInsert(
            "Permissions",
            permissions.map((p) => ({
                ...p,
                createdAt: now,
                updatedAt: now,
            })),
            { ignoreDuplicates: true } as any
        );
    },

    down: async (queryInterface: QueryInterface) => {
        // In strict production we might not want to delete these blindly, 
        // but for reversibility in this task:
        const permissionNames = [
            "create_contacts", "edit_contacts", "delete_contacts",
            "delete_tickets",
            "view_quick_answers", "manage_quick_answers",
            "view_flows", "manage_flows",
            "view_knowledge_bases", "manage_knowledge_bases",
            "view_connections", "manage_connections"
        ];

        await queryInterface.bulkDelete("Permissions", {
            name: permissionNames
        });
    },
};
