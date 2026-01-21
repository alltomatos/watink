import AppError from "../../errors/AppError";
import EmailTemplate from "../../models/EmailTemplate";

interface Request {
    id: string;
    tenantId: number | string;
}

const ShowEmailTemplateService = async ({
    id,
    tenantId
}: Request): Promise<EmailTemplate> => {
    const emailTemplate = await EmailTemplate.findOne({
        where: { id, tenantId }
    });

    if (!emailTemplate) {
        throw new AppError("ERR_NO_EMAIL_TEMPLATE_FOUND", 404);
    }

    return emailTemplate;
};

export default ShowEmailTemplateService;
