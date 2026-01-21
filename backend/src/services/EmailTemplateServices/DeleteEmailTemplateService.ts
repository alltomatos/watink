import AppError from "../../errors/AppError";
import EmailTemplate from "../../models/EmailTemplate";
import ShowEmailTemplateService from "./ShowEmailTemplateService";

interface Request {
    id: string;
    tenantId: number | string;
}

const DeleteEmailTemplateService = async ({
    id,
    tenantId
}: Request): Promise<void> => {
    const emailTemplate = await ShowEmailTemplateService({ id, tenantId });

    await emailTemplate.destroy();
};

export default DeleteEmailTemplateService;
