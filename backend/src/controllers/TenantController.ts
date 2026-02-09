import { Request, Response } from "express";
import ListTenantsService from "../services/TenantServices/ListTenantsService";
import ShowTenantService from "../services/TenantServices/ShowTenantService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const tenants = await ListTenantsService();

  return res.status(200).json(tenants);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.params;

  const tenant = await ShowTenantService(tenantId);

  return res.status(200).json(tenant);
};
