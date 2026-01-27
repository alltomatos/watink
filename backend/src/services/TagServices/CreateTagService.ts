import Tag from "../../models/Tag";
import AppError from "../../errors/AppError";

interface Request {
    tenantId: string;
    name: string;
    color?: string;
    icon?: string;
    description?: string;
    groupId?: number;
    createdBy?: number;
}

const CreateTagService = async ({
    tenantId,
    name,
    color = "blue",
    icon,
    description,
    groupId,
    createdBy
}: Request): Promise<Tag> => {
    // Verificar se já existe uma tag com esse nome no tenant
    const existingTag = await Tag.findOne({
        where: { tenantId, name }
    });

    if (existingTag) {
        throw new AppError("ERR_TAG_ALREADY_EXISTS", 400);
    }

    const tag = await Tag.create({
        tenantId,
        name,
        color,
        icon,
        description,
        groupId,
        createdBy,
        archived: false,
        usageCount: 0
    });

    return tag;
};

export default CreateTagService;
