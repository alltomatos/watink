import User from "../../models/User";
import Group from "../../models/Group";
import Permission from "../../models/Permission";
import UserPermission from "../../models/UserPermission";
import GroupPermission from "../../models/GroupPermission";
import UserGroup from "../../models/UserGroup";

interface GetUserPermissionsResult {
    directPermissions: string[];
    groupPermissions: { groupName: string; permissions: string[] }[];
    allPermissions: string[];
}

/**
 * Obtém todas as permissões de um usuário, fazendo a união das permissões diretas
 * com as permissões herdadas de todos os grupos aos quais pertence.
 * 
 * @param userId - ID do usuário
 * @param tenantId - UUID do tenant para isolamento
 * @returns Objeto contendo permissões diretas, por grupo e consolidadas (deduplicadas)
 */
const GetUserPermissionsService = async (
    userId: number,
    tenantId: string
): Promise<GetUserPermissionsResult> => {
    // 1. Buscar permissões diretas do usuário (via UserPermissions)
    const userWithDirectPermissions = await User.findByPk(userId, {
        include: [
            {
                model: Permission,
                as: "permissions",
                through: { attributes: [] }, // Não incluir dados da tabela pivô
                where: { "$UserPermission.tenantId$": tenantId } as any,
                required: false
            }
        ]
    });

    const directPermissions: string[] = userWithDirectPermissions?.permissions?.map(
        (p) => p.name
    ) || [];

    // 2. Buscar grupos do usuário (via UserGroups - Many-to-Many)
    const userGroups = await UserGroup.findAll({
        where: { userId, tenantId },
        include: [
            {
                model: Group,
                include: [
                    {
                        model: Permission,
                        as: "permissions",
                        through: { attributes: [] }
                    }
                ]
            }
        ]
    });

    // 3. Extrair permissões de cada grupo
    const groupPermissions: { groupName: string; permissions: string[] }[] = [];
    const allGroupPermissionNames: string[] = [];

    for (const userGroup of userGroups) {
        const group = userGroup.group;
        if (group && group.permissions) {
            const permissionNames = group.permissions.map((p) => p.name);
            groupPermissions.push({
                groupName: group.name,
                permissions: permissionNames
            });
            allGroupPermissionNames.push(...permissionNames);
        }
    }

    // 4. Fazer a União e Deduplicar (Merge Strategy)
    const allPermissionsSet = new Set<string>([
        ...directPermissions,
        ...allGroupPermissionNames
    ]);

    const allPermissions = Array.from(allPermissionsSet).sort();

    return {
        directPermissions,
        groupPermissions,
        allPermissions
    };
};

export default GetUserPermissionsService;
