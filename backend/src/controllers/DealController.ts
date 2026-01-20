import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";

import CreateDealService from "../services/DealServices/CreateDealService";
import ListDealsService from "../services/DealServices/ListDealsService";
import UpdateDealService from "../services/DealServices/UpdateDealService";
import DeleteDealService from "../services/DealServices/DeleteDealService";

export const index = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { searchParam, pageNumber, pipelineId, stageId, ticketId } = req.query as any;

    const { deals, count, hasMore } = await ListDealsService({
        searchParam,
        pageNumber,
        pipelineId,
        stageId,
        ticketId,
        tenantId
    });

    return res.json({ deals, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const dealData = { ...req.body, tenantId };

    const schema = Yup.object().shape({
        title: Yup.string().required(),
        contactId: Yup.number().required(),
        pipelineId: Yup.number().required()
    });

    try {
        await schema.validate(dealData);
    } catch (err: any) {
        throw new AppError(err.message);
    }

    const deal = await CreateDealService(dealData);

    return res.status(200).json(deal);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { dealId } = req.params;
    const dealData = req.body;

    const deal = await UpdateDealService({ dealData, dealId, tenantId });

    return res.status(200).json(deal);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { dealId } = req.params;

    await DeleteDealService({ id: dealId, tenantId });

    return res.status(200).json({ message: "Deal deleted" });
};
