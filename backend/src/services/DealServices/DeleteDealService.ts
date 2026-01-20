import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";

interface Request {
    id: number | string;
    tenantId: number | string;
}

const DeleteDealService = async ({ id, tenantId }: Request): Promise<void> => {
    const deal = await Deal.findOne({
        where: { id, tenantId }
    });

    if (!deal) {
        throw new AppError("ERR_NO_DEAL_FOUND", 404);
    }

    await deal.destroy();
};

export default DeleteDealService;
