import { Op } from "sequelize";
import Client from "../../models/Client";
import ClientContact from "../../models/ClientContact";
import ClientAddress from "../../models/ClientAddress";

interface ListClientsParams {
    tenantId: string | number;
    searchParam?: string;
    pageNumber?: string | number;
    isActive?: boolean;
}

interface ListClientsResult {
    clients: Client[];
    count: number;
    hasMore: boolean;
}

const ListClientsService = async ({
    tenantId,
    searchParam = "",
    pageNumber = "1",
    isActive
}: ListClientsParams): Promise<ListClientsResult> => {
    const limit = 20;
    const offset = limit * (Number(pageNumber) - 1);

    const whereCondition: any = {
        tenantId
    };

    if (searchParam) {
        whereCondition[Op.or] = [
            { name: { [Op.iLike]: `%${searchParam}%` } },
            { document: { [Op.iLike]: `%${searchParam}%` } },
            { email: { [Op.iLike]: `%${searchParam}%` } }
        ];
    }

    if (isActive !== undefined) {
        whereCondition.isActive = isActive;
    }

    const { count, rows: clients } = await Client.findAndCountAll({
        where: whereCondition,
        include: [
            { model: ClientContact, as: "contacts" },
            { model: ClientAddress, as: "addresses" }
        ],
        limit,
        offset,
        order: [["name", "ASC"]]
    });

    const hasMore = count > offset + clients.length;

    return {
        clients,
        count,
        hasMore
    };
};

export default ListClientsService;
