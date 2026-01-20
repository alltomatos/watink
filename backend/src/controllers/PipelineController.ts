import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";

import CreatePipelineService from "../services/PipelineServices/CreatePipelineService";
import ListPipelineService from "../services/PipelineServices/ListPipelineService";
import UpdatePipelineService from "../services/PipelineServices/UpdatePipelineService";
import DeletePipelineService from "../services/PipelineServices/DeletePipelineService";
import AIService from "../services/PipelineServices/AIService";

export const index = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const pipelines = await ListPipelineService({ tenantId });
    return res.status(200).json(pipelines);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { name, type, description, stages } = req.body;

    const pipeline = await CreatePipelineService({
        name,
        type,
        description,
        stages,
        tenantId
    });

    return res.status(201).json(pipeline);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { pipelineId } = req.params;
    const { name, description, color } = req.body;

    const pipeline = await UpdatePipelineService({
        id: pipelineId,
        name,
        description,
        color,
        tenantId
    });

    return res.status(200).json(pipeline);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { pipelineId } = req.params;

    await DeletePipelineService(pipelineId, tenantId);

    return res.status(200).json({ message: "Pipeline deleted" });
};

export const aiSuggest = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { messages } = req.body;

    const suggestion = await AIService(messages, tenantId);
    return res.json(suggestion);
};

export const exportPipeline = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { pipelineId } = req.params;

    const pipeline = await ListPipelineService({ tenantId });
    const selectedPipeline = pipeline.find(p => p.id === Number(pipelineId));

    if (!selectedPipeline) {
        throw new AppError("Pipeline not found", 404);
    }

    const exportData = {
        name: selectedPipeline.name,
        description: selectedPipeline.description,
        type: selectedPipeline.type,
        stages: selectedPipeline.stages.map(stage => ({ name: stage.name }))
    };

    return res.json(exportData);
};

export const importPipeline = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { name, type, description, stages } = req.body;

    const schema = Yup.object().shape({
        name: Yup.string().required(),
        stages: Yup.array().of(
            Yup.object().shape({
                name: Yup.string().required()
            })
        ).required()
    });

    try {
        await schema.validate({ name, stages });
    } catch (err: any) {
        throw new AppError(err.message);
    }

    const pipeline = await CreatePipelineService({
        name,
        type: type || "kanban",
        description,
        stages,
        tenantId
    });

    return res.status(201).json(pipeline);
};
