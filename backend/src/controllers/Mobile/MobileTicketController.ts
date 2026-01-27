import { Request, Response } from "express";
import ListTicketsService from "../../services/TicketServices/ListTicketsService";
import Ticket from "../../models/Ticket";

interface MobileTicketResponse {
    id: number;
    uuid: string;
    contactName: string;
    contactProfilePic: string;
    lastMessage: string;
    unreadCount: number;
    queueId: number | null;
    status: string;
    updatedAt: Date;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
    const { pageNumber, status, searchParam, showAll, queueIds, withUnreadMessages, isGroup } = req.query;
    const { id: userId, tenantId } = req.user;

    // Utilize existing heavy service
    const { tickets, count, hasMore } = await ListTicketsService({
        searchParam: searchParam as string,
        pageNumber: pageNumber as string,
        status: status as string,
        date: undefined,
        showAll: showAll as string,
        userId,
        queueIds: (queueIds as string[]) ? (queueIds as string[]).map(Number) : [],
        withUnreadMessages: withUnreadMessages as string,
        isGroup: isGroup as string,
        tenantId
    });

    // BFF Transformation (Lightweight Payload)
    const mobileTickets: MobileTicketResponse[] = tickets.map((ticket: Ticket) => {
        return {
            id: ticket.id,
            uuid: ticket.uuid,
            contactName: ticket.contact?.name || "Unknown",
            contactProfilePic: ticket.contact?.profilePicUrl || "",
            lastMessage: ticket.lastMessage || "",
            unreadCount: ticket.unreadMessages || 0,
            queueId: ticket.queueId,
            status: ticket.status,
            updatedAt: ticket.updatedAt
        };
    });

    return res.json({
        tickets: mobileTickets,
        count,
        hasMore,
        timestamp: new Date().toISOString()
    });
};
