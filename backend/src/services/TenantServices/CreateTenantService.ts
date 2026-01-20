import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Tenant from "../../models/Tenant";

interface Request {
  name: string;
  status?: string;
  ownerId?: number;
}

const CreateTenantService = async ({
  name,
  status,
  ownerId
}: Request): Promise<Tenant> => {
  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
  });

  try {
    await schema.validate({ name });
  } catch (err) {
    throw new AppError(err.message);
  }

  const tenant = await Tenant.create({
    name,
    status,
    ownerId
  });

  return tenant;
};

export default CreateTenantService;
