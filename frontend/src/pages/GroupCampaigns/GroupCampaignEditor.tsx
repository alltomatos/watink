import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import notify from "@/lib/notify";
import { SectionTitle } from "@/pages/QuickAnswers/editors/SectionTitle";
import { PhoneMockup } from "@/pages/QuickAnswers/editors/PhoneMockup";
import WhatsAppBubblePreview from "@/components/WhatsAppBubblePreview";
import { useGroupsConnection } from "@/pages/Groups/hooks/useGroups";
import {
    getGroupCampaign,
    createGroupCampaign,
    updateGroupCampaign,
    startGroupCampaign,
    type GroupCampaignCaptureMode,
    type UpsertGroupCampaignInput,
} from "@/services/groupCampaignService";
import CampaignRiskWarning from "./components/CampaignRiskWarning";
import CampaignVariantsEditor from "./components/CampaignVariantsEditor";
import CampaignGroupPicker from "./components/CampaignGroupPicker";
import CampaignScheduleForm, { type CampaignScheduleState } from "./components/CampaignScheduleForm";
import CampaignPacingForm, { type CampaignPacingState } from "./components/CampaignPacingForm";
import { defaultVariant, buildVariantInput, buildTargetInput, normalizeVariantContent, variantContent, variantMessage } from "./campaignHelpers";
import type { CampaignVariantDraft, CampaignTargetDraft } from "./campaignTypes";
import {
    defaultButtons,
    defaultList,
    defaultMedia,
    defaultPoll,
    genId,
} from "@/pages/QuickAnswers/quickAnswersHelpers";

const DEFAULT_SCHEDULE: CampaignScheduleState = {
    scheduleMode: "immediate",
    startAt: "",
    recurrenceRule: "weekly",
    recurrenceDays: "",
    recurrenceTime: "09:00",
    recurrenceEndAt: "",
};

const DEFAULT_PACING: CampaignPacingState = {
    intervalSeconds: 60,
    jitterSeconds: 15,
    batchSize: 10,
    batchPauseSeconds: 300,
};

const GroupCampaignEditor: React.FC = () => {
    const navigate = useNavigate();
    const { campaignId } = useParams<{ campaignId?: string }>();
    const isEdit = !!campaignId && campaignId !== "new";
    const isMounted = useRef(true);
    useEffect(() => () => { isMounted.current = false; }, []);

    const { whatsapps, whatsappId, setWhatsappId, loadingConnections } = useGroupsConnection();

    const [loading, setLoading] = useState(isEdit);
    const [submitting, setSubmitting] = useState(false);
    const [starting, setStarting] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [riskAckChecked, setRiskAckChecked] = useState(false);
    const [riskAckAt, setRiskAckAt] = useState<string | undefined>(undefined);

    const [schedule, setSchedule] = useState<CampaignScheduleState>(DEFAULT_SCHEDULE);
    const [pacing, setPacing] = useState<CampaignPacingState>(DEFAULT_PACING);
    const [pacingAdjusted, setPacingAdjusted] = useState(false);
    const [captureMode, setCaptureMode] = useState<GroupCampaignCaptureMode>("quoted");
    const [captureWindowMinutes, setCaptureWindowMinutes] = useState(60);

    const [variants, setVariants] = useState<CampaignVariantDraft[]>([defaultVariant(0)]);
    const [targets, setTargets] = useState<CampaignTargetDraft[]>([]);
    const [previewVariantId, setPreviewVariantId] = useState<string | null>(null);

    useEffect(() => {
        if (!isEdit || !campaignId) return;
        getGroupCampaign(Number(campaignId))
            .then((data) => {
                if (!isMounted.current) return;
                setName(data.name);
                setDescription(data.description ?? "");
                setWhatsappId(data.whatsappId);
                setRiskAckAt(data.riskAckAt);
                // Editar um draft re-exige o aceite (issue #600 AC); campanhas
                // já disparadas mantêm o aceite histórico marcado.
                setRiskAckChecked(data.status !== "draft" && !!data.riskAckAt);
                setSchedule({
                    scheduleMode: data.scheduleMode,
                    startAt: data.startAt ? data.startAt.slice(0, 16) : "",
                    recurrenceRule: data.recurrenceRule || "weekly",
                    recurrenceDays: data.recurrenceDays ?? "",
                    recurrenceTime: data.recurrenceTime ?? "09:00",
                    recurrenceEndAt: data.recurrenceEndAt ? data.recurrenceEndAt.slice(0, 10) : "",
                });
                setPacing({
                    intervalSeconds: data.intervalSeconds,
                    jitterSeconds: data.jitterSeconds,
                    batchSize: data.batchSize,
                    batchPauseSeconds: data.batchPauseSeconds,
                });
                setCaptureMode(data.captureMode);
                setCaptureWindowMinutes(data.captureWindowMinutes);
                setTargets(
                    data.targets.map((t) => ({
                        whatsappId: t.whatsappId,
                        jid: t.jid,
                        subject: t.subject ?? "",
                        isConnectionAdmin: t.isConnectionAdmin,
                    }))
                );
                setVariants(
                    data.variants.length > 0
                        ? data.variants.map((v, idx) => {
                              const parsed = v.content ? JSON.parse(v.content) : {};
                              const normalized = normalizeVariantContent(v.type as CampaignVariantDraft["type"], parsed);
                              const draft: CampaignVariantDraft = {
                                  localId: genId("variant", idx),
                                  label: v.label ?? "",
                                  type: v.type as CampaignVariantDraft["type"],
                                  active: v.active,
                                  textBody: v.type === "text" ? (normalized.body as string) ?? v.message : "",
                                  buttonsContent: v.type === "interactive_buttons" ? { ...defaultButtons(), ...normalized } : defaultButtons(),
                                  listContent: v.type === "list" ? { ...defaultList(), ...normalized } : defaultList(),
                                  mediaContent: v.type === "media" ? { ...defaultMedia(), ...normalized } : defaultMedia(),
                                  pollContent: v.type === "poll" ? { ...defaultPoll(), ...normalized } : defaultPoll(),
                              };
                              return draft;
                          })
                        : [defaultVariant(0)]
                );
            })
            .catch(notify.error)
            .finally(() => {
                if (isMounted.current) setLoading(false);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaignId, isEdit]);

    useEffect(() => {
        if (!previewVariantId && variants.length > 0) setPreviewVariantId(variants[0].localId);
    }, [variants, previewVariantId]);

    const previewVariant = variants.find((v) => v.localId === previewVariantId) ?? variants[0];

    const buildInput = (): UpsertGroupCampaignInput | null => {
        if (!whatsappId) {
            notify.warning("Selecione uma conexão.");
            return null;
        }
        if (!name.trim()) {
            notify.warning("Informe um nome para a campanha.");
            return null;
        }
        if (!riskAckChecked) {
            notify.warning("Marque o aceite de risco antes de continuar.");
            return null;
        }
        if (targets.length === 0) {
            notify.warning("Selecione ao menos um grupo.");
            return null;
        }
        if (!variants.some((v) => v.active)) {
            notify.warning("Ative ao menos uma variante de mensagem.");
            return null;
        }

        return {
            name: name.trim(),
            description: description.trim(),
            whatsappId,
            scheduleMode: schedule.scheduleMode,
            startAt: schedule.scheduleMode === "once" && schedule.startAt ? new Date(schedule.startAt).toISOString() : undefined,
            recurrenceRule: schedule.scheduleMode === "recurring" ? schedule.recurrenceRule : undefined,
            recurrenceDays: schedule.scheduleMode === "recurring" ? schedule.recurrenceDays : undefined,
            recurrenceTime: schedule.scheduleMode === "recurring" ? schedule.recurrenceTime : undefined,
            recurrenceEndAt:
                schedule.scheduleMode === "recurring" && schedule.recurrenceEndAt
                    ? new Date(schedule.recurrenceEndAt).toISOString()
                    : undefined,
            intervalSeconds: pacing.intervalSeconds,
            jitterSeconds: pacing.jitterSeconds,
            batchSize: pacing.batchSize,
            batchPauseSeconds: pacing.batchPauseSeconds,
            captureMode,
            captureWindowMinutes,
            riskAckAt: riskAckAt ?? new Date().toISOString(),
            variants: variants.map((v, idx) => buildVariantInput(v, idx)),
            targets: targets.map(buildTargetInput),
        };
    };

    const persist = async () => {
        const input = buildInput();
        if (!input) return null;
        const saved = isEdit && campaignId
            ? await updateGroupCampaign(Number(campaignId), input)
            : await createGroupCampaign(input);
        if (isMounted.current) {
            setPacingAdjusted(saved.pacingAdjusted);
            setPacing({
                intervalSeconds: saved.intervalSeconds,
                jitterSeconds: saved.jitterSeconds,
                batchSize: saved.batchSize,
                batchPauseSeconds: saved.batchPauseSeconds,
            });
        }
        return saved;
    };

    const handleSave = async () => {
        setSubmitting(true);
        try {
            const saved = await persist();
            if (saved === null) return;
            notify.success(isEdit ? "Campanha atualizada!" : "Campanha criada como rascunho.");
            navigate(`/group-campaigns/${saved.id}`);
        } catch (err) {
            notify.error(err);
        } finally {
            if (isMounted.current) setSubmitting(false);
        }
    };

    const handleStart = async () => {
        setStarting(true);
        try {
            const saved = await persist();
            if (saved === null) return;
            const savedId = saved.id;
            await startGroupCampaign(savedId);
            notify.success("Campanha iniciada!");
            navigate("/grupos-whatsapp/campanhas");
        } catch (err) {
            notify.error(err);
        } finally {
            if (isMounted.current) setStarting(false);
        }
    };

    const disableActions = submitting || starting || !riskAckChecked;

    return (
        <PageContainer>
            <PageHeader
                title={isEdit ? "Editar campanha" : "Nova campanha"}
                description="Postar uma mensagem programada em vários grupos de uma vez"
            >
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => navigate("/grupos-whatsapp/campanhas")}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar
                    </Button>
                    <Button variant="outline" onClick={handleSave} disabled={disableActions}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar rascunho
                    </Button>
                    <Button onClick={handleStart} disabled={disableActions}>
                        {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Disparar
                    </Button>
                </div>
            </PageHeader>

            <PageContent>
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="flex gap-8 items-start">
                        <div className="flex-1 min-w-0 space-y-6">
                            <CampaignRiskWarning checked={riskAckChecked} onChange={setRiskAckChecked} />

                            <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                                <CardContent className="p-5 space-y-4">
                                    <SectionTitle>Identificação</SectionTitle>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="camp-name">Nome</Label>
                                        <Input
                                            id="camp-name"
                                            placeholder="Ex: Lançamento produto X"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="camp-desc">Descrição (opcional)</Label>
                                        <Textarea
                                            id="camp-desc"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Conexão</Label>
                                        <Select
                                            value={whatsappId ? String(whatsappId) : ""}
                                            onValueChange={(v) => setWhatsappId(Number(v))}
                                            disabled={loadingConnections || isEdit}
                                        >
                                            <SelectTrigger className="w-[280px]">
                                                <SelectValue placeholder="Selecione a conexão" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {whatsapps.map((w) => (
                                                    <SelectItem key={w.id} value={String(w.id)}>
                                                        {w.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                                <CardContent className="p-5 space-y-4">
                                    <SectionTitle>Variantes de mensagem</SectionTitle>
                                    <CampaignVariantsEditor
                                        variants={variants}
                                        onChange={setVariants}
                                        targetsCount={targets.length}
                                    />
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                                <CardContent className="p-5 space-y-4">
                                    <SectionTitle>Grupos</SectionTitle>
                                    <CampaignGroupPicker
                                        whatsappId={whatsappId}
                                        selected={targets}
                                        onChange={setTargets}
                                    />
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                                <CardContent className="p-5 space-y-4">
                                    <SectionTitle>Agendamento</SectionTitle>
                                    <CampaignScheduleForm value={schedule} onChange={(patch) => setSchedule((s) => ({ ...s, ...patch }))} />
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                                <CardContent className="p-5 space-y-4">
                                    <SectionTitle>Cadência (anti-ban)</SectionTitle>
                                    <CampaignPacingForm
                                        value={pacing}
                                        onChange={(patch) => setPacing((p) => ({ ...p, ...patch }))}
                                        targetsCount={targets.length}
                                        pacingAdjusted={pacingAdjusted}
                                    />
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                                <CardContent className="p-5 space-y-4">
                                    <SectionTitle>Captura de resposta</SectionTitle>
                                    <div className="space-y-1.5">
                                        <Label>Modo</Label>
                                        <Select
                                            value={captureMode}
                                            onValueChange={(v) => setCaptureMode(v as GroupCampaignCaptureMode)}
                                        >
                                            <SelectTrigger className="w-[320px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="quoted">Só respostas citando a mensagem</SelectItem>
                                                <SelectItem value="quoted_and_window">
                                                    Citação + mensagens na janela de tempo
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {captureMode === "quoted_and_window" && (
                                        <div className="space-y-1.5">
                                            <Label htmlFor="capture-window">Janela (minutos)</Label>
                                            <Input
                                                id="capture-window"
                                                type="number"
                                                min={1}
                                                className="w-[120px]"
                                                value={captureWindowMinutes}
                                                onChange={(e) => setCaptureWindowMinutes(Number(e.target.value))}
                                            />
                                            <p className="text-[11px] text-muted-foreground max-w-md">
                                                Mensagens na janela contam qualquer conversa do grupo, relacionada ou
                                                não — o relatório sempre mostra os dois números separados, nunca
                                                somados.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <div className="flex items-center justify-end gap-2 pb-8">
                                <Button variant="outline" onClick={() => navigate("/grupos-whatsapp/campanhas")}>
                                    Cancelar
                                </Button>
                                <Button variant="outline" onClick={handleSave} disabled={disableActions}>
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar rascunho
                                </Button>
                                <Button onClick={handleStart} disabled={disableActions}>
                                    {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                    Disparar
                                </Button>
                            </div>
                        </div>

                        <div className="hidden lg:block sticky top-6 w-[320px] shrink-0 space-y-3">
                            {variants.length > 1 && (
                                <Select value={previewVariantId ?? ""} onValueChange={setPreviewVariantId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Variante" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {variants.map((v, idx) => (
                                            <SelectItem key={v.localId} value={v.localId}>
                                                {v.label || `Variante ${idx + 1}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <PhoneMockup>
                                {previewVariant && (
                                    <WhatsAppBubblePreview
                                        type={previewVariant.type}
                                        content={variantContent(previewVariant)}
                                        message={variantMessage(previewVariant)}
                                    />
                                )}
                            </PhoneMockup>
                        </div>
                    </div>
                )}
            </PageContent>
        </PageContainer>
    );
};

export default GroupCampaignEditor;
