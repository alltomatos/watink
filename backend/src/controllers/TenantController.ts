import { Request, Response } from "express";
import CreateTenantService from "../services/TenantServices/CreateTenantService";
import ListTenantsService from "../services/TenantServices/ListTenantsService";
import ShowTenantService from "../services/TenantServices/ShowTenantService";
import UpdateTenantService from "../services/TenantServices/UpdateTenantService";
import DeleteTenantService from "../services/TenantServices/DeleteTenantService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const tenants = await ListTenantsService();

  return res.status(200).json(tenants);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, status, ownerId } = req.body;

  const tenant = await CreateTenantService({
    name,
    status,
    ownerId
  });

  return res.status(200).json(tenant);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.params;

  const tenant = await ShowTenantService(tenantId);

  return res.status(200).json(tenant);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.params;
  const tenantData = req.body;

  const tenant = await UpdateTenantService({ tenantData, tenantId });

  return res.status(200).json(tenant);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.params;

  await DeleteTenantService(tenantId);

  return res.status(200).json({ message: "Tenant deleted" });
};
