import api from "./api";

export interface AiGateway {
    id: number;
    name: string;
    provider: string;
    baseUrl: string | null;
    model: string;
    hasApiKey: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AiGatewayInput {
    name: string;
    provider: string;
    apiKey?: string;
    baseUrl?: string | null;
    model: string;
}

export const listAiGateways = async (): Promise<AiGateway[]> => {
    const { data } = await api.get("/ai-gateways");
    return Array.isArray(data) ? data : [];
};

export const createAiGateway = async (input: AiGatewayInput): Promise<AiGateway> => {
    const { data } = await api.post("/ai-gateways", input);
    return data;
};

export const updateAiGateway = async (id: number, input: AiGatewayInput): Promise<AiGateway> => {
    const { data } = await api.put(`/ai-gateways/${id}`, input);
    return data;
};

export const deleteAiGateway = async (id: number): Promise<void> => {
    await api.delete(`/ai-gateways/${id}`);
};
