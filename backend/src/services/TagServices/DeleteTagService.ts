import Tag from "../../models/Tag";
import EntityTag from "../../models/EntityTag";
import AppError from "../../errors/AppError";

interface Request {
    id: number;
    tenantId: string;
    forceDelete?: boolean;
}

/**
 * Deleta uma tag.
 * Por padrão, apenas arquiva a tag (soft delete).
 * Com forceDelete=true, remove completamente (e todas as associações).
 */
const DeleteTagService = async ({
    id,
    tenantId,
    forceDelete = false
}: Request): Promise<void> => {
    const tag = await Tag.findOne({
        where: { id, tenantId }
    });

    if (!tag) {
        throw new AppError("ERR_TAG_NOT_FOUND", 404);
    }

    if (forceDelete) {
        // Remove todas as associações primeiro (CASCADE deveria cuidar disso, mas garantimos)
        await EntityTag.destroy({
            where: { tagId: id }
        });

        await tag.destroy();
    } else {
        // Soft delete - apenas arquiva
        await tag.update({ archived: true });
    }
};

export default DeleteTagService;
