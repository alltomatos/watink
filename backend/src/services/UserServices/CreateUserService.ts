import * as Yup from "yup";
import { v4 as uuidv4 } from "uuid";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import User from "../../models/User";
import Permission from "../../models/Permission";

interface Request {
  email: string;
  password: string;
  name: string;
  queueIds?: number[];
  profile?: string;
  whatsappId?: number;
  groupIds?: number[];
  tenantId?: number | string;
}

import TenantSmtpSettings from "../../models/TenantSmtpSettings";
import PluginInstallation from "../../models/PluginInstallation";
import Plugin from "../../models/Plugin";
import EmailTemplate from "../../models/EmailTemplate";
import RabbitMQService from "../RabbitMQService";
import { getPremiumWelcomeEmail } from "../../helpers/EmailTemplates";
import { Op } from "sequelize";

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
  tenantId
}: Request): Promise<Response> => {
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

  const user = await User.create(
    {
      email,
      password,
      name,
      profile,
      whatsappId: whatsappId ? whatsappId : null
    },
    { include: ["queues", "whatsapp"] }
  );

  if (profile === "superadmin") {
    const allPermissions = await Permission.findAll();
    await user.$set("permissions", allPermissions);
  } else {
    await user.$set("queues", queueIds);
    await user.$set("groups", groupIds);
  }

  // Send Welcome Email (Async)
  // Send Welcome Email (Async)
  if (tenantId) {
    sendWelcomeEmail(name, email, password, tenantId);
  }

  await user.reload();

  return SerializeUser(user);
};

const sendWelcomeEmail = async (name: string, email: string, password: string, tenantId: number | string) => {
  try {
    if (!tenantId) return;

    // Check for Active SMTP Plugin
    const smtpPlugin = await Plugin.findOne({
      where: {
        slug: {
          [Op.like]: '%smtp%'
        }
      }
    });

    if (!smtpPlugin) return;

    const pluginInstallation = await PluginInstallation.findOne({
      where: {
        tenantId,
        pluginId: smtpPlugin.id,
        status: 'active'
      }
    });

    if (!pluginInstallation) return;

    const smtpSettings = await TenantSmtpSettings.findOne({
      where: { tenantId }
    });

    if (smtpSettings) {
      // Check for Custom Template
      let template = await EmailTemplate.findOne({
        where: { name: 'welcome_premium', tenantId }
      });

      let subject = "";
      let html = "";
      let text = "";

      if (template) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const view = { name, email, password, companyName: "Watink", frontendUrl }; // Simple view for custom template
        const Mustache = require("mustache");
        subject = Mustache.render(template.subject, view);
        html = Mustache.render(template.html, view);
        text = template.text ? Mustache.render(template.text, view) : "";
      } else {
        // Default Premium Template
        const defaultTemplate = getPremiumWelcomeEmail(name, email, password);
        subject = defaultTemplate.subject;
        html = defaultTemplate.html;
        text = defaultTemplate.text;
      }

      const payload = {
        tenantId,
        ...smtpSettings.toJSON(),
        to: email,
        subject,
        text,
        html
      };

      const envelope = {
        id: uuidv4(),
        timestamp: Date.now(),
        type: "smtp.send",
        tenantId,
        payload
      };

      await RabbitMQService.publishCommand("smtp.send", envelope);
    }
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }
};



export default CreateUserService;
