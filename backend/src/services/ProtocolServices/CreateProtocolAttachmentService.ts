import { Request } from "express";
import fs from "fs";
import path from "path";
import ProtocolAttachment from "../../models/ProtocolAttachment";
import Protocol from "../../models/Protocol";
import ProtocolHistory from "../../models/ProtocolHistory";
import AppError from "../../errors/AppError";

interface AttachmentData {
    protocolId: number;
    tenantId: number | string;
    userId: number;
    files: Express.Multer.File[];
}

const CreateProtocolAttachmentService = async ({
    protocolId,
    tenantId,
    userId,
    files
}: AttachmentData): Promise<ProtocolAttachment[]> => {
    if (!files || files.length === 0) {
        throw new AppError("Nenhum arquivo enviado", 400);
    }

    // Verify protocol exists and belongs to tenant
    const protocol = await Protocol.findOne({
        where: { id: protocolId, tenantId }
    });

    if (!protocol) {
        throw new AppError("Protocolo não encontrado", 404);
    }

    // Create directory for protocol attachments
    const protocolDir = path.resolve(process.cwd(), "public", "protocols", String(protocolId));
    if (!fs.existsSync(protocolDir)) {
        fs.mkdirSync(protocolDir, { recursive: true });
    }

    const savedAttachments: ProtocolAttachment[] = [];

    for (const file of files) {
        // Move file to protocol directory
        const newFileName = `${Date.now()}-${file.originalname.replace(/\s/g, "_")}`;
        const newFilePath = path.join(protocolDir, newFileName);

        // If multer saved to disk, move file. If in memory, write buffer
        if (file.path) {
            fs.renameSync(file.path, newFilePath);
        } else if (file.buffer) {
            fs.writeFileSync(newFilePath, file.buffer);
        }

        const attachment = await ProtocolAttachment.create({
            protocolId,
            tenantId,
            fileName: newFileName,
            originalName: file.originalname,
            filePath: `/protocols/${protocolId}/${newFileName}`,
            fileType: file.mimetype,
            fileSize: file.size,
            uploadedBy: userId
        });

        savedAttachments.push(attachment);
    }

    // Add history entry for attachments
    const fileNames = savedAttachments.map(a => a.originalName).join(", ");
    await ProtocolHistory.create({
        protocolId,
        userId,
        action: "attachment",
        description: `Anexo(s) adicionado(s): ${fileNames}`,
        changes: JSON.stringify({
            files: savedAttachments.map(a => ({
                id: a.id,
                originalName: a.originalName,
                fileType: a.fileType,
                size: a.fileSize,
                filePath: a.filePath
            }))
        })
    });

    return savedAttachments;
};

export default CreateProtocolAttachmentService;
