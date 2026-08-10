import React from "react";
import { TextEditor } from "@/pages/QuickAnswers/editors/TextEditor";
import { ButtonsEditor } from "@/pages/QuickAnswers/editors/ButtonsEditor";
import { ListEditor } from "@/pages/QuickAnswers/editors/ListEditor";
import { MediaEditor } from "@/pages/QuickAnswers/editors/MediaEditor";
import { PollEditor } from "@/pages/QuickAnswers/editors/PollEditor";
import type { CampaignVariantDraft } from "../campaignTypes";

interface CampaignVariantContentEditorProps {
    variant: CampaignVariantDraft;
    onChange: (patch: Partial<CampaignVariantDraft>) => void;
    error?: string;
}

/** Thin switch over the QuickAnswers editors (pages/QuickAnswers/editors/) --
 * reused verbatim, never duplicated, for the 5 types released in v1. */
const CampaignVariantContentEditor: React.FC<CampaignVariantContentEditorProps> = ({
    variant,
    onChange,
    error,
}) => {
    switch (variant.type) {
        case "text":
            return <TextEditor body={variant.textBody} onChange={(v) => onChange({ textBody: v })} error={error} />;
        case "interactive_buttons":
            return (
                <ButtonsEditor
                    content={variant.buttonsContent}
                    onChange={(c) => onChange({ buttonsContent: c })}
                    errors={{ body: error }}
                />
            );
        case "list":
            return (
                <ListEditor
                    content={variant.listContent}
                    onChange={(c) => onChange({ listContent: c })}
                    errors={{ body: error }}
                />
            );
        case "media":
            return (
                <MediaEditor
                    content={variant.mediaContent}
                    onChange={(c) => onChange({ mediaContent: c })}
                    errors={{ url: error }}
                />
            );
        case "poll":
            return (
                <PollEditor
                    content={variant.pollContent}
                    onChange={(c) => onChange({ pollContent: c })}
                    errors={{ question: error }}
                />
            );
        default:
            return null;
    }
};

export default CampaignVariantContentEditor;
