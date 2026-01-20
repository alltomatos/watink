import AppError from "../../errors/AppError";
import Step from "../../models/Step";

const ShowStepService = async (stepId: number | string): Promise<Step> => {
    const step = await Step.findByPk(stepId, {
        include: [
            {
                association: "queue",
                attributes: ["id", "name", "color"]
            }
        ]
    });

    if (!step) {
        throw new AppError("ERR_STEP_NOT_FOUND", 404);
    }

    return step;
};

export default ShowStepService;
