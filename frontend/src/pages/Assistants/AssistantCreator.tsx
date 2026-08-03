import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import { Save, PlayCircle, Loader2, CheckCircle2, XCircle, Info } from "lucide-react";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import api from "../../services/api";
import {
    Assistant,
    AssistantMode,
    AssistantTestResult,
    createAssistant,
    getAssistant,
    testAssistant,
    updateAssistant,
} from "../../services/assistantService";
import { listAiGateways, AiGateway } from "../../services/aiGatewayService";
import AssistantRouterOptions from "./AssistantRouterOptions";
import AssistantGroupsPanel from "./AssistantGroupsPanel";
import PersonaSectionsEditor from "./PersonaSectionsEditor";
import { PersonaSectionValues, buildPersonaFromSections, parsePersonaSections } from "./personaSections";

interface WhatsappOption {
    id: number;
    name: string;
}
interface FlowOption {
    id: number;
    name: string;
}
interface PipelineOption {
    id: number;
    name: string;
}
interface KnowledgeBaseOption {
    id: number;
    name: string;
}

const PIPELINE_EVENTS = [
    { value: "deal_created", label: "Ticket/negócio criado" },
    { value: "stage_changed", label: "Mudança de estágio" },
    { value: "idle", label: "Parado há X dias" },
    { value: "closed", label: "Finalizado" },
];

const emptyPersonaSections = (): PersonaSectionValues => parsePersonaSections("");

const AssistantCreator: React.FC = () => {
    const navigate = useNavigate();
    const { assistantId } = useParams<{ assistantId: string }>();
    const isEditing = !!assistantId;

    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("comportamento");
    const [testing, setTesting] = useState(false);
    const [testDialogOpen, setTestDialogOpen] = useState(false);
    const [testMessage, setTestMessage] = useState("");
    const [testResult, setTestResult] = useState<AssistantTestResult | null>(null);

    const [whatsapps, setWhatsapps] = useState<WhatsappOption[]>([]);
    const [flows, setFlows] = useState<FlowOption[]>([]);
    const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
    const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseOption[]>([]);
    const [aiGateways, setAiGateways] = useState<AiGateway[]>([]);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [whatsappId, setWhatsappId] = useState<string>("");
    const [allowMultipleOnConnection, setAllowMultipleOnConnection] = useState(false);
    const [mode, setMode] = useState<AssistantMode>("persona");
    const [active, setActive] = useState(true);

    const [triggerType, setTriggerType] = useState<"any" | "keyword">("any");
    const [triggerOperator, setTriggerOperator] = useState("contains");
    const [triggerValue, setTriggerValue] = useState("");

    const [sessionExpiryMinutes, setSessionExpiryMinutes] = useState("");
    const [typingDelayMs, setTypingDelayMs] = useState("");
    const [debounceSeconds, setDebounceSeconds] = useState("");
    const [endKeyword, setEndKeyword] = useState("");
    const [expiryMessage, setExpiryMessage] = useState("");
    const [closingMessage, setClosingMessage] = useState("");
    const [stopOnHumanReply, setStopOnHumanReply] = useState(true);
    const [ignoreGroups, setIgnoreGroups] = useState(true);
    const [groupsMode, setGroupsMode] = useState<"legacy" | "selective">("legacy");

    // Modo flow
    const [flowId, setFlowId] = useState<string>("");

    // Modo persona (e pipeline.respondsAfterProactive) — editor guiado em 5 seções
    const [personaSections, setPersonaSections] = useState<PersonaSectionValues>(emptyPersonaSections());
    const [knowledgeBaseId, setKnowledgeBaseId] = useState<string>("");
    const [maxTurns, setMaxTurns] = useState("6");
    const [aiGatewayId, setAiGatewayId] = useState<string>("");
    const [ragFallbackBehavior, setRagFallbackBehavior] = useState("handoff");
    const [ragFallbackMessage, setRagFallbackMessage] = useState("");

    // Modo pipeline
    const [pipelineId, setPipelineId] = useState<string>("");
    const [pipelineEvents, setPipelineEvents] = useState<string[]>(["stage_changed"]);
    const [idleThresholdDays, setIdleThresholdDays] = useState("3");
    const [respondsAfterProactive, setRespondsAfterProactive] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [wa, fl, pl, kb, gw] = await Promise.all([
                    api.get("/whatsapp"),
                    api.get("/flows"),
                    api.get("/pipelines"),
                    api.get("/knowledge-bases"),
                    listAiGateways(),
                ]);
                setWhatsapps(Array.isArray(wa.data) ? wa.data : []);
                setFlows(Array.isArray(fl.data) ? fl.data : []);
                setPipelines(Array.isArray(pl.data) ? pl.data : []);
                setKnowledgeBases(Array.isArray(kb.data) ? kb.data : []);
                setAiGateways(gw);
            } catch {
                toast.error("Erro ao carregar opções de conexão/flow/pipeline");
            }
        })();
    }, []);

    useEffect(() => {
        if (!isEditing) return;
        (async () => {
            try {
                const a: Assistant = await getAssistant(Number(assistantId));
                setName(a.name);
                setDescription(a.description ?? "");
                setWhatsappId(a.whatsappId ? String(a.whatsappId) : "");
                setAllowMultipleOnConnection(a.allowMultipleOnConnection);
                setMode(a.mode);
                setActive(a.active);
                setTriggerType(a.triggerType);
                setTriggerOperator(a.triggerOperator || "contains");
                setTriggerValue(a.triggerValue || "");
                setSessionExpiryMinutes(a.sessionExpiryMinutes ? String(a.sessionExpiryMinutes) : "");
                setTypingDelayMs(a.typingDelayMs ? String(a.typingDelayMs) : "");
                setDebounceSeconds(a.debounceSeconds ? String(a.debounceSeconds) : "");
                setEndKeyword(a.endKeyword ?? "");
                setExpiryMessage(a.expiryMessage ?? "");
                setClosingMessage(a.closingMessage ?? "");
                setStopOnHumanReply(a.stopOnHumanReply);
                setIgnoreGroups(a.ignoreGroups);
                setGroupsMode(a.groupsMode ?? "legacy");

                const cfg = (a.config ?? {}) as Record<string, unknown>;
                if (a.mode === "flow") setFlowId(cfg.flowId ? String(cfg.flowId) : "");
                if (a.mode === "persona") {
                    setPersonaSections(parsePersonaSections((cfg.persona as string) ?? ""));
                    setKnowledgeBaseId(cfg.knowledgeBaseId ? String(cfg.knowledgeBaseId) : "");
                    setMaxTurns(cfg.maxTurns ? String(cfg.maxTurns) : "6");
                    setAiGatewayId(cfg.aiGatewayId ? String(cfg.aiGatewayId) : "");
                    setRagFallbackBehavior((cfg.ragFallbackBehavior as string) ?? "handoff");
                    setRagFallbackMessage((cfg.ragFallbackMessage as string) ?? "");
                }
                if (a.mode === "pipeline") {
                    setPipelineId(cfg.pipelineId ? String(cfg.pipelineId) : "");
                    setPipelineEvents((cfg.events as string[]) ?? ["stage_changed"]);
                    setIdleThresholdDays(cfg.idleThresholdDays ? String(cfg.idleThresholdDays) : "3");
                    setRespondsAfterProactive(!!cfg.respondsAfterProactive);
                    setPersonaSections(parsePersonaSections((cfg.persona as string) ?? ""));
                    setKnowledgeBaseId(cfg.knowledgeBaseId ? String(cfg.knowledgeBaseId) : "");
                    setMaxTurns(cfg.maxTurns ? String(cfg.maxTurns) : "6");
                    setAiGatewayId(cfg.aiGatewayId ? String(cfg.aiGatewayId) : "");
                    setRagFallbackBehavior((cfg.ragFallbackBehavior as string) ?? "handoff");
                    setRagFallbackMessage((cfg.ragFallbackMessage as string) ?? "");
                }
            } catch {
                toast.error("Erro ao carregar assistente");
            }
        })();
    }, [assistantId, isEditing]);

    const toggleEvent = (value: string) => {
        setPipelineEvents((prev) =>
            prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
        );
    };

    const handlePersonaSectionChange = (key: string, value: string) => {
        setPersonaSections((prev) => ({ ...prev, [key]: value }));
    };

    const buildConfig = (): Record<string, unknown> => {
        const persona = buildPersonaFromSections(personaSections);
        switch (mode) {
            case "flow":
                return { flowId: Number(flowId) };
            case "persona":
                return {
                    persona,
                    knowledgeBaseId: knowledgeBaseId ? Number(knowledgeBaseId) : null,
                    maxTurns: Number(maxTurns) || 6,
                    aiGatewayId: Number(aiGatewayId),
                    ragFallbackBehavior,
                    ragFallbackMessage: ragFallbackBehavior === "fixed_message" ? ragFallbackMessage : null,
                };
            case "pipeline":
                return {
                    pipelineId: Number(pipelineId),
                    events: pipelineEvents,
                    idleThresholdDays: Number(idleThresholdDays) || 0,
                    respondsAfterProactive,
                    ...(respondsAfterProactive
                        ? {
                              persona,
                              knowledgeBaseId: knowledgeBaseId ? Number(knowledgeBaseId) : null,
                              maxTurns: Number(maxTurns) || 6,
                              aiGatewayId: Number(aiGatewayId),
                              ragFallbackBehavior,
                              ragFallbackMessage:
                                  ragFallbackBehavior === "fixed_message" ? ragFallbackMessage : null,
                          }
                        : {}),
                };
            case "router":
            default:
                return {};
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error("Informe um nome para o assistente");
            setActiveTab("geral");
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name,
                description,
                whatsappId: whatsappId ? Number(whatsappId) : null,
                allowMultipleOnConnection,
                mode,
                config: buildConfig(),
                triggerType,
                triggerOperator: triggerType === "keyword" ? triggerOperator : "",
                triggerValue: triggerType === "keyword" ? triggerValue : "",
                sessionExpiryMinutes: sessionExpiryMinutes ? Number(sessionExpiryMinutes) : null,
                typingDelayMs: typingDelayMs ? Number(typingDelayMs) : null,
                debounceSeconds: debounceSeconds ? Number(debounceSeconds) : null,
                endKeyword: endKeyword || null,
                expiryMessage: expiryMessage || null,
                closingMessage: closingMessage || null,
                stopOnHumanReply,
                ignoreGroups,
                groupsMode,
                active,
            };

            if (isEditing) {
                await updateAssistant(Number(assistantId), payload);
                toast.success("Assistente atualizado com sucesso!");
            } else {
                const created = await createAssistant(payload);
                toast.success("Assistente criado com sucesso!");
                navigate(`/assistants/${created.id}/edit`);
                setSaving(false);
                return;
            }
            navigate("/assistants");
        } catch (err) {
            const message =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                "Erro ao salvar assistente";
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const openTestDialog = () => {
        setTestResult(null);
        setTestMessage("");
        setTestDialogOpen(true);
    };

    const handleRunTest = async () => {
        if (!assistantId) return;
        setTesting(true);
        setTestResult(null);
        try {
            const result = await testAssistant(Number(assistantId), testMessage.trim() || undefined);
            setTestResult(result);
        } catch (err) {
            const message =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                "Erro ao testar assistente";
            setTestResult({ mode, success: false, error: message });
        } finally {
            setTesting(false);
        }
    };

    const showPersonaSections = mode === "persona" || (mode === "pipeline" && respondsAfterProactive);

    return (
        <PageLayout>
            <PageHeader
                title={isEditing ? "Editar Assistente" : "Novo Assistente"}
                description="Configure a conexão, o comportamento e o gatilho do assistente"
            >
                <div className="flex gap-2">
                    {isEditing && (
                        <Button variant="outline" onClick={openTestDialog}>
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Testar Bot
                        </Button>
                    )}
                    <Button onClick={handleSave} disabled={saving}>
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? "Salvando..." : "Salvar"}
                    </Button>
                </div>
            </PageHeader>

            <PageContent>
                <div className="max-w-4xl mx-auto flex flex-col gap-4">
                    <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                        <CardContent className="p-5 flex flex-col gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <Label>Nome</Label>
                                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label>Conexão</Label>
                                    <Select value={whatsappId} onValueChange={setWhatsappId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione" />
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
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label>Descrição (opcional)</Label>
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={2}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between rounded-xl border p-3">
                                    <div>
                                        <p className="text-sm font-medium">Permitir múltiplos nesta conexão</p>
                                        <p className="text-xs text-muted-foreground">
                                            Por padrão só um assistente pode estar ativo por conexão
                                        </p>
                                    </div>
                                    <Switch
                                        checked={allowMultipleOnConnection}
                                        onCheckedChange={setAllowMultipleOnConnection}
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-xl border p-3">
                                    <p className="text-sm font-medium">Assistente ativo</p>
                                    <Switch checked={active} onCheckedChange={setActive} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                        <CardContent className="p-5 flex flex-col gap-4">
                            <Tabs value={activeTab} onValueChange={setActiveTab}>
                                <TabsList className="grid grid-cols-4 w-full">
                                    <TabsTrigger value="comportamento">Comportamento</TabsTrigger>
                                    <TabsTrigger value="gatilho">Gatilho</TabsTrigger>
                                    <TabsTrigger value="avancado">Avançado</TabsTrigger>
                                    <TabsTrigger value="grupos">Grupos</TabsTrigger>
                                </TabsList>

                                <TabsContent value="comportamento" className="flex flex-col gap-4 pt-2">
                                    <div className="flex flex-col gap-1.5">
                                        <Label>Ao que este assistente está ligado?</Label>
                                        <Tabs value={mode} onValueChange={(v) => setMode(v as AssistantMode)}>
                                            <TabsList className="grid grid-cols-4 w-full">
                                                <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                                                <TabsTrigger value="flow">Flow</TabsTrigger>
                                                <TabsTrigger value="persona">Persona</TabsTrigger>
                                                <TabsTrigger value="router">Roteador</TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>

                                    {mode === "flow" && (
                                        <div className="flex flex-col gap-1.5">
                                            <Label>Flow</Label>
                                            <Select value={flowId} onValueChange={setFlowId}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione um flow" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {flows.map((f) => (
                                                        <SelectItem key={f.id} value={String(f.id)}>
                                                            {f.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {mode === "pipeline" && (
                                        <div className="flex flex-col gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <Label>Pipeline</Label>
                                                <Select value={pipelineId} onValueChange={setPipelineId}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione um pipeline" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {pipelines.map((p) => (
                                                            <SelectItem key={p.id} value={String(p.id)}>
                                                                {p.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <Label>Eventos que disparam a notificação</Label>
                                                {PIPELINE_EVENTS.map((ev) => (
                                                    <label
                                                        key={ev.value}
                                                        className="flex items-center gap-2 text-sm cursor-pointer"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={pipelineEvents.includes(ev.value)}
                                                            onChange={() => toggleEvent(ev.value)}
                                                        />
                                                        {ev.label}
                                                    </label>
                                                ))}
                                            </div>

                                            {pipelineEvents.includes("idle") && (
                                                <div className="flex flex-col gap-1.5 max-w-[220px]">
                                                    <Label>Dias parado até disparar</Label>
                                                    <Input
                                                        type="number"
                                                        value={idleThresholdDays}
                                                        onChange={(e) => setIdleThresholdDays(e.target.value)}
                                                    />
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between rounded-xl border p-3">
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        Responder ativamente após a notificação
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Se desligado, é só uma notificação — respostas do
                                                        contato caem para a fila humana
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={respondsAfterProactive}
                                                    onCheckedChange={setRespondsAfterProactive}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {showPersonaSections && (
                                        <div className="flex flex-col gap-4 border-t pt-4">
                                            <PersonaSectionsEditor
                                                values={personaSections}
                                                onChange={handlePersonaSectionChange}
                                            />
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <Label>Base de conhecimento</Label>
                                                    <Select value={knowledgeBaseId} onValueChange={setKnowledgeBaseId}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Nenhuma" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {knowledgeBases.map((kb) => (
                                                                <SelectItem key={kb.id} value={String(kb.id)}>
                                                                    {kb.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <Label>Gateway de IA</Label>
                                                    <Select value={aiGatewayId} onValueChange={setAiGatewayId}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Selecione um gateway" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {aiGateways.map((g) => (
                                                                <SelectItem key={g.id} value={String(g.id)}>
                                                                    {g.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <Label>Máximo de turnos</Label>
                                                    <Input
                                                        type="number"
                                                        value={maxTurns}
                                                        onChange={(e) => setMaxTurns(e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <Label>Quando o RAG não souber responder</Label>
                                                    <Select
                                                        value={ragFallbackBehavior}
                                                        onValueChange={setRagFallbackBehavior}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="handoff">Transferir para humano</SelectItem>
                                                            <SelectItem value="generic_answer">
                                                                Responder com conhecimento genérico
                                                            </SelectItem>
                                                            <SelectItem value="fixed_message">Mensagem fixa</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            {ragFallbackBehavior === "fixed_message" && (
                                                <div className="flex flex-col gap-1.5">
                                                    <Label>Mensagem fixa</Label>
                                                    <Textarea
                                                        value={ragFallbackMessage}
                                                        onChange={(e) => setRagFallbackMessage(e.target.value)}
                                                        rows={2}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {mode === "router" && (
                                        <>
                                            {isEditing ? (
                                                <AssistantRouterOptions assistantId={Number(assistantId)} />
                                            ) : (
                                                <p className="text-sm text-muted-foreground">
                                                    Salve o assistente primeiro para configurar as opções do menu.
                                                </p>
                                            )}
                                        </>
                                    )}
                                </TabsContent>

                                <TabsContent value="gatilho" className="flex flex-col gap-4 pt-2">
                                    <Label>Gatilho</Label>
                                    <Tabs
                                        value={triggerType}
                                        onValueChange={(v) => setTriggerType(v as "any" | "keyword")}
                                    >
                                        <TabsList className="grid grid-cols-2 w-full max-w-xs">
                                            <TabsTrigger value="any">Todas as mensagens</TabsTrigger>
                                            <TabsTrigger value="keyword">Palavra-chave</TabsTrigger>
                                        </TabsList>
                                    </Tabs>

                                    {triggerType === "keyword" && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <Label>Operador</Label>
                                                <Select value={triggerOperator} onValueChange={setTriggerOperator}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="contains">contém</SelectItem>
                                                        <SelectItem value="equals">igual</SelectItem>
                                                        <SelectItem value="starts_with">começa com</SelectItem>
                                                        <SelectItem value="ends_with">termina com</SelectItem>
                                                        <SelectItem value="regex">regex</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label>Valor do gatilho</Label>
                                                <Input
                                                    value={triggerValue}
                                                    onChange={(e) => setTriggerValue(e.target.value)}
                                                    placeholder="Ex: oi, menu, começar"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="avancado" className="flex flex-col gap-4 pt-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <Label>Expirar sessão (min)</Label>
                                            <Input
                                                type="number"
                                                value={sessionExpiryMinutes}
                                                onChange={(e) => setSessionExpiryMinutes(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label>Atraso de digitação (ms)</Label>
                                            <Input
                                                type="number"
                                                value={typingDelayMs}
                                                onChange={(e) => setTypingDelayMs(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label>Debounce (s)</Label>
                                            <Input
                                                type="number"
                                                value={debounceSeconds}
                                                onChange={(e) => setDebounceSeconds(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label>Palavra para encerrar</Label>
                                            <Input
                                                value={endKeyword}
                                                onChange={(e) => setEndKeyword(e.target.value)}
                                                placeholder="Ex: sair"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label>Mensagem de expiração</Label>
                                        <Textarea
                                            value={expiryMessage}
                                            onChange={(e) => setExpiryMessage(e.target.value)}
                                            rows={2}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label>Mensagem de encerramento</Label>
                                        <Textarea
                                            value={closingMessage}
                                            onChange={(e) => setClosingMessage(e.target.value)}
                                            rows={2}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between rounded-xl border p-3">
                                            <p className="text-sm font-medium">Parar assistente quando eu responder</p>
                                            <Switch checked={stopOnHumanReply} onCheckedChange={setStopOnHumanReply} />
                                        </div>
                                        {groupsMode === "legacy" && (
                                            <div className="flex items-center justify-between rounded-xl border p-3">
                                                <p className="text-sm font-medium">Ignorar grupos</p>
                                                <Switch checked={ignoreGroups} onCheckedChange={setIgnoreGroups} />
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="grupos" className="flex flex-col gap-4 pt-2">
                                    <div className="flex flex-col gap-1.5 rounded-xl border p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium">Selecionar grupos específicos</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Em vez de ignorar/permitir todos os grupos de uma vez, escolha
                                                    quais grupos o assistente enxerga. Um grupo ativo só recebe
                                                    resposta automática quando o assistente é mencionado — fora
                                                    isso, ele só observa.
                                                </p>
                                            </div>
                                            <Switch
                                                checked={groupsMode === "selective"}
                                                onCheckedChange={(checked) =>
                                                    setGroupsMode(checked ? "selective" : "legacy")
                                                }
                                            />
                                        </div>
                                    </div>

                                    {groupsMode !== "selective" && (
                                        <p className="text-sm text-muted-foreground">
                                            Grupos desligado (modo "Ignorar grupos" na aba Avançado decide
                                            tudo-ou-nada). Ative "Selecionar grupos específicos" acima para
                                            escolher grupo a grupo.
                                        </p>
                                    )}

                                    {groupsMode === "selective" && !isEditing && (
                                        <p className="text-sm text-muted-foreground">
                                            Salve o assistente primeiro para configurar os grupos — a lista de
                                            grupos é vinculada ao assistente já criado.
                                        </p>
                                    )}

                                    {groupsMode === "selective" && isEditing && (
                                        <AssistantGroupsPanel assistantId={Number(assistantId)} />
                                    )}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </PageContent>

            <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Testar Bot — {name || "Assistente"}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                            <Label>Mensagem de teste</Label>
                            <Textarea
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                                placeholder="Olá, isso é um teste. Pode responder normalmente?"
                                rows={2}
                            />
                        </div>
                        <Button onClick={handleRunTest} disabled={testing}>
                            {testing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testando...
                                </>
                            ) : (
                                <>
                                    <PlayCircle className="mr-2 h-4 w-4" /> Enviar teste
                                </>
                            )}
                        </Button>

                        {testResult && (
                            <div className="rounded-xl border p-3 flex flex-col gap-2">
                                {testResult.testable === false ? (
                                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <Info className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>{testResult.message}</span>
                                    </div>
                                ) : testResult.success ? (
                                    <>
                                        <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                                            <CheckCircle2 className="h-4 w-4" /> Resposta real do assistente
                                        </div>
                                        <p className="text-sm whitespace-pre-wrap bg-muted/40 rounded-lg p-3">
                                            {testResult.reply}
                                        </p>
                                        {testResult.action && (
                                            <p className="text-xs text-muted-foreground">
                                                Ação do modelo: <span className="font-medium">{testResult.action}</span>
                                                {typeof testResult.confidence === "number" &&
                                                    ` · confiança ${(testResult.confidence * 100).toFixed(0)}%`}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-start gap-2 text-sm text-destructive">
                                        <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>{testResult.error ?? "Falha ao testar o assistente."}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setTestDialogOpen(false)}>
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageLayout>
    );
};

export default AssistantCreator;
