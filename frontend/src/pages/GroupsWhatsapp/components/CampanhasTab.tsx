import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Plus,
    Search,
    Megaphone,
    Play,
    Pause,
    Ban,
    BarChart3,
    Pencil,
    MoreVertical,
    Send,
    XCircle,
    MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import notify from "@/lib/notify";
import { useGroupsConnection } from "../../Groups/hooks/useGroups";
import { classifyGroupsApiError, GroupsApiError } from "../../Groups/groupTypes";
import GroupsErrorState from "../../Groups/GroupsErrorState";
import {
    listGroupCampaigns,
    getGroupCampaign,
    listGroupCampaignRuns,
    pauseGroupCampaign,
    resumeGroupCampaign,
    cancelGroupCampaign,
    type GroupCampaign,
    type GroupCampaignStatus,
    type GroupCampaignRun,
} from "../../../services/groupCampaignService";

interface CampaignCardDetails {
    targetsCount: number;
    lastRun: GroupCampaignRun | null;
}

const WEEKDAY_LABELS: Record<string, string> = {
    "0": "domingo",
    "1": "segunda",
    "2": "terça",
    "3": "quarta",
    "4": "quinta",
    "5": "sexta",
    "6": "sábado",
};

/** "Toda segunda e quinta, 09:00" / "Imediato" / "Em 12/08 às 14:00" -- a
 * campanha guarda os campos crus (scheduleMode/recurrenceDays/recurrenceTime
 * etc.), essa função é só a tradução pra texto legível do card. */
function describeCampaignSchedule(c: GroupCampaign): string {
    if (c.scheduleMode === "immediate") return "Imediato";
    if (c.scheduleMode === "once") {
        if (!c.startAt) return "Data não definida";
        return `Em ${format(new Date(c.startAt), "dd/MM 'às' HH:mm", { locale: ptBR })}`;
    }
    // recurring
    const time = c.recurrenceTime || "--:--";
    if (c.recurrenceRule === "weekly") {
        const days = (c.recurrenceDays || "")
            .split(",")
            .filter(Boolean)
            .map((d) => WEEKDAY_LABELS[d.trim()] ?? d.trim());
        const label = days.length > 0 ? `Toda ${days.join(" e ")}` : "Recorrente semanal";
        return `${label}, ${time}`;
    }
    if (c.recurrenceRule === "monthly") {
        const days = (c.recurrenceDays || "").split(",").filter(Boolean).join(", ");
        return `Todo dia ${days || "?"} do mês, ${time}`;
    }
    return "Recorrente";
}

const STATUS_LABELS: Record<GroupCampaignStatus, string> = {
    draft: "Rascunho",
    scheduled: "Agendada",
    running: "Em execução",
    paused: "Pausada",
    completed: "Concluída",
    canceled: "Cancelada",
};

const STATUS_BADGE_VARIANT: Record<GroupCampaignStatus, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "outline",
    scheduled: "secondary",
    running: "default",
    paused: "secondary",
    completed: "outline",
    canceled: "destructive",
};

const CampanhasTab: React.FC = () => {
    const navigate = useNavigate();
    const { whatsapps, whatsappId, setWhatsappId, loadingConnections } = useGroupsConnection();
    const [campaigns, setCampaigns] = useState<GroupCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState<GroupsApiError | null>(null);
    const [search, setSearch] = useState("");
    const [actioningId, setActioningId] = useState<number | null>(null);
    const [details, setDetails] = useState<Record<number, CampaignCardDetails>>({});

    const fetchCampaigns = useCallback(async () => {
        setLoading(true);
        setApiError(null);
        try {
            const list = await listGroupCampaigns();
            setCampaigns(list);
            // Enriquecimento por campanha (nº de alvos + contadores da última
            // run) roda em paralelo e não bloqueia a listagem principal --
            // cada card atualiza assim que sua própria resposta chega.
            list.forEach((c) => {
                Promise.all([
                    getGroupCampaign(c.id).then((full) => full.targets.length).catch(() => 0),
                    listGroupCampaignRuns(c.id, 1).then((r) => r.items[0] ?? null).catch(() => null),
                ]).then(([targetsCount, lastRun]) => {
                    setDetails((prev) => ({ ...prev, [c.id]: { targetsCount, lastRun } }));
                });
            });
        } catch (err) {
            setApiError(classifyGroupsApiError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    const filtered = campaigns
        .filter((c) => !whatsappId || c.whatsappId === whatsappId)
        .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

    const applyLocalUpdate = (updated: GroupCampaign) => {
        setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    };

    const runAction = async (id: number, action: () => Promise<GroupCampaign>, successMsg: string) => {
        setActioningId(id);
        try {
            const updated = await action();
            applyLocalUpdate(updated);
            notify.success(successMsg);
        } catch (err) {
            notify.error(err);
        } finally {
            setActioningId(null);
        }
    };

    const renderCampaignCard = (c: GroupCampaign) => {
        const connName = whatsapps.find((w) => w.id === c.whatsappId)?.name ?? `Conexão #${c.whatsappId}`;
        return (
            <Card
                key={c.id}
                className="rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)] hover:shadow-[0px_6px_24px_rgba(0,0,0,0.12)] transition-shadow"
            >
                <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                        <div className="rounded-full bg-primary/10 p-2 shrink-0">
                            <Megaphone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{connName}</p>
                        </div>
                        <Badge variant={STATUS_BADGE_VARIANT[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">{describeCampaignSchedule(c)}</p>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                            {details[c.id]?.targetsCount ?? "…"} grupo{details[c.id]?.targetsCount === 1 ? "" : "s"}
                        </span>
                        {c.nextOccurrenceAt && (
                            <span>
                                Próxima: {format(new Date(c.nextOccurrenceAt), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                        )}
                    </div>

                    {details[c.id]?.lastRun && (
                        <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <Send className="h-3 w-3" />
                                {details[c.id]!.lastRun!.sentCount}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <XCircle className="h-3 w-3" />
                                {details[c.id]!.lastRun!.failedCount}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <MessageCircle className="h-3 w-3" />
                                {details[c.id]!.lastRun!.replyCount}
                            </span>
                        </div>
                    )}

                    {c.pauseReason && (
                        <p className="text-xs text-destructive">{c.pauseReason}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => navigate(`/group-campaigns/${c.id}/report`)}
                            >
                                <BarChart3 className="h-3.5 w-3.5" />
                                Relatório
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => navigate(`/group-campaigns/${c.id}`)}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                Editar
                            </Button>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={actioningId === c.id}>
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {c.status === "running" && (
                                    <DropdownMenuItem
                                        onClick={() =>
                                            runAction(c.id, () => pauseGroupCampaign(c.id), "Campanha pausada.")
                                        }
                                    >
                                        <Pause className="h-4 w-4 mr-2" />
                                        Pausar
                                    </DropdownMenuItem>
                                )}
                                {c.status === "paused" && (
                                    <DropdownMenuItem
                                        onClick={() =>
                                            runAction(c.id, () => resumeGroupCampaign(c.id), "Campanha retomada.")
                                        }
                                    >
                                        <Play className="h-4 w-4 mr-2" />
                                        Retomar
                                    </DropdownMenuItem>
                                )}
                                {(c.status === "running" || c.status === "scheduled" || c.status === "paused") && (
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() =>
                                            runAction(c.id, () => cancelGroupCampaign(c.id), "Campanha cancelada.")
                                        }
                                    >
                                        <Ban className="h-4 w-4 mr-2" />
                                        Cancelar
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
                <Select
                    value={whatsappId ? String(whatsappId) : ""}
                    onValueChange={(v) => setWhatsappId(Number(v))}
                >
                    <SelectTrigger className="w-[220px]">
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
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar campanha..."
                        className="pl-8 w-[220px]"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button
                    onClick={() => navigate("/group-campaigns/new")}
                    disabled={!whatsappId}
                    className="ml-auto gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Criar campanha
                </Button>
            </div>

            {loadingConnections || loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-36 rounded-2xl" />
                    ))}
                </div>
            ) : whatsapps.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-6 py-16">
                    <h3 className="text-lg font-semibold">Nenhuma conexão disponível</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                        Conecte um número de WhatsApp para criar campanhas em grupos.
                    </p>
                    <Button onClick={() => navigate("/connections")}>Ir para Conexões</Button>
                </div>
            ) : apiError ? (
                <GroupsErrorState error={apiError} />
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 h-full text-center px-6 py-16">
                    <Megaphone className="h-8 w-8 text-muted-foreground" />
                    <h3 className="text-base font-medium">Nenhuma campanha ainda</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                        Crie uma campanha para postar uma mensagem programada em vários grupos de uma vez.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(renderCampaignCard)}
                </div>
            )}
        </div>
    );
};

export default CampanhasTab;
