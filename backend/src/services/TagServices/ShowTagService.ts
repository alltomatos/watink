import Tag from "../../models/Tag";
import TagGroup from "../../models/TagGroup";
import AppError from "../../errors/AppError";

interface Request {
    id: number;
    tenantId: string;
}

const ShowTagService = async ({ id, tenantId }: Request): Promise<Tag> => {
    const tag = await Tag.findOne({
        where: { id, tenantId },
        include: [
            {
                model: TagGroup,
                as: "group",
                attributes: ["id", "name"]
            }
        ]
    });

    if (!tag) {
        throw new AppError("ERR_TAG_NOT_FOUND", 404);
    }

    return tag;
};

export default ShowTagService;
