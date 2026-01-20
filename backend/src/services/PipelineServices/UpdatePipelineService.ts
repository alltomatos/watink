import AppError from "../../errors/AppError";
import Pipeline from "../../models/Pipeline";

interface Request {
    id: string | number;
    name?: string;
    description?: string;
    color?: string;
    tenantId: number | string;
}

const UpdatePipelineService = async ({
    id,
    name,
    description,
    color,
    tenantId
}: Request): Promise<Pipeline> => {
    const pipeline = await Pipeline.findOne({
        where: { id, tenantId }
    });

    if (!pipeline) {
        throw new AppError("ERR_NO_PIPELINE_FOUND", 404);
    }

    await pipeline.update({
        name,
        description,
        color
    });

    return pipeline;
};

export default UpdatePipelineService;
