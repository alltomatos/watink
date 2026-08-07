import React from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    CAMPAIGN_MIN_INTERVAL_SECONDS,
    CAMPAIGN_MIN_JITTER_SECONDS,
    CAMPAIGN_MAX_BATCH_SIZE,
    CAMPAIGN_MIN_BATCH_PAUSE_SECONDS,
    estimateCampaignDuration,
} from "../campaignHelpers";

export interface CampaignPacingState {
    intervalSeconds: number;
    jitterSeconds: number;
    batchSize: number;
    batchPauseSeconds: number;
}

interface CampaignPacingFormProps {
    value: CampaignPacingState;
    onChange: (patch: Partial<CampaignPacingState>) => void;
    targetsCount: number;
    pacingAdjusted?: boolean;
}

const CampaignPacingForm: React.FC<CampaignPacingFormProps> = ({
    value,
    onChange,
    targetsCount,
    pacingAdjusted,
}) => {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="pacing-interval">Intervalo entre envios (s)</Label>
                    <Input
                        id="pacing-interval"
                        type="number"
                        min={CAMPAIGN_MIN_INTERVAL_SECONDS}
                        value={value.intervalSeconds}
                        onChange={(e) => onChange({ intervalSeconds: Number(e.target.value) })}
                    />
                    <p className="text-[11px] text-muted-foreground">Mínimo {CAMPAIGN_MIN_INTERVAL_SECONDS}s.</p>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="pacing-jitter">Variação (jitter, s)</Label>
                    <Input
                        id="pacing-jitter"
                        type="number"
                        min={CAMPAIGN_MIN_JITTER_SECONDS}
                        value={value.jitterSeconds}
                        onChange={(e) => onChange({ jitterSeconds: Number(e.target.value) })}
                    />
                    <p className="text-[11px] text-muted-foreground">Mínimo {CAMPAIGN_MIN_JITTER_SECONDS}s.</p>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="pacing-batch">Tamanho do lote</Label>
                    <Input
                        id="pacing-batch"
                        type="number"
                        max={CAMPAIGN_MAX_BATCH_SIZE}
                        value={value.batchSize}
                        onChange={(e) => onChange({ batchSize: Number(e.target.value) })}
                    />
                    <p className="text-[11px] text-muted-foreground">Máximo {CAMPAIGN_MAX_BATCH_SIZE} grupos.</p>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="pacing-batchpause">Pausa entre lotes (s)</Label>
                    <Input
                        id="pacing-batchpause"
                        type="number"
                        min={CAMPAIGN_MIN_BATCH_PAUSE_SECONDS}
                        value={value.batchPauseSeconds}
                        onChange={(e) => onChange({ batchPauseSeconds: Number(e.target.value) })}
                    />
                    <p className="text-[11px] text-muted-foreground">Mínimo {CAMPAIGN_MIN_BATCH_PAUSE_SECONDS}s.</p>
                </div>
            </div>

            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                {estimateCampaignDuration({ targetsCount, ...value })}
            </p>

            {pacingAdjusted && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    O servidor ajustou a cadência para o mínimo de segurança contra banimento.
                </p>
            )}
        </div>
    );
};

export default CampaignPacingForm;
