import api from "./api";

export type AssistantMode = "pipeline" | "flow" | "persona" | "router";

export interface Assistant {
    id: number;
    name: string;
    description: string;
    whatsappId: number | null;
    allowMultipleOnConnection: boolean;
    mode: AssistantMode;
    config: Record<string, unknown>;
    triggerType: "any" | "keyword";
    triggerOperator: string;
    triggerValue: string;
    sessionExpiryMinutes: number | null;
    typingDelayMs: number | null;
    debounceSeconds: number | null;
    endKeyword: string | null;
    expiryMessage: string | null;
    closingMessage: string | null;
    stopOnHumanReply: boolean;
    ignoreGroups: boolean;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export type AssistantInput = Omit<Assistant, "id" | "createdAt" | "updatedAt">;

export interface AssistantRouterOption {
    id: number;
    routerAssistantId: number;
    label: string;
    order: number;
    targetAssistantId: number;
    createdAt: string;
    updatedAt: string;
}

export const listAssistants = async (): Promise<Assistant[]> => {
    const { data } = await api.get("/assistants");
    return Array.isArray(data) ? data : [];
};

export const getAssistant = async (id: number): Promise<Assistant> => {
    const { data } = await api.get(`/assistants/${id}`);
    return data;
};

export const createAssistant = async (input: Partial<AssistantInput>): Promise<Assistant> => {
    const { data } = await api.post("/assistants", input);
    return data;
};

export const updateAssistant = async (
    id: number,
    input: Partial<AssistantInput>
): Promise<Assistant> => {
    const { data } = await api.put(`/assistants/${id}`, input);
    return data;
};

export const deleteAssistant = async (id: number): Promise<void> => {
    await api.delete(`/assistants/${id}`);
};

export const duplicateAssistant = async (id: number): Promise<Assistant> => {
    const { data } = await api.post(`/assistants/${id}/duplicate`);
    return data;
};

export const listRouterOptions = async (assistantId: number): Promise<AssistantRouterOption[]> => {
    const { data } = await api.get(`/assistants/${assistantId}/router-options`);
    return Array.isArray(data) ? data : [];
};

export const createRouterOption = async (
    assistantId: number,
    input: { label: string; order: number; targetAssistantId: number }
): Promise<AssistantRouterOption> => {
    const { data } = await api.post(`/assistants/${assistantId}/router-options`, input);
    return data;
};

export const updateRouterOption = async (
    assistantId: number,
    optionId: number,
    input: { label: string; order: number; targetAssistantId: number }
): Promise<AssistantRouterOption> => {
    const { data } = await api.put(`/assistants/${assistantId}/router-options/${optionId}`, input);
    return data;
};

export const deleteRouterOption = async (assistantId: number, optionId: number): Promise<void> => {
    await api.delete(`/assistants/${assistantId}/router-options/${optionId}`);
};
