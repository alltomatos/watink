import Ticket from "../../models/Ticket";
import UpdateTicketService from "./UpdateTicketService";
import { logger } from "../../utils/logger";
import { Op } from "sequelize";

interface Request {
    tenantId: string | number;
    userId: number;
    statusOpen?: boolean;
    statusPending?: boolean;
    includeGroups?: boolean;
}

const CloseAllTicketsService = async ({
    tenantId,
    userId,
    statusOpen = true,
    statusPending = true,
    includeGroups = false
}: Request): Promise<number> => {

    const statusFilter: string[] = [];
    if (statusOpen) statusFilter.push("open");
    if (statusPending) statusFilter.push("pending");

    // Se nenhum status for selecionado, não faz nada
    if (statusFilter.length === 0) return 0;

    const whereCondition: any = {
        tenantId,
        status: {
            [Op.in]: statusFilter
        }
    };

    if (!includeGroups) {
        whereCondition.isGroup = false;
    }

    const tickets = await Ticket.findAll({
        where: whereCondition
    });

    let closedCount = 0;

    for (const ticket of tickets) {
        try {
            await UpdateTicketService({
                ticketData: {
                    status: "closed",
                    userId
                },
                ticketId: ticket.id
            });
            closedCount++;
        } catch (error) {
            logger.error(`Error closing ticket ${ticket.id} in CloseAllTicketsService:`, error);
        }
    }

    return closedCount;
};

export default CloseAllTicketsService;
