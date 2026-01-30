import Permission from "../../models/Permission";

const ListPermissionsService = async (): Promise<Permission[]> => {
  const permissions = await Permission.findAll({
    attributes: ["id", "name", "description"],
    order: [["name", "ASC"]]
  });

  return permissions;
};

export default ListPermissionsService;
