import * as Yup from "yup";
import { v4 as uuidv4 } from "uuid";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import User from "../../models/User";
import Permission from "../../models/Permission";
import ShowUserService from "./ShowUserService";

interface Request {
  email: string;
  password: string;
  name: string;
  queueIds?: number[];
  profile?: string;
  whatsappId?: number;
  groupIds?: number[];
  groupId?: number;
  permissionIds?: number[];
  permissions?: number[];
  tenantId?: number | string;
}

import Tenant from "../../models/Tenant";
import TenantSmtpSettings from "../../models/TenantSmtpSettings";
import PluginInstallation from "../../models/PluginInstallation";
import Plugin from "../../models/Plugin";
import EmailTemplate from "../../models/EmailTemplate";
import RabbitMQService from "../RabbitMQService";
import { getPremiumWelcomeEmail } from "../../helpers/EmailTemplates";
import { Op } from "sequelize";
import SendVerificationEmailService from "./SendVerificationEmailService";

interface Response {
  email: string;
  name: string;
  id: number;
  profile: string;
}

const CreateUserService = async ({
  email,
  password,
  name,
  queueIds = [],
  profile = "admin",
  whatsappId,
  groupIds = [],
  groupId,
  permissionIds = [],
  permissions = [],
  tenantId
}: Request): Promise<Response> => {
  let finalGroupIds = [...groupIds];
  if (groupId && !finalGroupIds.includes(groupId)) {
    finalGroupIds.push(groupId);
  }
  
  const finalPermissionIds = permissionIds.length > 0 ? permissionIds : permissions;
  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    email: Yup.string()
      .email()
      .required()
      .test(
        "Check-email",
        "An user with this email already exists.",
        async value => {
          if (!value) return false;
          const emailExists = await User.findOne({
            where: { email: value }
          });
          return !emailExists;
        }
      ),
    password: Yup.string().required().min(5)
  });

  try {
    await schema.validate({ email, password, name });
  } catch (err) {
    throw new AppError(err.message);
  }

  /*
   * Check if SMTP Plugin is active.
   * If NOT active, we simply create the user as verified and don't send the email.
   * "if the smtp plugin is not active the system must behave as if they do not exist"
   */
  let emailVerified = false;

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

      if (!pluginInstallation) {
        emailVerified = true;
      }
    } else {
      emailVerified = true;
    }
  } else {
    // If no tenant (e.g. superadmin creation?), default behavior?
    // Usually superadmin is created seeded.
    // Use default false or true? If no SMTP context, maybe true?
    // Let's assume true for safety if no tenant context exists for SMTP.
    emailVerified = true;
  }

  if (process.env.TENANTS === "true" && tenantId) {
    const tenant = await Tenant.findOne({ where: { id: tenantId } });
    if (tenant) {
      const userCount = await User.count({ where: { tenantId } });
      if (userCount >= tenant.maxUsers) {
        throw new AppError("ERR_MAX_USERS_REACHED", 403);
      }
    }
  }

  const user = await User.create(
    {
      email,
      password,
      name,
      profile,
      whatsappId: whatsappId ? whatsappId : null,
      tenantId,
      emailVerified
    },
    { include: ["queues", "whatsapp"] }
  );

  if (profile === "superadmin") {
    // Superadmin logic handled by Roles seeding or direct Role assignment
    // const allPermissions = await Permission.findAll();
    // await user.$set("permissions", allPermissions);
  } else {
    await user.$set("queues", queueIds);
    await user.$set("groups", finalGroupIds, { through: { tenantId } });
    await user.$set("permissions", finalPermissionIds, { through: { tenantId } });
  }

  // Send Verification Email (Async)
  if (tenantId && !emailVerified) {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    try {
      await SendVerificationEmailService(email, frontendUrl);
    } catch (err) {
      console.error("Failed to send verification email", err);
    }
  }

  // await user.reload();
  const createdUser = await ShowUserService(user.id);

  return SerializeUser(createdUser);
};




export default CreateUserService;
