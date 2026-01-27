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

const SendVerificationEmailService = async (email: string, appUrl: string): Promise<void> => {
    const user = await User.findOne({ where: { email } });

    if (!user) {
        throw new AppError("ERR_USER_NOT_FOUND", 404);
    }

    const token = crypto.randomBytes(20).toString("hex");

    await user.update({
        verificationToken: token
    });

    const tenantId = user.tenantId;

    if (!tenantId) {
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
        where: { name: "email_validation", tenantId }
    });

    let subject = "";
    let html = "";
    let text = "";

    const frontendUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;

    const view = {
        name: user.name,
        email: user.email,
        companyName: "Watink", // Should ideally come from tenant settings
        token,
        frontendUrl,
        verifyUrl: `${frontendUrl}/verify-email/${token}`
    };

    if (template) {
        const Mustache = require("mustache");
        subject = Mustache.render(template.subject, view);
        html = Mustache.render(template.html, view);
        text = template.text ? Mustache.render(template.text, view) : "";
    } else {
        // Fallback default
        subject = "Verifique seu E-mail";
        html = `
            <p>Olá ${user.name},</p>
            <p>Por favor, confirme seu endereço de e-mail clicando no link abaixo:</p>
            <p><a href="${frontendUrl}/verify-email/${token}">Confirmar E-mail</a></p>
        `;
        text = `Por favor, confirme seu endereço de e-mail acessando: ${frontendUrl}/verify-email/${token}`;
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

export default SendVerificationEmailService;
