import Tenant from "../../models/Tenant";

const ListTenantsService = async (): Promise<Tenant[]> => {
  const tenants = await Tenant.findAll({
    order: [["name", "ASC"]]
  });

  return tenants;
};

export default ListTenantsService;
