import Tag from "../../models/Tag";
import TagGroup from "../../models/TagGroup";

interface Request {
    tenantId: string;
    includeArchived?: boolean;
    groupId?: number;
}

const ListTagsService = async ({
    tenantId,
    includeArchived = false,
    groupId
}: Request): Promise<Tag[]> => {
    const whereClause: any = { tenantId };

    if (!includeArchived) {
        whereClause.archived = false;
    }

    if (groupId) {
        whereClause.groupId = groupId;
    }

    const tags = await Tag.findAll({
        where: whereClause,
        include: [
            {
                model: TagGroup,
                as: "group",
                attributes: ["id", "name"]
            }
        ],
        order: [
            ["groupId", "ASC"],
            ["name", "ASC"]
        ]
    });

    return tags;
};

export default ListTagsService;
