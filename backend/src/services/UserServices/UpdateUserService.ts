import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import ShowUserService from "./ShowUserService";
import Permission from "../../models/Permission";

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  queueIds?: number[];
  whatsappId?: number;
}

interface RequestUser {
  id: string | number;
  profile: string;
  tenantId: string | number;
}

interface Request {
  userData: UserData;
  userId: string | number;
  requestUser: RequestUser;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
}

const UpdateUserService = async ({
  userData,
  userId,
  requestUser
}: Request): Promise<Response | undefined> => {
  const user = await ShowUserService(userId);

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email(),
    profile: Yup.string(),
    password: Yup.string()
  });

  const {
    email,
    password,
    profile,
    name,
    queueIds = [],
    whatsappId
  } = userData;

  try {
    await schema.validate({ email, password, profile, name });
  } catch (err) {
    throw new AppError(err.message);
  }

  // Protection: prevent editing superadmin if not self
  if (user.profile === "superadmin" && user.id.toString() !== requestUser.id.toString()) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await user.update({
    email,
    password,
    profile,
    name,
    whatsappId: whatsappId ? whatsappId : null
  });

  await user.$set("queues", queueIds);

  // Ensure superadmin has all permissions if profile is being updated to superadmin
  if (profile === "superadmin" || (user.profile === "superadmin" && profile === undefined)) {
    const allPermissions = await Permission.findAll();
    await user.$set("permissions", allPermissions);
  }

  await user.reload();

  return SerializeUser(user);
};

export default UpdateUserService;
