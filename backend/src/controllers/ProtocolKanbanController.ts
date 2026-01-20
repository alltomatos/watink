import { Request, Response } from "express";
import Protocol from "../models/Protocol";
import Contact from "../models/Contact";

interface KanbanColumn {
    status: string;
    label: string;
    color: string;
    bgColor: string;
    protocols: Protocol[];
}

const COLUMNS_CONFIG: Omit<KanbanColumn, 'protocols'>[] = [
    { status: "open", label: "Aberto", color: "#2196F3", bgColor: "#E3F2FD" },
    { status: "in_progress", label: "Em Andamento", color: "#FF9800", bgColor: "#FFF3E0" },
    { status: "pending", label: "Pendente", color: "#9E9E9E", bgColor: "#F5F5F5" },
    { status: "resolved", label: "Resolvido", color: "#4CAF50", bgColor: "#E8F5E9" },
    { status: "closed", label: "Fechado", color: "#616161", bgColor: "#EEEEEE" }
];

export const index = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;

    const protocols = await Protocol.findAll({
        where: { tenantId },
        include: [
            {
                model: Contact,
                as: "contact",
                attributes: ["id", "name", "number", "profilePicUrl"]
            }
        ],
        order: [["createdAt", "DESC"]]
    });

    const columns: KanbanColumn[] = COLUMNS_CONFIG.map(col => ({
        ...col,
        protocols: protocols.filter(p => p.status === col.status)
    }));

    return res.json({ columns });
};
