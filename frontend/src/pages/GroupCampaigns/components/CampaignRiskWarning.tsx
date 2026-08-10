import React from "react";
import { TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CampaignRiskWarningProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

/**
 * ADR 0016/0030 mandate: always rendered, never collapsible/dismissible.
 * The checkbox gates Save AND Start (GroupCampaignEditor wires `checked`
 * into both button `disabled` props) -- it is NOT optional UI chrome.
 *
 * TEXT PENDING PRODUCT SIGN-OFF (issue #600): the claim that there is no
 * official/sanctioned channel for group broadcast (unlike contact
 * campaigns, where the Cloud API is at least a stated future path per ADR
 * 0016) is a real narrative change from ADR 0016, not a copy-editing
 * choice. Do not treat this copy as final without an explicit go-ahead
 * from the product owner.
 */
const CampaignRiskWarning: React.FC<CampaignRiskWarningProps> = ({ checked, onChange, disabled }) => {
    return (
        <Card className="rounded-2xl border-destructive shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
            <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                    <TriangleAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-2 text-sm">
                        <p className="font-semibold text-destructive">Risco de banimento da conexão</p>
                        <p className="text-muted-foreground">
                            Conexões WhatsApp conectadas via este método podem ser identificadas e banidas em
                            poucas semanas, independentemente da cadência de envio configurada aqui — o sinal
                            que a Meta detecta é estrutural, não apenas comportamental. As proteções desta tela
                            (intervalo, variação de mensagens, pausa entre lotes) reduzem o risco, mas não o
                            eliminam.
                        </p>
                        <p className="text-muted-foreground">
                            Diferente de campanhas para contatos individuais, não existe hoje um canal oficial e
                            sancionado para disparo em massa em grupos de WhatsApp.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                        id="campaign-risk-ack"
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(v) => onChange(v === true)}
                    />
                    <Label htmlFor="campaign-risk-ack" className="text-sm font-normal cursor-pointer">
                        Entendo o risco de banimento e assumo a responsabilidade
                    </Label>
                </div>
            </CardContent>
        </Card>
    );
};

export default CampaignRiskWarning;
