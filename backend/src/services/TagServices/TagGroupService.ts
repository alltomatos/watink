import TagGroup from "../../models/TagGroup";
import AppError from "../../errors/AppError";

interface ListRequest {
    tenantId: string;
}

interface CreateRequest {
    tenantId: string;
    name: string;
    description?: string;
    order?: number;
}

interface UpdateRequest {
    id: number;
    tenantId: string;
    name?: string;
    description?: string;
    order?: number;
}

interface DeleteRequest {
    id: number;
    tenantId: string;
}

export const ListTagGroups = async ({ tenantId }: ListRequest): Promise<TagGroup[]> => {
    return TagGroup.findAll({
        where: { tenantId },
        order: [["order", "ASC"], ["name", "ASC"]]
    });
};

export const CreateTagGroup = async ({
    tenantId,
    name,
    description,
    order = 0
}: CreateRequest): Promise<TagGroup> => {
    // Verificar unicidade
    const existing = await TagGroup.findOne({
        where: { tenantId, name }
    });

    if (existing) {
        throw new AppError("ERR_TAG_GROUP_ALREADY_EXISTS", 400);
    }

    return TagGroup.create({
        tenantId,
        name,
        description,
        order
    });
};

export const UpdateTagGroup = async ({
    id,
    tenantId,
    name,
    description,
    order
}: UpdateRequest): Promise<TagGroup> => {
    const group = await TagGroup.findOne({
        where: { id, tenantId }
    });

    if (!group) {
        throw new AppError("ERR_TAG_GROUP_NOT_FOUND", 404);
    }

    // Verificar unicidade se nome mudou
    if (name && name !== group.name) {
        const existing = await TagGroup.findOne({
            where: { tenantId, name }
        });

        if (existing) {
            throw new AppError("ERR_TAG_GROUP_ALREADY_EXISTS", 400);
        }
    }

    await group.update({
        name: name !== undefined ? name : group.name,
        description: description !== undefined ? description : group.description,
        order: order !== undefined ? order : group.order
    });

    return group;
};

export const DeleteTagGroup = async ({ id, tenantId }: DeleteRequest): Promise<void> => {
    const group = await TagGroup.findOne({
        where: { id, tenantId }
    });

    if (!group) {
        throw new AppError("ERR_TAG_GROUP_NOT_FOUND", 404);
    }

    // Tags do grupo serão atualizadas para groupId = null (SET NULL no FK)
    await group.destroy();
};

export default {
    ListTagGroups,
    CreateTagGroup,
    UpdateTagGroup,
    DeleteTagGroup
};
