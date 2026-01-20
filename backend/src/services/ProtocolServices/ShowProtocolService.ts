import Protocol from "../../models/Protocol";
import ProtocolHistory from "../../models/ProtocolHistory";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";

const ShowProtocolService = async (
    protocolId: number,
    tenantId: string | number
): Promise<Protocol> => {
    const protocol = await Protocol.findOne({
        where: { id: protocolId, tenantId },
        include: [
            { model: Contact, as: "contact" },
            { model: User, as: "user" },
            { model: Ticket, as: "ticket" },
            {
                model: ProtocolHistory,
                as: "history",
                include: [{ model: User, as: "user" }],
                order: [["createdAt", "DESC"]]
            }
        ]
    });

    if (!protocol) {
        throw new AppError("ERR_PROTOCOL_NOT_FOUND", 404);
    }

    return protocol;
};

export default ShowProtocolService;
