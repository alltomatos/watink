import { Request, Response } from "express";
import User from "../models/User";
import Tenant from "../models/Tenant";
import Whatsapp from "../models/Whatsapp";

export const getStats = async (req: Request, res: Response): Promise<Response> => {
    try {
        const usersCount = await User.count();
        const tenantsCount = await Tenant.count();
        const activeTenantsCount = await Tenant.count({ where: { status: "active" } });
        const connectionsCount = await Whatsapp.count({ where: { status: "CONNECTED" } });
        const totalConnections = await Whatsapp.count();

        return res.status(200).json({
            users: usersCount,
            tenants: {
                total: tenantsCount,
                active: activeTenantsCount,
                inactive: tenantsCount - activeTenantsCount
            },
            connections: {
                connected: connectionsCount,
                total: totalConnections
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
