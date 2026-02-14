import * as Yup from "yup";
import { Request, Response } from "express";
import AppError from "../errors/AppError";
import Group from "../models/Group";
import Permission from "../models/Permission";
import User from "../models/User";

type StoreGroupData = {
    name: string;
    permissions?: number[];
    userIds?: number[];
};

type UpdateGroupData = {
    name: string;
    permissions?: number[];
    userIds?: number[];
};

type GroupFilter = {
    searchParam?: string;
    pageNumber?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { tenantId } = req.user;
        console.log("DEBUG: GroupController.index tenantId:", tenantId, "UserID:", req.user.id);
        console.log("DEBUG: GroupController.index tenantId:", tenantId, "User:", req.user);

        const groups = await Group.findAll({
            where: { tenantId },
            include: [
                { model: Permission, as: "permissions", attributes: ["id", "name"] },
                { model: User, as: "users", attributes: ["id", "name"] }
            ]
        });

        return res.json(groups);
    } catch (err) {
        console.error("DEBUG: GroupController.index Error:", err);
        throw new AppError("INTERNAL_SERVER_ERROR", 500);
    }
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

    if (data.permissions && data.permissions.length > 0) {
        await group.$set("permissions", data.permissions);
    }

    // Associar IDs de permissão pivot com tenantId (Se necessário customizar a pivot, faríamos loop)
    // Mas como a pivot tem tenantId, o sequelize pode não preencher auto se usarmos apenas $set ids.
    // Vamos corrigir isso: para GroupPermission precisamos setar tenantId.
    // Como o Sequelize BelongsToMany set padrão é simples, é melhor iterar se quisermos garantir tenantId na pivot.
    // OBS: Na migration, GroupPermissions.tenantId é NotNull.
    // Vamos usar addPermissions passando through options.

    if (data.permissions && data.permissions.length > 0) {
        const permissions = await Permission.findAll({ where: { id: data.permissions } });
        await group.$set("permissions", permissions, { through: { tenantId } });
    }

    if (data.userIds && data.userIds.length > 0) {
        const users = await User.findAll({ where: { id: data.userIds, tenantId } });
        await group.$set("users", users);
    }

    await group.reload({
        include: [
            { model: Permission, as: "permissions" },
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
            { model: Permission, as: "permissions" },
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

    if (data.permissions) {
        // Atualiza permissões garantindo tenantId na pivot
        const permissions = await Permission.findAll({ where: { id: data.permissions } });
        await group.$set("permissions", permissions, { through: { tenantId } });
    }

    if (data.userIds) {
        const users = await User.findAll({ where: { id: data.userIds, tenantId } });
        await group.$set("users", users);
    }

    await group.reload({
        include: [
            { model: Permission, as: "permissions" },
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
    // Listar todas as permissões disponíveis (Seeds globais ou custom)
    const permissions = await Permission.findAll();
    return res.json(permissions);
};
