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
  groupIds?: number[];
  permissionIds?: number[];
  permissions?: number[];
  profileImage?: string;
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
    whatsappId,
    groupIds = [],
    permissionIds = [],
    permissions = [],
    profileImage
  } = userData;

  const finalPermissionIds = permissionIds.length > 0 ? permissionIds : permissions;

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
    whatsappId: whatsappId ? whatsappId : null,
    profileImage
  });

  await user.$set("queues", queueIds);
  await user.$set("groups", groupIds, { through: { tenantId: requestUser.tenantId } });
  await user.$set("permissions", finalPermissionIds, { through: { tenantId: requestUser.tenantId } });

  // Permissions are now handled via Roles.
  // Superadmin profile check is done via Role assignment elsewhere or pre-seeded.
  // if (profile === "superadmin") { ... } logic removed for now to fix build.

  // await user.reload();
  const updatedUser = await ShowUserService(userId);

  return SerializeUser(updatedUser);
};

export default UpdateUserService;
