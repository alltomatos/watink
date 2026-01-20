import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Step from "../../models/Step";
import Queue from "../../models/Queue";

interface StepData {
    name: string;
    color?: string;
    order?: number;
    isBindingStep?: boolean;
    queueId: number;
    tenantId?: string | number;
}

const CreateStepService = async (stepData: StepData): Promise<Step> => {
    const { name, color, order, isBindingStep, queueId, tenantId } = stepData;

    const stepSchema = Yup.object().shape({
        name: Yup.string()
            .min(2, "ERR_STEP_INVALID_NAME")
            .required("ERR_STEP_INVALID_NAME"),
        color: Yup.string()
            .matches(/^#[0-9a-f]{3,6}$/i, "ERR_STEP_INVALID_COLOR")
            .nullable(),
        order: Yup.number().min(0).default(0),
        isBindingStep: Yup.boolean().default(false),
        queueId: Yup.number().required("ERR_STEP_QUEUE_REQUIRED")
    });

    try {
        await stepSchema.validate({ name, color, order, isBindingStep, queueId });
    } catch (err: any) {
        throw new AppError(err.message);
    }

    // Verify queue exists
    const queue = await Queue.findByPk(queueId);
    if (!queue) {
        throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
    }

    // If no order provided, set to next available
    let stepOrder = order;
    if (stepOrder === undefined) {
        const maxOrderStep = await Step.findOne({
            where: { queueId },
            order: [["order", "DESC"]],
            attributes: ["order"]
        });
        stepOrder = maxOrderStep ? maxOrderStep.order + 1 : 0;
    }

    const step = await Step.create({
        name,
        color: color || "#808080",
        order: stepOrder,
        isBindingStep: isBindingStep || false,
        queueId,
        tenantId
    });

    return step;
};

export default CreateStepService;
