import { Request, Response } from "express";
import Protocol from "../models/Protocol";
import ProtocolHistory from "../models/ProtocolHistory";
import ProtocolAttachment from "../models/ProtocolAttachment";
import User from "../models/User";
import Tenant from "../models/Tenant";
import AppError from "../errors/AppError";

export const show = async (req: Request, res: Response): Promise<Response> => {
    const { token } = req.params;

    const protocol = await Protocol.findOne({
        where: { token },
        include: [
            {
                model: Tenant,
                as: "tenant",
                attributes: ["name"]
            },
            {
                model: ProtocolAttachment,
                as: "attachments",
                attributes: ["id", "fileName", "originalName", "fileType", "fileSize", "filePath", "createdAt"]
            },
            {
                model: ProtocolHistory,
                as: "history",
                include: [
                    {
                        model: User,
                        as: "user",
                        attributes: ["name"]
                    }
                ],
                order: [["createdAt", "DESC"]]
            }
        ],
        attributes: [
            "id",
            "protocolNumber",
            "subject",
            "description",
            "status",
            "priority",
            "createdAt",
            "resolvedAt",
            "closedAt"
        ]
    });

    if (!protocol) {
        throw new AppError("Protocol not found", 404);
    }

    return res.json(protocol);
};
