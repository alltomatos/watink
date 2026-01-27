import { Request, Response } from "express";
import DeviceToken from "../../models/DeviceToken";
import AppError from "../../errors/AppError";

export const saveDeviceToken = async (
    req: Request,
    res: Response
): Promise<Response> => {
    const { token, platform } = req.body;
    const { id: userId, tenantId } = req.user;

    if (!token || !platform) {
        throw new AppError("Token and platform are required", 400);
    }

    // Upsert logic: find existing token for this user or create new
    // Note: One user might have multiple devices, but usually one token per device.
    // If the same physical device logs in, the token usually stays the same.
    // If the token changes (refreshed by FCM), we should update it.

    // Here we use findOrCreate mostly, but if we want to ensure *uniqueness* of token,
    // we should check if this token exists for ANY user and re-assign?
    // Use simple create for now but handle duplicates if logic dictates.

    // Strategy: If token exists for this user, update platform. If not, create.
    const [deviceVal, created] = await DeviceToken.findOrCreate({
        where: { token, userId, tenantId },
        defaults: { token, platform, userId, tenantId: Number(tenantId) }
    });

    if (!created && deviceVal.platform !== platform) {
        await deviceVal.update({ platform });
    }

    return res.status(200).json({ message: "Device token saved" });
};
