import Client from "../../models/Client";
import ClientContact from "../../models/ClientContact";
import ClientAddress from "../../models/ClientAddress";
import AppError from "../../errors/AppError";

const ShowClientService = async (
    clientId: number,
    tenantId: string | number
): Promise<Client> => {
    const client = await Client.findOne({
        where: { id: clientId, tenantId },
        include: [
            { model: ClientContact, as: "contacts" },
            { model: ClientAddress, as: "addresses" }
        ]
    });

    if (!client) {
        throw new AppError("ERR_CLIENT_NOT_FOUND", 404);
    }

    return client;
};

export default ShowClientService;
