import Tenant from "../../models/Tenant";
import AppError from "../../errors/AppError";

const DeleteTenantService = async (id: string): Promise<void> => {
  const tenant = await Tenant.findOne({
    where: { id }
  });

  if (!tenant) {
    throw new AppError("ERR_NO_TENANT_FOUND", 404);
  }

  await tenant.destroy();
};

export default DeleteTenantService;
