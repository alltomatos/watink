import api from "./api";

// Mirrors business/internal/domain/group_engine.go DTOs exactly (same JSON
// tags) — the plugin's REST layer (business/internal/plugins/groups_dto.go)
// passes these through mostly unchanged.

export interface Participant {
    jid: string;
    phoneNumber?: string;
    displayName?: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
}

export interface GroupInfo {
    jid: string;
    subject: string;
    description: string;
    owner: string;
    isCommunity: boolean;
    isSubGroup: boolean;
    parentJID?: string;
    announce: boolean;
    locked: boolean;
    memberAddMode: string;
    joinApprovalMode: boolean;
    pictureURL?: string;
    createdAt: number;
    participants: Participant[];
}

export interface CommunityInfo extends GroupInfo {
    linkedGroups: GroupInfo[];
}

export interface ParticipantResult {
    jid: string;
    status: "ok" | "error";
    error?: string;
}

export interface JoinRequestEntry {
    jid: string;
    requestedAt: number;
}

export interface GroupSettingsPatch {
    subject?: string;
    description?: string;
    pictureURL?: string;
    announce?: boolean;
    locked?: boolean;
    memberAddMode?: string;
}

export const listGroups = async (whatsappId: number): Promise<GroupInfo[]> => {
    const { data } = await api.get("/groups", { params: { whatsappId } });
    return Array.isArray(data) ? data : [];
};

export const getGroup = async (whatsappId: number, jid: string): Promise<GroupInfo> => {
    const { data } = await api.get(`/groups/${encodeURIComponent(jid)}`, { params: { whatsappId } });
    return data;
};

export const createGroup = async (
    whatsappId: number,
    subject: string,
    participants: string[]
): Promise<GroupInfo> => {
    const { data } = await api.post("/groups", { whatsappId, subject, participants });
    return data;
};

export const updateGroupSettings = async (
    whatsappId: number,
    jid: string,
    patch: GroupSettingsPatch
): Promise<void> => {
    await api.put(`/groups/${encodeURIComponent(jid)}`, { whatsappId, ...patch });
};

export const updateParticipants = async (
    whatsappId: number,
    jid: string,
    action: "add" | "remove" | "promote" | "demote",
    participants: string[]
): Promise<ParticipantResult[]> => {
    const { data } = await api.post(`/groups/${encodeURIComponent(jid)}/participants`, {
        whatsappId,
        action,
        participants,
    });
    return data.participants ?? [];
};

export const getInviteLink = async (whatsappId: number, jid: string): Promise<string> => {
    const { data } = await api.get(`/groups/${encodeURIComponent(jid)}/invite-link`, { params: { whatsappId } });
    return data.link ?? "";
};

export const revokeInviteLink = async (whatsappId: number, jid: string): Promise<string> => {
    const { data } = await api.post(`/groups/${encodeURIComponent(jid)}/invite-link/revoke`, { whatsappId });
    return data.link ?? "";
};

export const leaveGroup = async (whatsappId: number, jid: string): Promise<void> => {
    await api.post(`/groups/${encodeURIComponent(jid)}/leave`, { whatsappId });
};

export const listJoinRequests = async (whatsappId: number, jid: string): Promise<JoinRequestEntry[]> => {
    const { data } = await api.get(`/groups/${encodeURIComponent(jid)}/join-requests`, { params: { whatsappId } });
    return Array.isArray(data) ? data : [];
};

export const resolveJoinRequests = async (
    whatsappId: number,
    jid: string,
    action: "approve" | "reject",
    participants: string[]
): Promise<ParticipantResult[]> => {
    const { data } = await api.post(`/groups/${encodeURIComponent(jid)}/join-requests`, {
        whatsappId,
        action,
        participants,
    });
    return data.participants ?? [];
};

export const listCommunities = async (whatsappId: number): Promise<GroupInfo[]> => {
    const { data } = await api.get("/communities", { params: { whatsappId } });
    return Array.isArray(data) ? data : [];
};

export const createCommunity = async (whatsappId: number, name: string): Promise<CommunityInfo> => {
    const { data } = await api.post("/communities", { whatsappId, name });
    return data;
};

export const getCommunity = async (whatsappId: number, jid: string): Promise<CommunityInfo> => {
    const { data } = await api.get(`/communities/${encodeURIComponent(jid)}`, { params: { whatsappId } });
    return data;
};

export const linkCommunityGroup = async (whatsappId: number, communityJid: string, groupJid: string): Promise<void> => {
    await api.post(
        `/communities/${encodeURIComponent(communityJid)}/groups/${encodeURIComponent(groupJid)}`,
        { whatsappId }
    );
};

export const unlinkCommunityGroup = async (whatsappId: number, communityJid: string, groupJid: string): Promise<void> => {
    await api.delete(
        `/communities/${encodeURIComponent(communityJid)}/groups/${encodeURIComponent(groupJid)}`,
        { params: { whatsappId } }
    );
};
