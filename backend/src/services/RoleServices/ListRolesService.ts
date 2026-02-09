import { Op } from "sequelize";
import Role from "../../models/Role";

interface Request {
  tenantId: number | string;
}

const ListRolesService = async ({ tenantId }: Request): Promise<Role[]> => {
  const roles = await Role.findAll({
    where: {
      tenantId
    },
    order: [["name", "ASC"]]
  });

  return roles;
};

export default ListRolesService;
