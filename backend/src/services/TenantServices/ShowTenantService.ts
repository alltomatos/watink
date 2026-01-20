import Tenant from "../../models/Tenant";
import AppError from "../../errors/AppError";

const ShowTenantService = async (id: string): Promise<Tenant> => {
  const tenant = await Tenant.findByPk(id);

  if (!tenant) {
    throw new AppError("ERR_NO_TENANT_FOUND", 404);
  }

  return tenant;
};

export default ShowTenantService;
