import EmailTemplate from "../../models/EmailTemplate";

interface Request {
    tenantId: number | string;
}

const ListEmailTemplatesService = async ({
    tenantId
}: Request): Promise<EmailTemplate[]> => {
    const templates = await EmailTemplate.findAll({
        where: { tenantId },
        order: [["name", "ASC"]]
    });

    return templates;
};

export default ListEmailTemplatesService;
