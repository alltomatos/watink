import Client from "../../models/Client";
import ClientContact from "../../models/ClientContact";
import ClientAddress from "../../models/ClientAddress";
import AppError from "../../errors/AppError";

const DeleteClientService = async (
    clientId: number,
    tenantId: string | number
): Promise<void> => {
    const client = await Client.findOne({
        where: { id: clientId, tenantId }
    });

    if (!client) {
        throw new AppError("ERR_CLIENT_NOT_FOUND", 404);
    }

    // Cascade delete will handle contacts and addresses
    await client.destroy();
};

export default DeleteClientService;
