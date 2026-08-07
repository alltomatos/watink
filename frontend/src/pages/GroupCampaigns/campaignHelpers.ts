import {
    defaultButtons,
    defaultList,
    defaultMedia,
    defaultPoll,
    genId,
    TYPE_OPTIONS,
} from "@/pages/QuickAnswers/quickAnswersHelpers";
import type {
    CampaignVariantDraft,
    CampaignVariantType,
    CampaignVariantContent,
} from "./campaignTypes";
import type {
    GroupCampaignVariantInput,
    GroupCampaignTargetInput,
} from "@/services/groupCampaignService";

/** Only the 5 types released in v1 (plan §7) -- Carousel and PIX filtered
 * out of the shared TYPE_OPTIONS from QuickAnswers (reused, not duplicated). */
export const CAMPAIGN_TYPE_OPTIONS = TYPE_OPTIONS.filter(
    (opt): opt is { value: CampaignVariantType; label: string; description: string } =>
        opt.value === "text" ||
        opt.value === "interactive_buttons" ||
        opt.value === "list" ||
        opt.value === "media" ||
        opt.value === "poll"
);

export function defaultVariant(position: number): CampaignVariantDraft {
    return {
        localId: genId("variant", position),
        label: "",
        type: "text",
        active: true,
        textBody: "",
        buttonsContent: defaultButtons(),
        listContent: defaultList(),
        mediaContent: defaultMedia(),
        pollContent: defaultPoll(),
    };
}

/** Mirrors flow.NormalizeQuickAnswerContent (business/internal/flow/quickanswer_normalize.go)
 * in the OPPOSITE direction: the backend's canonical keys are camelCase
 * (button, mediaType, maxSelections); our editors (reused from QuickAnswers,
 * issue #592 left them untouched on purpose) bind to the legacy snake_case
 * fields (button_text, media_type, max_selections). When loading a variant
 * whose content was saved with the canonical spelling by some other client,
 * this maps it back into what our editors expect -- without it, editing an
 * existing campaign could silently drop a list's button label, a media's
 * type, or a poll's multi-select count.
 */
export function normalizeVariantContent(
    type: CampaignVariantType,
    raw: Record<string, unknown> | null | undefined
): Record<string, unknown> {
    if (!raw) return {};
    const out: Record<string, unknown> = { ...raw };
    switch (type) {
        case "list":
            if (out.button_text === undefined && typeof out.button === "string") {
                out.button_text = out.button;
            }
            delete out.button;
            break;
        case "media":
            if (out.media_type === undefined && typeof out.mediaType === "string") {
                out.media_type = out.mediaType;
            }
            delete out.mediaType;
            break;
        case "poll":
            if (out.max_selections === undefined && typeof out.maxSelections === "number") {
                out.max_selections = out.maxSelections;
            }
            delete out.maxSelections;
            break;
        default:
            break;
    }
    return out;
}

export function variantContent(v: CampaignVariantDraft): CampaignVariantContent {
    switch (v.type) {
        case "interactive_buttons":
            return v.buttonsContent;
        case "list":
            return v.listContent;
        case "media":
            return v.mediaContent;
        case "poll":
            return v.pollContent;
        default:
            return { body: v.textBody };
    }
}

export function variantMessage(v: CampaignVariantDraft): string {
    switch (v.type) {
        case "interactive_buttons":
            return v.buttonsContent.body;
        case "list":
            return v.listContent.body;
        case "media":
            return v.mediaContent.caption ?? v.mediaContent.url;
        case "poll":
            return v.pollContent.question;
        default:
            return v.textBody;
    }
}

/** Builds the GroupCampaignVariantInput payload for one draft --
 * content is JSON.stringify'd here, matching what groups_campaign_handler.go
 * expects (a raw JSON string stored as-is in the jsonb column). */
export function buildVariantInput(v: CampaignVariantDraft, position: number): GroupCampaignVariantInput {
    return {
        label: v.label || `Variante ${position + 1}`,
        type: v.type,
        message: variantMessage(v),
        content: JSON.stringify(variantContent(v)),
        active: v.active,
    };
}

export function validateVariant(v: CampaignVariantDraft): string | undefined {
    switch (v.type) {
        case "text":
            return v.textBody.trim() ? undefined : "Mensagem obrigatória";
        case "interactive_buttons":
            if (!v.buttonsContent.body.trim()) return "Mensagem obrigatória";
            if (v.buttonsContent.buttons.length < 1) return "Adicione ao menos 1 botão";
            return undefined;
        case "list":
            return v.listContent.body.trim() ? undefined : "Mensagem obrigatória";
        case "media":
            return v.mediaContent.url.trim() ? undefined : "URL obrigatória";
        case "poll":
            if (!v.pollContent.question.trim()) return "Pergunta obrigatória";
            if (v.pollContent.options.length < 2) return "Adicione ao menos 2 opções";
            return undefined;
        default:
            return undefined;
    }
}

export function buildTargetInput(t: { whatsappId: number; jid: string; subject: string; isConnectionAdmin: boolean }): GroupCampaignTargetInput {
    return {
        whatsappId: t.whatsappId,
        jid: t.jid,
        subject: t.subject,
        isConnectionAdmin: t.isConnectionAdmin,
    };
}

// ── pacing floors (mirror groups_campaign_schedule.go clampPacing) ────────
// These are CLIENT-SIDE hints for immediate feedback -- the backend is the
// final authority and echoes pacingAdjusted when it clamps, so a mismatch
// here is never silently wrong, just a slightly late warning.
export const CAMPAIGN_MIN_INTERVAL_SECONDS = 60;
export const CAMPAIGN_MIN_JITTER_SECONDS = 5;
export const CAMPAIGN_MAX_BATCH_SIZE = 20;
export const CAMPAIGN_MIN_BATCH_PAUSE_SECONDS = 180;

export interface PacingEstimateInput {
    targetsCount: number;
    intervalSeconds: number;
    batchSize: number;
    batchPauseSeconds: number;
}

/** "47 grupos · ~62 min · término previsto 15:42" -- a rough estimate
 * ignoring jitter (which only spreads sends within the interval, it
 * doesn't change the total). */
export function estimateCampaignDuration(input: PacingEstimateInput, now: Date = new Date()): string {
    const { targetsCount, intervalSeconds, batchSize, batchPauseSeconds } = input;
    if (targetsCount <= 0) return "Nenhum grupo selecionado";
    const batches = Math.max(1, Math.ceil(targetsCount / Math.max(batchSize, 1)));
    const totalSeconds =
        (targetsCount - 1) * intervalSeconds + (batches - 1) * batchPauseSeconds;
    const totalMinutes = Math.round(totalSeconds / 60);
    const finishAt = new Date(now.getTime() + totalSeconds * 1000);
    const finishLabel = finishAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${targetsCount} grupo${targetsCount === 1 ? "" : "s"} · ~${totalMinutes} min · término previsto ${finishLabel}`;
}
