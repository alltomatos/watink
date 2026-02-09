import { Request, Response } from "express";
import WatinkGuardProxy from "../services/SaasServices/WatinkGuardProxy";
import AppError from "../errors/AppError";

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, plan, status, externalId, maxUsers, maxConnections } = req.body;

  // Basic validation before sending to proxy
  if (!name || !externalId) {
    throw new AppError("Name and External ID are required", 400);
  }

  const result = await WatinkGuardProxy.createTenant({
    name,
    plan: plan || "basic",
    status: status || "active",
    externalId,
    maxUsers: maxUsers || 10,
    maxConnections: maxConnections || 1
  });

  return res.status(200).json(result);
};

export const indexUsage = async (req: Request, res: Response): Promise<Response> => {
  const result = await WatinkGuardProxy.getUsage();
  return res.status(200).json(result);
};
