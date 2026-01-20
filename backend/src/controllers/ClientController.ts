import { Request, Response } from "express";
import CreateClientService from "../services/ClientServices/CreateClientService";
import ListClientsService from "../services/ClientServices/ListClientsService";
import ShowClientService from "../services/ClientServices/ShowClientService";
import UpdateClientService from "../services/ClientServices/UpdateClientService";
import DeleteClientService from "../services/ClientServices/DeleteClientService";

export const index = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId: tenantId } = req.user;
    const { searchParam, pageNumber, isActive } = req.query;

    const { clients, count, hasMore } = await ListClientsService({
        tenantId: tenantId as string | number,
        searchParam: searchParam as string,
        pageNumber: pageNumber as string,
        isActive: isActive === "true" ? true : isActive === "false" ? false : undefined
    });

    return res.json({ clients, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId: tenantId } = req.user;
    const clientData = req.body;

    const client = await CreateClientService({
        ...clientData,
        tenantId: tenantId as string | number
    });

    return res.status(201).json(client);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId: tenantId } = req.user;
    const { clientId } = req.params;

    const client = await ShowClientService(Number(clientId), tenantId as string | number);

    return res.json(client);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId: tenantId } = req.user;
    const { clientId } = req.params;
    const clientData = req.body;

    const client = await UpdateClientService({
        ...clientData,
        id: Number(clientId),
        tenantId: tenantId as string | number
    });

    return res.json(client);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId: tenantId } = req.user;
    const { clientId } = req.params;

    await DeleteClientService(Number(clientId), tenantId as string | number);

    return res.status(200).json({ message: "Client deleted" });
};
