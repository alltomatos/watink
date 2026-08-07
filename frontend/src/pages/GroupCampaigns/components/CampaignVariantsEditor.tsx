import React, { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CAMPAIGN_TYPE_OPTIONS, defaultVariant, validateVariant } from "../campaignHelpers";
import type { CampaignVariantDraft, CampaignVariantType } from "../campaignTypes";
import CampaignVariantContentEditor from "./CampaignVariantContentEditor";

interface CampaignVariantsEditorProps {
    variants: CampaignVariantDraft[];
    onChange: (variants: CampaignVariantDraft[]) => void;
    targetsCount: number;
}

const CampaignVariantsEditor: React.FC<CampaignVariantsEditorProps> = ({ variants, onChange, targetsCount }) => {
    const [expandedId, setExpandedId] = useState<string | null>(variants[0]?.localId ?? null);

    const activeCount = variants.filter((v) => v.active).length;
    const showMoreVariantsHint = targetsCount > 10 && activeCount < 2;

    const updateVariant = (localId: string, patch: Partial<CampaignVariantDraft>) => {
        onChange(variants.map((v) => (v.localId === localId ? { ...v, ...patch } : v)));
    };

    const addVariant = () => {
        const v = defaultVariant(variants.length);
        onChange([...variants, v]);
        setExpandedId(v.localId);
    };

    const removeVariant = (localId: string) => {
        onChange(variants.filter((v) => v.localId !== localId));
    };

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
                Variantes são alternadas entre os grupos — conteúdo idêntico em muitos grupos é o padrão que a
                Meta detecta.
            </p>
            {showMoreVariantsHint && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Com mais de 10 grupos selecionados, recomendamos ao menos 2 variantes ativas.
                </p>
            )}

            <div className="space-y-3">
                {variants.map((v, idx) => {
                    const expanded = expandedId === v.localId;
                    const error = validateVariant(v);
                    return (
                        <Card key={v.localId} className="rounded-xl shadow-none border">
                            <CardContent className="p-3 space-y-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="flex-1 flex items-center gap-2 text-left"
                                        onClick={() => setExpandedId(expanded ? null : v.localId)}
                                    >
                                        {expanded ? (
                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span className="text-sm font-medium">
                                            {v.label || `Variante ${idx + 1}`}
                                        </span>
                                        {error && <span className="text-xs text-destructive">· {error}</span>}
                                    </button>
                                    <div className="flex items-center gap-1.5">
                                        <Switch
                                            checked={v.active}
                                            onCheckedChange={(checked) => updateVariant(v.localId, { active: checked })}
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            {v.active ? "Ativa" : "Inativa"}
                                        </span>
                                    </div>
                                    {variants.length > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeVariant(v.localId)}
                                            aria-label="Remover variante"
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>

                                {expanded && (
                                    <div className="space-y-3 pt-2 border-t">
                                        <div className="space-y-1.5">
                                            <Label>Rótulo (opcional, só pra identificar no relatório)</Label>
                                            <Input
                                                placeholder={`Variante ${idx + 1}`}
                                                value={v.label}
                                                onChange={(e) => updateVariant(v.localId, { label: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Tipo de mensagem</Label>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() =>
                                                            updateVariant(v.localId, {
                                                                type: opt.value as CampaignVariantType,
                                                            })
                                                        }
                                                        className={`rounded-lg border px-2.5 py-2 text-left transition-all ${
                                                            v.type === opt.value
                                                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                                : "border-border hover:border-primary/40 hover:bg-muted/40"
                                                        }`}
                                                    >
                                                        <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <CampaignVariantContentEditor
                                            variant={v}
                                            onChange={(patch) => updateVariant(v.localId, patch)}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Button variant="outline" size="sm" className="gap-1.5" onClick={addVariant}>
                <Plus className="h-4 w-4" />
                Adicionar variante
            </Button>
        </div>
    );
};

export default CampaignVariantsEditor;
