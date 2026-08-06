import api from "./api";

export interface AiGateway {
    id: number;
    name: string;
    provider: string;
    baseUrl: string | null;
    model: string;
    // transcriptionModel/speechModel selecionam os modelos usados nos
    // endpoints OpenAI-compatible /audio/transcriptions e /audio/speech do
    // MESMO gateway — nem todo gateway credencia os mesmos modelos pra chat
    // e pra áudio (ex.: "whisper-1" cru pode não ter credencial). Vazio =
    // Assistant com áudio ligado nesse gateway falha com erro claro.
    transcriptionModel: string | null;
    speechModel: string | null;
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
    transcriptionModel?: string | null;
    speechModel?: string | null;
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

export interface AiGatewayModelsResult {
    success: boolean;
    models?: string[];
    error?: string;
}

/** Consulta {baseUrl}/models do gateway (OpenAI-compatible) com a chave já
 * salva — só funciona para um gateway já existente e com API Key configurada. */
export const listAiGatewayModels = async (id: number): Promise<AiGatewayModelsResult> => {
    const { data } = await api.get(`/ai-gateways/${id}/models`);
    return data;
};
