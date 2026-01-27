import Tag from "../../models/Tag";
import AppError from "../../errors/AppError";

interface Request {
    id: number;
    tenantId: string;
    name?: string;
    color?: string;
    icon?: string;
    description?: string;
    groupId?: number;
    archived?: boolean;
}

const UpdateTagService = async ({
    id,
    tenantId,
    name,
    color,
    icon,
    description,
    groupId,
    archived
}: Request): Promise<Tag> => {
    const tag = await Tag.findOne({
        where: { id, tenantId }
    });

    if (!tag) {
        throw new AppError("ERR_TAG_NOT_FOUND", 404);
    }

    // Se estiver alterando o nome, verificar unicidade
    if (name && name !== tag.name) {
        const existingTag = await Tag.findOne({
            where: { tenantId, name }
        });

        if (existingTag) {
            throw new AppError("ERR_TAG_ALREADY_EXISTS", 400);
        }
    }

    await tag.update({
        name: name !== undefined ? name : tag.name,
        color: color !== undefined ? color : tag.color,
        icon: icon !== undefined ? icon : tag.icon,
        description: description !== undefined ? description : tag.description,
        groupId: groupId !== undefined ? groupId : tag.groupId,
        archived: archived !== undefined ? archived : tag.archived
    });

    await tag.reload();

    return tag;
};

export default UpdateTagService;
