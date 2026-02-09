"use strict";

import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Inserir permissões seguindo padrão RBAC Enterprise (resource:action)
        await queryInterface.bulkInsert("Permissions", [
            // Activity Templates (Configuração)
            {
                resource: "activity-template",
                action: "read",
                description: "Visualizar templates de atividades",
                isSystem: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                resource: "activity-template",
                action: "write",
                description: "Criar/editar templates de atividades",
                isSystem: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                resource: "activity-template",
                action: "delete",
                description: "Excluir templates de atividades",
                isSystem: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            // Activities (Execução)
            {
                resource: "activity",
                action: "read",
                description: "Visualizar atividades e RAT",
                isSystem: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                resource: "activity",
                action: "write",
                description: "Criar/editar atividades e checklist",
                isSystem: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                resource: "activity",
                action: "finalize",
                description: "Finalizar atividade e gerar RAT",
                isSystem: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                resource: "activity",
                action: "delete",
                description: "Excluir atividades",
                isSystem: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]);

        // Adicionar permissões ao Role "Admin" automaticamente em todos os Tenants
        await queryInterface.sequelize.query(`
            INSERT INTO "RolePermissions" ("roleId", "permissionId", "tenantId", "createdAt", "updatedAt")
            SELECT r.id, p.id, r."tenantId", NOW(), NOW()
            FROM "Roles" r, "Permissions" p
            WHERE r.name = 'Admin' 
            AND (p.resource = 'activity' OR p.resource = 'activity-template')
            ON CONFLICT DO NOTHING;
        `);
    },

    down: async (queryInterface: QueryInterface) => {
        // Remover permissões do RolePermissions
        await queryInterface.sequelize.query(`
            DELETE FROM "RolePermissions"
            WHERE "permissionId" IN (
                SELECT id FROM "Permissions" 
                WHERE resource IN ('activity', 'activity-template')
            );
        `);

        // Remover permissões
        await queryInterface.bulkDelete("Permissions", {
            resource: ["activity", "activity-template"]
        });
    }
};
