import AppError from "../../errors/AppError";
import EmailTemplate from "../../models/EmailTemplate";

interface Request {
    name: string;
    subject: string;
    html: string;
    text?: string;
    tenantId: number | string;
}

const CreateEmailTemplateService = async ({
    name,
    subject,
    html,
    text,
    tenantId
}: Request): Promise<EmailTemplate> => {
    const emailTemplate = await EmailTemplate.create({
        name,
        subject,
        html,
        text,
        tenantId
    });

    return emailTemplate;
};

export default CreateEmailTemplateService;
