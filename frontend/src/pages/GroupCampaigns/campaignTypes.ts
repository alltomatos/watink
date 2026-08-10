import type {
    QuickAnswerType,
    QuickAnswerContentText,
    QuickAnswerContentButtons,
    QuickAnswerContentList,
    QuickAnswerContentMedia,
    QuickAnswerContentPoll,
} from "@/pages/QuickAnswers/quickAnswersTypes";

/** The 5 types released in v1 -- NO Carousel, NO PIX (plan §7, issue #600). */
export type CampaignVariantType = Extract<
    QuickAnswerType,
    "text" | "interactive_buttons" | "list" | "media" | "poll"
>;

/** One variant being edited in the form -- carries a bag of per-type
 * content state (mirrors QuickAnswerEditor's own pattern) plus an `id`
 * used only client-side for React keys/reordering; the backend variant
 * (models.GroupCampaignVariant) doesn't need it until saved. */
export interface CampaignVariantDraft {
    localId: string;
    label: string;
    type: CampaignVariantType;
    active: boolean;
    textBody: string;
    buttonsContent: QuickAnswerContentButtons;
    listContent: QuickAnswerContentList;
    mediaContent: QuickAnswerContentMedia;
    pollContent: QuickAnswerContentPoll;
}

export type CampaignVariantContent =
    | QuickAnswerContentText
    | QuickAnswerContentButtons
    | QuickAnswerContentList
    | QuickAnswerContentMedia
    | QuickAnswerContentPoll;

export interface CampaignTargetDraft {
    whatsappId: number;
    jid: string;
    subject: string;
    isConnectionAdmin: boolean;
}
