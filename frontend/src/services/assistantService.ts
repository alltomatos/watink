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
    /** "legacy" (padrão) = ignoreGroups decide tudo-ou-nada; "selective" =
     * ignoreGroups é ignorado, cada grupo é ativado individualmente
     * (ver AssistantGroupsPanel) e só recebe resposta quando o assistente
     * é mencionado — fora isso, ele só observa a conversa. */
    groupsMode: "legacy" | "selective";
    acceptsAudio: boolean;
    respondsWithAudio: boolean;
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

export interface AssistantTestResult {
    mode: AssistantMode;
    /** false = modo não gera resposta de texto própria (flow/pipeline sem
     * respondsAfterProactive); `message` explica por quê. Nunca presente
     * junto de `success`. */
    testable?: boolean;
    message?: string;
    /** Presente quando testable !== false — resultado real da chamada. */
    success?: boolean;
    reply?: string;
    action?: string;
    confidence?: number;
    citations?: number[];
    /** Motivo da falha quando success === false (chave inválida, serviço
     * indisponível etc.) — sempre 200 no transporte, nunca 5xx (ver
     * AssistantController.testPersona: um 5xx aqui faz o Cloudflare
     * substituir o corpo pela página de erro genérica dele). */
    error?: string;
}

/** Dispara um turno REAL contra o assistant (ver AssistantController.Test no
 * backend) — mode-aware: persona/pipeline chamam o Agent Runtime de
 * verdade, router devolve o menu real, flow explica que delega a outro
 * fluxo. Nunca finge sucesso. */
export const testAssistant = async (id: number, message?: string): Promise<AssistantTestResult> => {
    const { data } = await api.post(`/assistants/${id}/test`, message ? { message } : {});
    return data;
};

export interface AssistantGroupItem {
    contactId: number;
    name: string;
    number: string;
    active: boolean;
}

/** Lista todo grupo (Contact.isGroup=true) já conhecido do tenant, com
 * `active` refletindo se este assistant específico o enxerga (ver
 * AssistantGroupController.List no backend). Usado pela tela de duas
 * colunas Inativo/Ativo. */
export const listAssistantGroups = async (assistantId: number): Promise<AssistantGroupItem[]> => {
    const { data } = await api.get(`/assistants/${assistantId}/groups`);
    return Array.isArray(data) ? data : [];
};

/** Move um grupo entre as colunas Inativo/Ativo para este assistant. */
export const setAssistantGroupActive = async (
    assistantId: number,
    contactId: number,
    active: boolean
): Promise<void> => {
    await api.put(`/assistants/${assistantId}/groups`, { contactId, active });
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
