import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ListPermissionsService from "../services/PermissionServices/ListPermissionsService";
import ShowRoleService from "../services/RoleServices/ShowRoleService";
import UpdateRoleService from "../services/RoleServices/UpdateRoleService";
import * as Yup from "yup";

export const listPermissions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const permissions = await ListPermissionsService();
  return res.status(200).json(permissions);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { roleId } = req.params;
  const role = await ShowRoleService(roleId);
  return res.status(200).json(role);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { roleId } = req.params;
  const roleData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    description: Yup.string().nullable(),
    permissionIds: Yup.array().of(Yup.number())
  });

  try {
    await schema.validate(roleData);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const role = await UpdateRoleService(roleId, roleData);

  return res.status(200).json(role);
};
