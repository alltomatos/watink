import { QueryInterface, DataTypes, Op } from "sequelize";

interface TagSeedData {
    name: string;
    color: string;
    icon: string;
    groupName: string;
}

const defaultTags: TagSeedData[] = [
    // Status do Cliente
    { name: "VIP", color: "amber", icon: "star", groupName: "Status" },
    { name: "Novo Lead", color: "green", icon: "sparkles", groupName: "Status" },
    { name: "Cliente Ativo", color: "blue", icon: "check-circle", groupName: "Status" },
    { name: "Cliente Inativo", color: "gray", icon: "pause-circle", groupName: "Status" },
    { name: "Inadimplente", color: "red", icon: "alert-triangle", groupName: "Status" },

    // Origem do Contato
    { name: "Site", color: "cyan", icon: "globe", groupName: "Origem" },
    { name: "Indicação", color: "purple", icon: "users", groupName: "Origem" },
    { name: "WhatsApp", color: "green", icon: "message-circle", groupName: "Origem" },
    { name: "Instagram", color: "pink", icon: "instagram", groupName: "Origem" },
    { name: "Facebook", color: "blue", icon: "facebook", groupName: "Origem" },
    { name: "Anúncio", color: "orange", icon: "megaphone", groupName: "Origem" },

    // Prioridade
    { name: "Urgente", color: "red", icon: "flame", groupName: "Prioridade" },
    { name: "Alta", color: "orange", icon: "arrow-up", groupName: "Prioridade" },
    { name: "Normal", color: "gray", icon: "minus", groupName: "Prioridade" },
    { name: "Baixa", color: "sky", icon: "arrow-down", groupName: "Prioridade" },

    // Interesse (para Deals/Pipelines)
    { name: "Interessado", color: "lime", icon: "thumbs-up", groupName: "Interesse" },
    { name: "Negociando", color: "yellow", icon: "handshake", groupName: "Interesse" },
    { name: "Fechado", color: "emerald", icon: "check", groupName: "Interesse" },
    { name: "Perdido", color: "rose", icon: "x", groupName: "Interesse" },
];

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Buscar todos os tenants existentes
        const tenants = await queryInterface.sequelize.query(
            `SELECT id FROM "Tenants"`,
            { type: "SELECT" }
        ) as { id: string }[];

        if (!tenants || tenants.length === 0) {
            console.log("[seed-default-tags] Nenhum tenant encontrado, pulando seed.");
            return;
        }

        for (const tenant of tenants) {
            const tenantId = tenant.id;

            // Criar grupos únicos
            const groupNames = [...new Set(defaultTags.map(t => t.groupName))];

            for (let i = 0; i < groupNames.length; i++) {
                const groupName = groupNames[i];

                // Verificar se já existe
                const existing = await queryInterface.sequelize.query(
                    `SELECT id FROM "TagGroups" WHERE "tenantId" = :tenantId AND "name" = :name`,
                    { replacements: { tenantId, name: groupName }, type: "SELECT" }
                ) as { id: number }[];

                if (existing.length === 0) {
                    await queryInterface.bulkInsert("TagGroups", [{
                        tenantId,
                        name: groupName,
                        description: `Grupo de tags: ${groupName}`,
                        order: i,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }]);
                }
            }

            // Buscar IDs dos grupos criados
            const groups = await queryInterface.sequelize.query(
                `SELECT id, name FROM "TagGroups" WHERE "tenantId" = :tenantId`,
                { replacements: { tenantId }, type: "SELECT" }
            ) as { id: number; name: string }[];

            const groupMap = new Map(groups.map(g => [g.name, g.id]));

            // Criar tags
            for (const tagData of defaultTags) {
                const groupId = groupMap.get(tagData.groupName);

                // Verificar se já existe
                const existing = await queryInterface.sequelize.query(
                    `SELECT id FROM "Tags" WHERE "tenantId" = :tenantId AND "name" = :name`,
                    { replacements: { tenantId, name: tagData.name }, type: "SELECT" }
                ) as { id: number }[];

                if (existing.length === 0) {
                    await queryInterface.bulkInsert("Tags", [{
                        tenantId,
                        groupId,
                        name: tagData.name,
                        color: tagData.color,
                        icon: tagData.icon,
                        description: null,
                        archived: false,
                        usageCount: 0,
                        createdBy: null,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }]);
                }
            }

            console.log(`[seed-default-tags] Tags criadas para tenant ${tenantId}`);
        }
    },

    down: async (queryInterface: QueryInterface) => {
        // Remover apenas as tags padrão (não as customizadas)
        const tagNames = defaultTags.map(t => t.name);
        await queryInterface.bulkDelete("Tags", {
            name: { [Op.in]: tagNames }
        });

        const groupNames = [...new Set(defaultTags.map(t => t.groupName))];
        await queryInterface.bulkDelete("TagGroups", {
            name: { [Op.in]: groupNames }
        });
    }
};
