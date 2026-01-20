import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Tenant from "../../models/Tenant";

interface TenantData {
  name?: string;
  status?: string;
  ownerId?: number;
}

interface Request {
  tenantData: TenantData;
  tenantId: string;
}

const UpdateTenantService = async ({
  tenantData,
  tenantId
}: Request): Promise<Tenant> => {
  const tenant = await Tenant.findByPk(tenantId);

  if (!tenant) {
    throw new AppError("ERR_NO_TENANT_FOUND", 404);
  }

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
  });

  const { name, status, ownerId } = tenantData;

  try {
    await schema.validate({ name });
  } catch (err) {
    throw new AppError(err.message);
  }

  await tenant.update({
    name,
    status,
    ownerId
  });

  return tenant;
};

export default UpdateTenantService;
