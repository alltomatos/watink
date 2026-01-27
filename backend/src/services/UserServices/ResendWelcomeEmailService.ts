import { v4 as uuidv4 } from "uuid";
import { Op } from "sequelize";

import User from "../../models/User";
import AppError from "../../errors/AppError";
import TenantSmtpSettings from "../../models/TenantSmtpSettings";
import PluginInstallation from "../../models/PluginInstallation";
import Plugin from "../../models/Plugin";
import EmailTemplate from "../../models/EmailTemplate";
import RabbitMQService from "../RabbitMQService";
import { getPremiumWelcomeEmail } from "../../helpers/EmailTemplates";

const ResendWelcomeEmailService = async (
    userId: string,
    tenantId: number | string
): Promise<void> => {
    const user = await User.findByPk(userId);

    if (!user) {
        throw new AppError("ERR_USER_NOT_FOUND", 404);
    }

    if (!tenantId) {
        throw new AppError("ERR_TENANT_NOT_FOUND", 400);
    }

    // Check for Active SMTP Plugin
    const smtpPlugin = await Plugin.findOne({
        where: {
            slug: {
                [Op.like]: "%smtp%"
            }
        }
    });

    if (!smtpPlugin) {
        throw new AppError("ERR_SMTP_PLUGIN_NOT_FOUND", 400);
    }

    const pluginInstallation = await PluginInstallation.findOne({
        where: {
            tenantId,
            pluginId: smtpPlugin.id,
            status: "active"
        }
    });

    if (!pluginInstallation) {
        throw new AppError("ERR_SMTP_PLUGIN_NOT_ACTIVE", 400);
    }

    const smtpSettings = await TenantSmtpSettings.findOne({
        where: { tenantId }
    });

    if (!smtpSettings) {
        throw new AppError("ERR_SMTP_NOT_CONFIGURED", 400);
    }

    // Check for Custom Template
    let template = await EmailTemplate.findOne({
        where: { name: "welcome_premium", tenantId }
    });

    let subject = "";
    let html = "";
    let text = "";

    if (template) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const view = {
            name: user.name,
            email: user.email,
            password: "[Por segurança, a senha não pode ser reenviada. Solicite uma redefinição se necessário.]",
            companyName: "Watink",
            frontendUrl
        };
        const Mustache = require("mustache");
        subject = Mustache.render(template.subject, view);
        html = Mustache.render(template.html, view);
        text = template.text ? Mustache.render(template.text, view) : "";
    } else {
        // Default Premium Template (without exposing password)
        const defaultTemplate = getPremiumWelcomeEmail(
            user.name,
            user.email,
            "[Por segurança, a senha não pode ser reenviada. Solicite uma redefinição se necessário.]"
        );
        subject = defaultTemplate.subject;
        html = defaultTemplate.html;
        text = defaultTemplate.text;
    }

    const payload = {
        tenantId,
        ...smtpSettings.toJSON(),
        to: user.email,
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
};

export default ResendWelcomeEmailService;
