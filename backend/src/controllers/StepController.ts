import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import CreateStepService from "../services/StepService/CreateStepService";
import DeleteStepService from "../services/StepService/DeleteStepService";
import ListStepsService from "../services/StepService/ListStepsService";
import ShowStepService from "../services/StepService/ShowStepService";
import UpdateStepService from "../services/StepService/UpdateStepService";

/**
 * List all steps, optionally filtered by queueId
 * GET /steps?queueId=1
 */
export const index = async (req: Request, res: Response): Promise<Response> => {
    const { queueId } = req.query;

    const steps = await ListStepsService({
        queueId: queueId ? Number(queueId) : undefined
    });

    return res.status(200).json(steps);
};

/**
 * Create a new step
 * POST /steps
 */
export const store = async (req: Request, res: Response): Promise<Response> => {
    const { name, color, order, isBindingStep, queueId } = req.body;

    const step = await CreateStepService({
        name,
        color,
        order,
        isBindingStep,
        queueId
    });

    const io = getIO();
    io.emit("step", {
        action: "create",
        step
    });

    return res.status(201).json(step);
};

/**
 * Get a specific step by ID
 * GET /steps/:stepId
 */
export const show = async (req: Request, res: Response): Promise<Response> => {
    const { stepId } = req.params;

    const step = await ShowStepService(stepId);

    return res.status(200).json(step);
};

/**
 * Update a step
 * PUT /steps/:stepId
 */
export const update = async (
    req: Request,
    res: Response
): Promise<Response> => {
    const { stepId } = req.params;
    const { name, color, order, isBindingStep } = req.body;

    const step = await UpdateStepService(stepId, {
        name,
        color,
        order,
        isBindingStep
    });

    const io = getIO();
    io.emit("step", {
        action: "update",
        step
    });

    return res.status(200).json(step);
};

/**
 * Delete a step
 * DELETE /steps/:stepId
 */
export const remove = async (
    req: Request,
    res: Response
): Promise<Response> => {
    const { stepId } = req.params;

    await DeleteStepService(stepId);

    const io = getIO();
    io.emit("step", {
        action: "delete",
        stepId: +stepId
    });

    return res.status(200).send();
};

/**
 * Reorder steps within a queue
 * PUT /steps/reorder
 * Body: { stepIds: [3, 1, 2] } - Array of step IDs in desired order
 */
export const reorder = async (
    req: Request,
    res: Response
): Promise<Response> => {
    const { stepIds } = req.body;

    if (!Array.isArray(stepIds)) {
        return res.status(400).json({ error: "stepIds must be an array" });
    }

    // Update order for each step
    const updates = stepIds.map(async (stepId: number, index: number) => {
        const step = await ShowStepService(stepId);
        return step.update({ order: index });
    });

    await Promise.all(updates);

    const io = getIO();
    io.emit("step", {
        action: "reorder"
    });

    return res.status(200).json({ success: true });
};
