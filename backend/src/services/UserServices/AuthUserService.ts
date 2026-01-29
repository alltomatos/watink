import User from "../../models/User";
import AppError from "../../errors/AppError";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";
import { SerializeUser } from "../../helpers/SerializeUser";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import Group from "../../models/Group";
import Permission from "../../models/Permission";
import Plugin from "../../models/Plugin";
import PluginInstallation from "../../models/PluginInstallation";
import Tenant from "../../models/Tenant";
import Role from "../../models/Role";
import { Op } from "sequelize";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  queues: Queue[];
  tenantId: number | string;
  tenant?: Tenant;
}

interface Request {
  email: string;
  password: string;
}

interface Response {
  serializedUser: SerializedUser;
  token: string;
  refreshToken: string;
}

const AuthUserService = async ({
  email,
  password
}: Request): Promise<Response> => {


  const user = await User.findOne({
    where: { email },
    include: [
      { model: Tenant, as: "tenant", attributes: ["id", "name", "status"] },
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name"] },
      {
        model: Group,
        as: "groups",
        include: [
          {
            model: Role,
            as: "roles",
            include: [{ model: Permission, as: "permissions", attributes: ["id", "resource", "action"] }]
          }
        ]
      },
      {
        model: Role,
        as: "roles",
        include: [{ model: Permission, as: "permissions", attributes: ["id", "resource", "action"] }]
      }
    ]
  });

  if (!user) {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }

  if (process.env.TENANTS === "true" && user.tenant?.status === "inactive") {
    throw new AppError("ERR_TENANT_INACTIVE", 401);
  }

  if (!(await user.checkPassword(password))) {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }

  // Check if user is disabled
  if (user.enabled === false) {
    throw new AppError("ERR_USER_DISABLED", 401);
  }

  // Check if email is verified
  // Enforce verification ONLY if SMTP is active
  if (user.emailVerified === false) {
    const tenantId = user.tenantId;
    let smtpActive = false;

    if (tenantId) {
      const smtpPlugin = await Plugin.findOne({
        where: {
          slug: {
            [Op.like]: "%smtp%"
          }
        }
      });

      if (smtpPlugin) {
        const pluginInstallation = await PluginInstallation.findOne({
          where: {
            tenantId,
            pluginId: smtpPlugin.id,
            status: "active"
          }
        });

        if (pluginInstallation) {
          smtpActive = true;
        }
      }
    }

    if (smtpActive) {
      throw new AppError("ERR_EMAIL_NOT_VERIFIED", 401);
    }
  }

  const token = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  const serializedUser = SerializeUser(user);

  return {
    serializedUser,
    token,
    refreshToken
  };
};

export default AuthUserService;
