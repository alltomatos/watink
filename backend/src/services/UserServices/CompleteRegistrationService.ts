import { v4 as uuidv4 } from "uuid";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import User from "../../models/User";
import Plugin from "../../models/Plugin";
import PluginInstallation from "../../models/PluginInstallation";
import TenantSmtpSettings from "../../models/TenantSmtpSettings";
import EmailTemplate from "../../models/EmailTemplate";
import RabbitMQService from "../RabbitMQService";
import { getPremiumWelcomeEmail } from "../../helpers/EmailTemplates";

interface Request {
    token: string;
    password: string;
}

const CompleteRegistrationService = async ({ token, password }: Request): Promise<User> => {
    const user = await User.findOne({
        where: {
            verificationToken: token
        }
    });

    if (!user) {
        throw new AppError("ERR_INVALID_TOKEN", 400);
    }

    // Updating with 'password' triggers the BeforeUpdate hook to hash it
    await user.update({
        password,
        emailVerified: true,
        verificationToken: null
    });

    // Send Welcome Email
    if (user.tenantId) {
        const tenantId = user.tenantId;

        try {
            // Check for Active SMTP Plugin
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
                     const smtpSettings = await TenantSmtpSettings.findOne({
                        where: { tenantId }
                    });

                    if (smtpSettings) {
                        // Check for Custom Template
                        let template = await EmailTemplate.findOne({
                            where: { name: "welcome_premium", tenantId }
                        });

                        let subject = "";
                        let html = "";
                        let text = "";
                        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

                        if (template) {
                            const view = {
                                name: user.name,
                                email: user.email,
                                password: "Sua senha foi definida com sucesso.",
                                companyName: "Watink",
                                frontendUrl
                            };
                            const Mustache = require("mustache");
                            subject = Mustache.render(template.subject, view);
                            html = Mustache.render(template.html, view);
                            text = template.text ? Mustache.render(template.text, view) : "";
                        } else {
                            // Default Premium Template
                            const defaultTemplate = getPremiumWelcomeEmail(
                                user.name,
                                user.email,
                                "Sua senha foi definida com sucesso."
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
                    }
                }
            }
        } catch (err) {
            console.error("Failed to send welcome email", err);
            // Do not throw error to user, as registration is complete
        }
    }

    return user;
};

export default CompleteRegistrationService;
