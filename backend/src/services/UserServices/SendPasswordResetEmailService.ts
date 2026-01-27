import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";
import { Op } from "sequelize";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import TenantSmtpSettings from "../../models/TenantSmtpSettings";
import PluginInstallation from "../../models/PluginInstallation";
import Plugin from "../../models/Plugin";
import EmailTemplate from "../../models/EmailTemplate";
import RabbitMQService from "../RabbitMQService";

const SendPasswordResetEmailService = async (email: string, appUrl: string): Promise<void> => {
    const user = await User.findOne({ where: { email } });

    if (!user) {
        throw new AppError("ERR_USER_NOT_FOUND", 404);
    }

    const token = crypto.randomBytes(20).toString("hex");
    const now = new Date();
    now.setHours(now.getHours() + 1); // Expires in 1 hour

    await user.update({
        passwordResetToken: token,
        passwordResetExpires: now
    });

    const tenantId = user.tenantId;

    if (!tenantId) {
        // If user has no tenant, we cannot send email via tenant SMTP. 
        // This needs custom handling but usually simple users have tenantId.
        // For superadmins without tenant, logic might differ.
        return;
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
        where: { name: "password_reset", tenantId }
    });

    let subject = "";
    let html = "";
    let text = "";

    const frontendUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;

    const view = {
        name: user.name,
        email: user.email,
        companyName: "Watink",
        token,
        frontendUrl
    };

    if (template) {
        const Mustache = require("mustache");
        subject = Mustache.render(template.subject, view);
        html = Mustache.render(template.html, view);
        text = template.text ? Mustache.render(template.text, view) : "";
    } else {
        // Fallback default
        subject = "Redefinição de Senha";
        html = `
            <p>Olá ${user.name},</p>
            <p>Para redefinir sua senha, clique no link abaixo:</p>
            <p><a href="${frontendUrl}/reset-password/${token}">Redefinir Senha</a></p>
        `;
        text = `Para redefinir sua senha, acesse: ${frontendUrl}/reset-password/${token}`;
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

export default SendPasswordResetEmailService;
