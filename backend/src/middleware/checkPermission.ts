import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import User from "../models/User";
import Group from "../models/Group";
import Permission from "../models/Permission";

const checkPermission = (permission: string) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const { id } = req.user;

        const user = await User.findByPk(id, {
            include: [
                {
                    model: Group,
                    as: "group",
                    include: [{ model: Permission, as: "permissions" }]
                },
                {
                    model: Permission,
                    as: "permissions"
                }
            ]
        });

        if (!user) {
            throw new AppError("User not found", 401);
        }

        // Super Admin by profile fallback
        if (user.profile === "admin" || user.profile === "superadmin") {
            return next();
        }

        const groupPermissions = user.group?.permissions?.map(p => p.name) || [];
        const individualPermissions = user.permissions?.map(p => p.name) || [];

        // Merge permissions
        const allPermissions = [...new Set([...groupPermissions, ...individualPermissions])];

        if (!allPermissions.includes(permission)) {
            throw new AppError("ERR_NO_PERMISSION", 403);
        }

        return next();
    };
};

export default checkPermission;
