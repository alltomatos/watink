import Role from "../../models/Role";
import Permission from "../../models/Permission";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import { RedisService } from "../RedisService";

interface RoleData {
  name: string;
  description?: string;
  permissionIds?: number[];
}

const UpdateRoleService = async (
  roleId: string | number,
  roleData: RoleData
): Promise<Role> => {
  const { name, description, permissionIds } = roleData;

  const role = await Role.findByPk(roleId);

  if (!role) {
    throw new AppError("ERR_NO_ROLE_FOUND", 404);
  }

  // Validate permissionIds if provided
  if (permissionIds && permissionIds.length > 0) {
    const count = await Permission.count({
      where: {
        id: permissionIds
      }
    });
    if (count !== permissionIds.length) {
      throw new AppError("ERR_INVALID_PERMISSION_IDS", 400);
    }
  }

  const transaction = await sequelize.transaction();

  try {
    await role.update(
      { name, description },
      { transaction }
    );

    if (permissionIds) {
      await role.$set("permissions", permissionIds, { transaction });
    }

    await transaction.commit();

    // Clear permissions cache for all users of this tenant
    // Role change might affect many users. Safest is to clear tenant-wide perms cache
    const redis = RedisService.getInstance();
    const keys = await redis.getKeys(`perms:${role.tenantId}:*`);
    if (keys.length > 0) {
      await redis.delValue(keys);
    }

    await role.reload({
      include: [
        {
          model: Permission,
          as: "permissions",
          attributes: ["id", "resource", "action", "description"],
          through: { attributes: [] }
        }
      ]
    });

    return role;
  } catch (err) {
    await transaction.rollback();
    throw new AppError("ERR_UPDATING_ROLE", 500);
  }
};

export default UpdateRoleService;
