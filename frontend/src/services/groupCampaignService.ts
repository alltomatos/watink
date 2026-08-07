import api from "./api";

// Mirrors business/internal/models/group_campaign*.go 1:1 (same JSON tags)
// -- and business/internal/plugins/groups_campaign_handler.go's request/
// response DTOs for create/update. GroupCampaign is a DIFFERENT entity from
// the FlowBuilder Fase-4 "Campaign" (CONTEXT.md) -- do not conflate.

export type GroupCampaignStatus =
    | "draft"
    | "scheduled"
    | "running"
    | "paused"
    | "completed"
    | "canceled";

export type GroupCampaignScheduleMode = "immediate" | "once" | "recurring";
export type GroupCampaignRecurrenceRule = "weekly" | "monthly" | "";
export type GroupCampaignCaptureMode = "quoted" | "quoted_and_window";

export interface GroupCampaignVariant {
    id: number;
    tenantId: string;
    campaignId: number;
    position: number;
    label?: string;
    type: string;
    message: string;
    content: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface GroupCampaignTarget {
    id: number;
    tenantId: string;
    campaignId: number;
    whatsappId: number;
    jid: string;
    subject?: string;
    isConnectionAdmin: boolean;
    createdAt: string;
}

export interface GroupCampaign {
    id: number;
    tenantId: string;
    name: string;
    description: string;
    whatsappId: number;
    status: GroupCampaignStatus;
    pauseReason?: string;

    scheduleMode: GroupCampaignScheduleMode;
    startAt?: string;
    recurrenceRule?: GroupCampaignRecurrenceRule;
    recurrenceDays?: string;
    recurrenceTime?: string;
    timezone: string;
    recurrenceEndAt?: string;
    nextOccurrenceAt?: string;

    intervalSeconds: number;
    jitterSeconds: number;
    batchSize: number;
    batchPauseSeconds: number;

    captureMode: GroupCampaignCaptureMode;
    captureWindowMinutes: number;

    riskAckAt?: string;
    riskAckUserId?: number;
    createdById?: number;

    createdAt: string;
    updatedAt: string;
}

/** Shape returned by GET/POST/PUT /group-campaigns[/:id] (groupCampaignResponse, Go). */
export interface GroupCampaignWithChildren extends GroupCampaign {
    variants: GroupCampaignVariant[];
    targets: GroupCampaignTarget[];
    pacingAdjusted: boolean;
}

export type GroupCampaignRunStatus = "pending" | "running" | "completed" | "canceled" | "failed";

export interface GroupCampaignRun {
    id: number;
    tenantId: string;
    campaignId: number;
    occurrenceKey: string;
    status: GroupCampaignRunStatus;
    skipReason?: string;
    scheduledFor: string;
    startedAt?: string;
    finishedAt?: string;
    sequence: number;
    totalSends: number;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    replyCount: number;
    /** Frozen variants this run actually sent (models.GroupCampaignRun.VariantsSnapshot,
     * variantSnapshotEntry in Go) -- index matches GroupCampaignSend.variantIndex. */
    variantsSnapshot?: Array<{ id: number; type: string; message: string; content: string }>;
    createdAt: string;
    updatedAt: string;
}

export type GroupCampaignSendStatus = "pending" | "sending" | "sent" | "failed" | "skipped" | "canceled";

export interface GroupCampaignSend {
    id: number;
    tenantId: string;
    campaignId: number;
    runId: number;
    whatsappId: number;
    jid: string;
    subject?: string;
    variantId?: number;
    variantIndex: number;
    status: GroupCampaignSendStatus;
    scheduledAt: string;
    claimedAt?: string;
    sentAt?: string;
    attempts: number;
    lastError?: string;
    envId: string;
    messageId?: string;
    ticketId?: number;
    replyCount: number;
    createdAt: string;
    updatedAt: string;
}

export type GroupCampaignReplyMatchType = "quoted" | "window";

export interface GroupCampaignReply {
    id: number;
    tenantId: string;
    campaignId: number;
    runId: number;
    sendId: number;
    jid: string;
    ticketId: number;
    messageId: string;
    participant?: string;
    contactName?: string;
    body?: string;
    matchType: GroupCampaignReplyMatchType;
    isOptOut: boolean;
    repliedAt: string;
    createdAt: string;
}

export interface GroupCampaignVariantInput {
    label?: string;
    type: string;
    message: string;
    content?: string;
    active: boolean;
}

export interface GroupCampaignTargetInput {
    whatsappId: number;
    jid: string;
    subject?: string;
    isConnectionAdmin?: boolean;
}

/** Mirrors upsertGroupCampaignRequest (groups_campaign_handler.go) exactly. */
export interface UpsertGroupCampaignInput {
    name: string;
    description?: string;
    whatsappId: number;

    scheduleMode?: GroupCampaignScheduleMode;
    startAt?: string;
    recurrenceRule?: GroupCampaignRecurrenceRule;
    recurrenceDays?: string;
    recurrenceTime?: string;
    timezone?: string;
    recurrenceEndAt?: string;

    intervalSeconds?: number;
    jitterSeconds?: number;
    batchSize?: number;
    batchPauseSeconds?: number;

    captureMode?: GroupCampaignCaptureMode;
    captureWindowMinutes?: number;

    /** Required by the backend -- POST/PUT reject without it (ADR 0016/0030). */
    riskAckAt: string;

    variants: GroupCampaignVariantInput[];
    targets: GroupCampaignTargetInput[];
}

export interface PaginatedResult<T> {
    items: T[];
    count: number;
    pageNumber: number;
}

export const listGroupCampaigns = async (): Promise<GroupCampaign[]> => {
    const { data } = await api.get("/group-campaigns");
    return Array.isArray(data) ? data : [];
};

export const getGroupCampaign = async (id: number): Promise<GroupCampaignWithChildren> => {
    const { data } = await api.get(`/group-campaigns/${id}`);
    return data;
};

export const createGroupCampaign = async (input: UpsertGroupCampaignInput): Promise<GroupCampaignWithChildren> => {
    const { data } = await api.post("/group-campaigns", input);
    return data;
};

export const updateGroupCampaign = async (
    id: number,
    input: UpsertGroupCampaignInput
): Promise<GroupCampaignWithChildren> => {
    const { data } = await api.put(`/group-campaigns/${id}`, input);
    return data;
};

export const deleteGroupCampaign = async (id: number): Promise<void> => {
    await api.delete(`/group-campaigns/${id}`);
};

export const startGroupCampaign = async (id: number): Promise<GroupCampaignWithChildren> => {
    const { data } = await api.post(`/group-campaigns/${id}/start`);
    return data;
};

export const testGroupCampaign = async (
    id: number,
    jid: string,
    subject?: string
): Promise<{ ticketId: number; messageId: string }> => {
    const { data } = await api.post(`/group-campaigns/${id}/test`, { jid, subject });
    return data;
};

export const pauseGroupCampaign = async (id: number, pauseReason?: string): Promise<GroupCampaignWithChildren> => {
    const { data } = await api.post(`/group-campaigns/${id}/pause`, pauseReason ? { pauseReason } : {});
    return data;
};

export const resumeGroupCampaign = async (id: number): Promise<GroupCampaignWithChildren> => {
    const { data } = await api.post(`/group-campaigns/${id}/resume`);
    return data;
};

export const cancelGroupCampaign = async (id: number): Promise<GroupCampaignWithChildren> => {
    const { data } = await api.post(`/group-campaigns/${id}/cancel`);
    return data;
};

export const listGroupCampaignRuns = async (
    id: number,
    pageNumber = 1
): Promise<PaginatedResult<GroupCampaignRun>> => {
    const { data } = await api.get(`/group-campaigns/${id}/runs`, { params: { pageNumber } });
    return { items: Array.isArray(data?.runs) ? data.runs : [], count: data?.count ?? 0, pageNumber: data?.pageNumber ?? 1 };
};

export const listGroupCampaignSends = async (
    id: number,
    runId: number,
    pageNumber = 1
): Promise<PaginatedResult<GroupCampaignSend>> => {
    const { data } = await api.get(`/group-campaigns/${id}/runs/${runId}/sends`, { params: { pageNumber } });
    return { items: Array.isArray(data?.sends) ? data.sends : [], count: data?.count ?? 0, pageNumber: data?.pageNumber ?? 1 };
};

export interface GroupCampaignRepliesResult {
    replies: GroupCampaignReply[];
    pageNumber: number;
    quotedCount: number;
    windowCount: number;
}

export const listGroupCampaignReplies = async (
    id: number,
    pageNumber = 1
): Promise<GroupCampaignRepliesResult> => {
    const { data } = await api.get(`/group-campaigns/${id}/replies`, { params: { pageNumber } });
    return {
        replies: Array.isArray(data?.replies) ? data.replies : [],
        pageNumber: data?.pageNumber ?? 1,
        quotedCount: data?.quotedCount ?? 0,
        windowCount: data?.windowCount ?? 0,
    };
};
