import AppError from "../../errors/AppError";
import Pipeline from "../../models/Pipeline";

const DeletePipelineService = async (id: string, tenantId: number | string): Promise<void> => {
    const pipeline = await Pipeline.findOne({
        where: { id, tenantId }
    });

    if (!pipeline) {
        throw new AppError("ERR_NO_PIPELINE_FOUND", 404);
    }

    await pipeline.destroy();
};

export default DeletePipelineService;
