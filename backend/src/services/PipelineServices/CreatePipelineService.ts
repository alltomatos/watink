import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Pipeline from "../../models/Pipeline";
import PipelineStage from "../../models/PipelineStage";

interface StageData {
    name: string;
    color?: string;
}

interface Request {
    name: string;
    type: string;
    description?: string;
    stages: StageData[];
    tenantId: number | string;
}

const CreatePipelineService = async ({
    name,
    type,
    description,
    stages,
    tenantId
}: Request): Promise<Pipeline> => {
    const schema = Yup.object().shape({
        name: Yup.string().required(),
        type: Yup.string().required().oneOf(["kanban", "funnel"]),
        stages: Yup.array().of(
            Yup.object().shape({
                name: Yup.string().required()
            })
        ).required().min(1)
    });

    try {
        await schema.validate({ name, type, stages });
    } catch (err: any) {
        throw new AppError(err.message);
    }

    // Criar Pipeline
    const pipeline = await Pipeline.create({
        name,
        type,
        description,
        tenantId,
        color: '#3B82F6' // Cor default
    });

    // Criar Stages
    if (stages && stages.length > 0) {
        const stagesToCreate = stages.map((stage, index) => ({
            name: stage.name,
            color: stage.color || '#E2E8F0',
            order: index,
            pipelineId: pipeline.id
        }));

        await PipelineStage.bulkCreate(stagesToCreate);
    }

    // Recarregar com stages
    await pipeline.reload({
        include: [
            { model: PipelineStage, as: "stages" }
        ]
    });

    return pipeline;
};

export default CreatePipelineService;
