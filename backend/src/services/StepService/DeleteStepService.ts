import AppError from "../../errors/AppError";
import Step from "../../models/Step";
import Ticket from "../../models/Ticket";
import ShowStepService from "./ShowStepService";

const DeleteStepService = async (stepId: number | string): Promise<void> => {
    const step = await ShowStepService(stepId);

    // Check if there are tickets linked to this step
    const ticketCount = await Ticket.count({
        where: { stepId: step.id }
    });

    if (ticketCount > 0) {
        throw new AppError(
            `ERR_STEP_HAS_TICKETS: Cannot delete step with ${ticketCount} linked ticket(s). Move tickets first.`,
            400
        );
    }

    await step.destroy();
};

export default DeleteStepService;
