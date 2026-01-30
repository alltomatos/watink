import Role from "../../models/Role";
import Permission from "../../models/Permission";
import AppError from "../../errors/AppError";
import sequelize from "../../database";

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

    await role.reload({
      include: [
        {
          model: Permission,
          as: "permissions",
          attributes: ["id", "name", "description"],
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
