import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";

interface DealData {
    title?: string;
    value?: number;
    priority?: number;
    contactId?: number;
    ticketId?: number;
    pipelineId?: number;
    stageId?: number;
}

interface Request {
    dealData: DealData;
    dealId: number | string;
    tenantId: number | string;
}

const UpdateDealService = async ({
    dealData,
    dealId,
    tenantId
}: Request): Promise<Deal> => {
    const deal = await Deal.findOne({
        where: { id: dealId, tenantId },
        include: ["contact", "ticket"]
    });

    if (!deal) {
        throw new AppError("ERR_NO_DEAL_FOUND", 404);
    }

    const { title, value, priority, contactId, ticketId, pipelineId, stageId } = dealData;

    await deal.update({
        title,
        value,
        priority,
        contactId,
        ticketId,
        pipelineId,
        stageId
    });

    await deal.reload();

    return deal;
};

export default UpdateDealService;
