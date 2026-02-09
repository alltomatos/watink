import Permission from "../../models/Permission";

const ListPermissionsService = async (): Promise<Permission[]> => {
  const permissions = await Permission.findAll({
    attributes: ["id", "resource", "action", "description"],
    order: [["resource", "ASC"], ["action", "ASC"]]
  });

  return permissions;
};

export default ListPermissionsService;
