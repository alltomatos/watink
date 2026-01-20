-- =============================================================================
-- Query de Diagnóstico RBAC: Permissões de um Usuário
-- =============================================================================
-- Substitua os parâmetros :userId e :tenantId antes de executar.
-- Esta query mostra a origem de cada permissão (Direta ou Nome do Grupo).
-- =============================================================================

WITH user_direct_permissions AS (
    -- Permissões diretas do usuário (via UserPermissions)
    SELECT 
        p.name AS permission_name,
        'DIRETA' AS source
    FROM "UserPermissions" up
    JOIN "Permissions" p ON up."permissionId" = p.id
    WHERE up."userId" = :userId
      AND up."tenantId" = :tenantId
),
user_groups AS (
    -- Grupos aos quais o usuário pertence (via UserGroups)
    SELECT 
        g.id AS group_id,
        g.name AS group_name
    FROM "UserGroups" ug
    JOIN "Groups" g ON ug."groupId" = g.id
    WHERE ug."userId" = :userId
      AND ug."tenantId" = :tenantId
),
group_permissions AS (
    -- Permissões herdadas de cada grupo
    SELECT 
        p.name AS permission_name,
        ug.group_name AS source
    FROM user_groups ug
    JOIN "GroupPermissions" gp ON gp."groupId" = ug.group_id
    JOIN "Permissions" p ON gp."permissionId" = p.id
    WHERE gp."tenantId" = :tenantId
),
all_permissions AS (
    -- União de todas as permissões
    SELECT permission_name, source FROM user_direct_permissions
    UNION ALL
    SELECT permission_name, source FROM group_permissions
)

-- =============================================================================
-- Resultado Final: Lista consolidada com origem
-- =============================================================================
SELECT 
    permission_name,
    string_agg(DISTINCT source, ', ') AS sources
FROM all_permissions
GROUP BY permission_name
ORDER BY permission_name;

-- =============================================================================
-- Query Auxiliar: Apenas listar grupos do usuário
-- =============================================================================
-- SELECT g.id, g.name 
-- FROM "UserGroups" ug
-- JOIN "Groups" g ON ug."groupId" = g.id
-- WHERE ug."userId" = :userId AND ug."tenantId" = :tenantId;
