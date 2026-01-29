import * as Yup from "yup";
import { Request, Response } from "express";
import AppError from "../errors/AppError";
import Group from "../models/Group";
import Role from "../models/Role";
import User from "../models/User";
import Permission from "../models/Permission"; // Keep for listPermissions

type StoreGroupData = {
    name: string;
    roleIds?: number[];
    userIds?: number[];
};

type UpdateGroupData = {
    name: string;
    roleIds?: number[];
    userIds?: number[];
};

export const index = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;

    const groups = await Group.findAll({
        where: { tenantId },
        include: [
            { model: Role, as: "roles", attributes: ["id", "name"] },
            { model: User, as: "users", attributes: ["id", "name"] }
        ]
    });

    return res.json(groups);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const data: StoreGroupData = req.body;

    const schema = Yup.object().shape({
        name: Yup.string().required()
    });

    try {
        await schema.validate(data);
    } catch (err: any) {
        throw new AppError(err.message);
    }

    const group = await Group.create({
        name: data.name,
        tenantId
    });

    if (data.roleIds && data.roleIds.length > 0) {
        const roles = await Role.findAll({ where: { id: data.roleIds } });
        await group.$set("roles", roles, { through: { tenantId } });
    }

    if (data.userIds && data.userIds.length > 0) {
        const users = await User.findAll({ where: { id: data.userIds, tenantId } });
        await group.$set("users", users);
    }



    await group.reload({
        include: [
            { model: Role, as: "roles" },
            { model: User, as: "users" }
        ]
    });

    return res.status(200).json(group);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
    const { groupId } = req.params;
    const { tenantId } = req.user;

    const group = await Group.findOne({
        where: { id: groupId, tenantId },
        include: [
            { model: Role, as: "roles" },
            { model: User, as: "users", attributes: ["id", "name", "email"] }
        ]
    });

    if (!group) {
        throw new AppError("ERR_NO_GROUP_FOUND", 404);
    }

    return res.json(group);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
    const { groupId } = req.params;
    const { tenantId } = req.user;
    const data: UpdateGroupData = req.body;

    const schema = Yup.object().shape({
        name: Yup.string()
    });

    try {
        await schema.validate(data);
    } catch (err: any) {
        throw new AppError(err.message);
    }

    const group = await Group.findOne({
        where: { id: groupId, tenantId }
    });

    if (!group) {
        throw new AppError("ERR_NO_GROUP_FOUND", 404);
    }

    await group.update({ name: data.name });

    if (data.roleIds) {
        const roles = await Role.findAll({ where: { id: data.roleIds } });
        await group.$set("roles", roles, { through: { tenantId } });
    }

    if (data.userIds) {
        const users = await User.findAll({ where: { id: data.userIds, tenantId } });
        await group.$set("users", users);
    }



    await group.reload({
        include: [
            { model: Role, as: "roles" },
            { model: User, as: "users" }
        ]
    });

    return res.json(group);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
    const { groupId } = req.params;
    const { tenantId } = req.user;

    const group = await Group.findOne({
        where: { id: groupId, tenantId }
    });

    if (!group) {
        throw new AppError("ERR_NO_GROUP_FOUND", 404);
    }

    await group.destroy();

    return res.status(200).json({ message: "Group deleted" });
};

export const listPermissions = async (req: Request, res: Response): Promise<Response> => {
    // Mantém listagem de Permissões (Capabilities) para UI de criação de Roles (se houver)
    // Se o frontend esperar Roles aqui, devemos ajustar. Mas o nome é listPermissions.
    const permissions = await Permission.findAll();
    return res.json(permissions);
};
