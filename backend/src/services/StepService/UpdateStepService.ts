import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Step from "../../models/Step";
import ShowStepService from "./ShowStepService";

interface StepData {
    name?: string;
    color?: string;
    order?: number;
    isBindingStep?: boolean;
}

const UpdateStepService = async (
    stepId: number | string,
    stepData: StepData
): Promise<Step> => {
    const { name, color, order, isBindingStep } = stepData;

    const stepSchema = Yup.object().shape({
        name: Yup.string().min(2, "ERR_STEP_INVALID_NAME").nullable(),
        color: Yup.string()
            .matches(/^#[0-9a-f]{3,6}$/i, "ERR_STEP_INVALID_COLOR")
            .nullable(),
        order: Yup.number().min(0).nullable(),
        isBindingStep: Yup.boolean().nullable()
    });

    try {
        await stepSchema.validate({ name, color, order, isBindingStep });
    } catch (err: any) {
        throw new AppError(err.message);
    }

    const step = await ShowStepService(stepId);

    await step.update(stepData);

    return step;
};

export default UpdateStepService;
