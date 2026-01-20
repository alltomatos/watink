import Pipeline from "../../models/Pipeline";
import PipelineStage from "../../models/PipelineStage";
import AppError from "../../errors/AppError";

interface Request {
    tenantId: number | string;
}

const ListPipelineService = async ({ tenantId }: Request): Promise<Pipeline[]> => {
    console.log("DEBUG: ListPipelineService called with tenantId:", tenantId);

    if (!tenantId) {
        throw new AppError("Err: Tenant ID missing in request. Please login again.", 403);
    }

    try {
        const pipelines = await Pipeline.findAll({
            where: { tenantId },
            include: [
                {
                    model: PipelineStage,
                    as: "stages",
                    attributes: ["id", "name", "order", "color"]
                }
            ],
            order: [["createdAt", "DESC"]]
        });
        console.log("DEBUG: ListPipelineService found pipelines:", pipelines.length);
        return pipelines;
    } catch (err) {
        console.error("DEBUG: ListPipelineService ERROR:", err);
        throw err;
    }
};

export default ListPipelineService;
