export interface WhatsappOption {
    id: number;
    name: string;
    status?: string;
}

/** Errors from the plugin's gating layers need distinct UI states, not a generic toast (plan §6.5). */
export type GroupsApiErrorKind = "blocked" | "rateLimited" | "notSupported" | "generic";

export interface GroupsApiError {
    kind: GroupsApiErrorKind;
    message: string;
}

export function classifyGroupsApiError(err: unknown): GroupsApiError {
    const status = (err as { response?: { status?: number } })?.response?.status;
    const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Erro inesperado ao gerenciar grupos.";
    switch (status) {
        case 402:
            return { kind: "blocked", message };
        case 429:
            return { kind: "rateLimited", message };
        case 501:
            return { kind: "notSupported", message };
        default:
            return { kind: "generic", message };
    }
}
