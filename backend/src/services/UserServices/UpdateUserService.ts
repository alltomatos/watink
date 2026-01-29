import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import ShowUserService from "./ShowUserService";
import Permission from "../../models/Permission";
import { RedisService } from "../../services/RedisService";
import User from "../../models/User";

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  queueIds?: number[];
  whatsappId?: number;
  groupIds?: number[];
  groupId?: number;
  profileImage?: string;
}

interface RequestUser {
  id: string | number;
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
}

const UpdateUserService = async ({
  userData,
  userId,
  requestUser
}: Request): Promise<Response | undefined> => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email(),
    password: Yup.string()
  });

  const {
    email,
    password,
    name,
    queueIds = [],
    whatsappId,
    groupIds = [],
    groupId,
    profileImage
  } = userData;

  console.log("UpdateUserService: Payload received", { userId, groupId, groupIds });

  // Compatibility: Frontend sends groupId (singular) but backend expects groupIds (plural)
  const finalGroupIds = [...groupIds];
  if (groupId) {
    const gid = Number(groupId);
    if (!isNaN(gid) && !finalGroupIds.includes(gid)) {
      finalGroupIds.push(gid);
    }
  }

  console.log("UpdateUserService: Processing", { finalGroupIds });

  try {
    await schema.validate({ email, password, name });
  } catch (err) {
    throw new AppError(err.message);
  }

  await user.update({
    email,
    password,
    name,
    whatsappId: whatsappId ? whatsappId : null,
    profileImage
  });

  try {
    console.log("UpdateUserService: Setting queues...");
    await user.$set("queues", queueIds);

    console.log("UpdateUserService: Setting groups...", finalGroupIds);
    await user.$set("groups", finalGroupIds, { through: { tenantId: requestUser.tenantId } });

    // Invalidate Permission Cache
    console.log("UpdateUserService: Invalidating cache...");
    const redis = RedisService.getInstance();
    await redis.delValue(`perms:${requestUser.tenantId}:${userId}`);
  } catch (error) {
    console.error("UpdateUserService: Error during associations/cache", error);
    throw new AppError("INTERNAL_ERROR_UPDATE_USER_RELATIONS", 500);
  }


  // await user.reload();
  const updatedUser = await ShowUserService(userId);

  return SerializeUser(updatedUser);
};

export default UpdateUserService;
