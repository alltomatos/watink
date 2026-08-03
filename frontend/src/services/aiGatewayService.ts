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

export interface AiGatewayTestResult {
    success: boolean;
    reply?: string;
    elapsedMs?: number;
    error?: string;
}

/** Dispara uma chamada REAL de completion contra o provedor/modelo/chave
 * configurados (ver AiGatewayController.Test no backend) — não é um ping,
 * é a mesma chamada que rodaria numa geração de verdade. */
export const testAiGateway = async (id: number, message?: string): Promise<AiGatewayTestResult> => {
    const { data } = await api.post(`/ai-gateways/${id}/test`, message ? { message } : {});
    return data;
};
