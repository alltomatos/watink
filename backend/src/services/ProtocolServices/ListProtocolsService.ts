import { Op } from "sequelize";
import Protocol from "../../models/Protocol";
import ProtocolHistory from "../../models/ProtocolHistory";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Ticket from "../../models/Ticket";

interface ListProtocolsParams {
    tenantId: string | number;
    searchParam?: string;
    pageNumber?: string | number;
    status?: string;
    priority?: string;
    contactId?: number;
    ticketId?: number;
}

interface ListProtocolsResult {
    protocols: Protocol[];
    count: number;
    hasMore: boolean;
}

const ListProtocolsService = async ({
    tenantId,
    searchParam = "",
    pageNumber = "1",
    status,
    priority,
    contactId,
    ticketId
}: ListProtocolsParams): Promise<ListProtocolsResult> => {
    const limit = 20;
    const offset = limit * (Number(pageNumber) - 1);

    const whereCondition: any = {
        tenantId
    };

    if (searchParam) {
        whereCondition[Op.or] = [
            { protocolNumber: { [Op.iLike]: `%${searchParam}%` } },
            { subject: { [Op.iLike]: `%${searchParam}%` } }
        ];
    }

    if (status) {
        whereCondition.status = status;
    }

    if (priority) {
        whereCondition.priority = priority;
    }

    if (contactId) {
        whereCondition.contactId = contactId;
    }

    if (ticketId) {
        whereCondition.ticketId = ticketId;
    }

    const { count, rows: protocols } = await Protocol.findAndCountAll({
        where: whereCondition,
        include: [
            { model: Contact, as: "contact" },
            { model: User, as: "user" },
            { model: Ticket, as: "ticket" }
        ],
        limit,
        offset,
        order: [["createdAt", "DESC"]]
    });

    const hasMore = count > offset + protocols.length;

    return {
        protocols,
        count,
        hasMore
    };
};

export default ListProtocolsService;
