import AppError from "../../errors/AppError";
import EmailTemplate from "../../models/EmailTemplate";
import ShowEmailTemplateService from "./ShowEmailTemplateService";

interface EmailTemplateData {
    name?: string;
    subject?: string;
    html?: string;
    text?: string;
}

interface Request {
    emailTemplateData: EmailTemplateData;
    emailTemplateId: string;
    tenantId: number | string;
}

const UpdateEmailTemplateService = async ({
    emailTemplateData,
    emailTemplateId,
    tenantId
}: Request): Promise<EmailTemplate> => {
    const emailTemplate = await ShowEmailTemplateService({
        id: emailTemplateId,
        tenantId
    });

    await emailTemplate.update(emailTemplateData);

    return emailTemplate;
};

export default UpdateEmailTemplateService;
