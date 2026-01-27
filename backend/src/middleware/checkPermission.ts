import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import PermissionService from "../services/PermissionServices/PermissionService";

declare global {
    namespace Express {
        interface Request {
            permissionScope?: any;
        }
    }
}

/**
 * Enterprise Middleware for RBAC
 * Usage: checkPermission("tickets:read") or checkPermission("contacts:process")
 */
const checkPermission = (resourceAction: string) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const { id, tenantId } = req.user;
        const [resource, action] = resourceAction.split(":");

        if (!resource || !action) {
            throw new Error("Invalid permission format. Expected 'resource:action'");
        }

        try {
            const result = await PermissionService.check(parseInt(id.toString()), tenantId, resource, action);

            if (!result.authorized) {
                // Check for Super Admin bypass via Profile ONLY for migration safety
                // Ideally this should be removed once Roles are fully populated
                if (req.user.profile === "superadmin") { // legacy fallback
                    return next();
                }

                throw new AppError("ERR_NO_PERMISSION", 403);
            }

            // Inject scope for controllers
            req.permissionScope = result.scope;

            return next();
        } catch (err) {
            console.error(err);
            if (err instanceof AppError) throw err;
            throw new AppError("ERR_PERMISSION_CHECK_FAILED", 500);
        }
    };
};

export default checkPermission;
