import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import ProtocolAttachment from "../models/ProtocolAttachment";
import Protocol from "../models/Protocol";
import CreateProtocolAttachmentService from "../services/ProtocolServices/CreateProtocolAttachmentService";
import AppError from "../errors/AppError";

// GET /protocols/:protocolId/attachments
export const index = async (req: Request, res: Response): Promise<Response> => {
    const { protocolId } = req.params;
    const { tenantId } = req.user;

    const attachments = await ProtocolAttachment.findAll({
        where: { protocolId, tenantId },
        order: [["createdAt", "DESC"]]
    });

    return res.json(attachments);
};

// POST /protocols/:protocolId/attachments
export const store = async (req: Request, res: Response): Promise<Response> => {
    const { protocolId } = req.params;
    const { tenantId, id: userId } = req.user;
    const files = req.files as Express.Multer.File[];

    const savedAttachments = await CreateProtocolAttachmentService({
        protocolId: Number(protocolId),
        tenantId,
        userId: Number(userId),
        files
    });

    return res.status(201).json(savedAttachments);
};

// DELETE /protocols/:protocolId/attachments/:attachmentId
export const destroy = async (req: Request, res: Response): Promise<Response> => {
    const { protocolId, attachmentId } = req.params;
    const { tenantId } = req.user;

    const attachment = await ProtocolAttachment.findOne({
        where: { id: attachmentId, protocolId, tenantId }
    });

    if (!attachment) {
        throw new AppError("Anexo não encontrado", 404);
    }

    // Delete file from disk
    const filePath = path.resolve(process.cwd(), "public", attachment.filePath.replace(/^\//, ""));
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    await attachment.destroy();

    return res.json({ message: "Anexo removido com sucesso" });
};

// GET Public attachments (by protocol token)
export const publicIndex = async (req: Request, res: Response): Promise<Response> => {
    const { token } = req.params;

    const protocol = await Protocol.findOne({
        where: { token },
        include: [{ model: ProtocolAttachment, as: "attachments" }]
    });

    if (!protocol) {
        throw new AppError("Protocolo não encontrado", 404);
    }

    return res.json(protocol.attachments || []);
};
