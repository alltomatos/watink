import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Send, XCircle, SkipForward, MessageCircle, Quote, Clock, Ban } from "lucide-react";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import notify from "@/lib/notify";
import {
    getGroupCampaign,
    listGroupCampaignRuns,
    listGroupCampaignSends,
    listGroupCampaignReplies,
    type GroupCampaign,
    type GroupCampaignRun,
    type GroupCampaignSend,
    type GroupCampaignSendStatus,
    type GroupCampaignReply,
} from "@/services/groupCampaignService";

const SEND_STATUS_CHIP: Record<GroupCampaignSendStatus, { status: "success" | "error" | "warning" | "info" | "default"; label: string }> = {
    pending: { status: "default", label: "Pendente" },
    sending: { status: "info", label: "Enviando" },
    sent: { status: "success", label: "Enviado" },
    failed: { status: "error", label: "Falhou" },
    skipped: { status: "warning", label: "Ignorado" },
    canceled: { status: "default", label: "Cancelado" },
};

interface VariantStat {
    index: number;
    label: string;
    sent: number;
    replies: number;
}

const GroupCampaignReport: React.FC = () => {
    const navigate = useNavigate();
    const { campaignId } = useParams<{ campaignId: string }>();
    const id = Number(campaignId);

    const [campaign, setCampaign] = useState<GroupCampaign | null>(null);
    const [loading, setLoading] = useState(true);

    const [runs, setRuns] = useState<GroupCampaignRun[]>([]);
    const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
    const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;

    const [sends, setSends] = useState<GroupCampaignSend[]>([]);
    const [sendsCount, setSendsCount] = useState(0);
    const [sendsPage, setSendsPage] = useState(1);
    const [sendsLoading, setSendsLoading] = useState(false);

    const [replies, setReplies] = useState<GroupCampaignReply[]>([]);
    const [repliesPage, setRepliesPage] = useState(1);
    const [quotedCount, setQuotedCount] = useState(0);
    const [windowCount, setWindowCount] = useState(0);
    const [repliesLoading, setRepliesLoading] = useState(false);

    const [variantStats, setVariantStats] = useState<VariantStat[]>([]);
    const [variantStatsLoading, setVariantStatsLoading] = useState(false);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        Promise.all([getGroupCampaign(id), listGroupCampaignRuns(id, 1)])
            .then(([campaignData, runsData]) => {
                setCampaign(campaignData);
                setRuns(runsData.items);
                if (runsData.items.length > 0) setSelectedRunId(runsData.items[0].id);
            })
            .catch(notify.error)
            .finally(() => setLoading(false));
    }, [id]);

    const fetchSends = useCallback(
        async (page: number) => {
            if (!selectedRunId) return;
            setSendsLoading(true);
            try {
                const res = await listGroupCampaignSends(id, selectedRunId, page);
                setSends(res.items);
                setSendsCount(res.count);
                setSendsPage(res.pageNumber);
            } catch (err) {
                notify.error(err);
            } finally {
                setSendsLoading(false);
            }
        },
        [id, selectedRunId]
    );

    useEffect(() => {
        if (selectedRunId) fetchSends(1);
    }, [selectedRunId, fetchSends]);

    const fetchReplies = useCallback(
        async (page: number) => {
            setRepliesLoading(true);
            try {
                const res = await listGroupCampaignReplies(id, page);
                setReplies(res.replies);
                setRepliesPage(res.pageNumber);
                setQuotedCount(res.quotedCount);
                setWindowCount(res.windowCount);
            } catch (err) {
                notify.error(err);
            } finally {
                setRepliesLoading(false);
            }
        },
        [id]
    );

    useEffect(() => {
        if (id) fetchReplies(1);
    }, [id, fetchReplies]);

    // Taxa de resposta por variante (o payoff real da rotação de conteúdo) --
    // caminha TODAS as páginas de sends da run selecionada e de replies da
    // campanha (ambas com um teto -- ver comentário abaixo -- nunca um
    // travamento silencioso: acima do teto o número fica subestimado, não
    // errado, e isso é o trade-off aceito para não disparar centenas de
    // requisições numa página de relatório).
    useEffect(() => {
        if (!selectedRun || !selectedRun.variantsSnapshot || selectedRun.variantsSnapshot.length === 0) {
            setVariantStats([]);
            return;
        }
        let cancelled = false;
        setVariantStatsLoading(true);

        const MAX_PAGES = 20; // 20 * 20/página = 400 itens, acima do teto de 300 alvos/run (campaignMaxTargetsPerRun)

        async function walkAllPages<T>(fetchPage: (page: number) => Promise<{ items: T[]; count: number }>): Promise<T[]> {
            const all: T[] = [];
            let page = 1;
            for (; page <= MAX_PAGES; page++) {
                const res = await fetchPage(page);
                all.push(...res.items);
                if (all.length >= res.count || res.items.length === 0) break;
            }
            return all;
        }

        (async () => {
            try {
                const [allSends, allReplies] = await Promise.all([
                    walkAllPages((page) => listGroupCampaignSends(id, selectedRun.id, page)),
                    walkAllPages((page) =>
                        listGroupCampaignReplies(id, page).then((r) => ({ items: r.replies, count: r.replies.length + (r.pageNumber - 1) * 20 }))
                    ),
                ]);
                if (cancelled) return;

                const sendById = new Map(allSends.map((s) => [s.id, s]));
                const stats: VariantStat[] = (selectedRun.variantsSnapshot ?? []).map((v, index) => ({
                    index,
                    label: `Variante ${index + 1}`,
                    sent: 0,
                    replies: 0,
                }));
                for (const s of allSends) {
                    if (stats[s.variantIndex]) stats[s.variantIndex].sent += 1;
                }
                for (const r of allReplies) {
                    if (r.runId !== selectedRun.id) continue;
                    const send = sendById.get(r.sendId);
                    if (send && stats[send.variantIndex]) stats[send.variantIndex].replies += 1;
                }
                setVariantStats(stats);
            } catch (err) {
                if (!cancelled) notify.error(err);
            } finally {
                if (!cancelled) setVariantStatsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [id, selectedRun]);

    const sendColumns: DataTableColumn<GroupCampaignSend>[] = useMemo(
        () => [
            { key: "subject", header: "Grupo", cell: (s) => <span className="truncate">{s.subject || s.jid}</span> },
            {
                key: "status",
                header: "Status",
                cell: (s) => {
                    const chip = SEND_STATUS_CHIP[s.status];
                    return <StatusChip status={chip.status} label={chip.label} size="sm" />;
                },
            },
            {
                key: "scheduledAt",
                header: "Horário",
                cell: (s) => (s.sentAt ? new Date(s.sentAt).toLocaleString("pt-BR") : new Date(s.scheduledAt).toLocaleString("pt-BR")),
            },
            {
                key: "variant",
                header: "Variante",
                cell: (s) => selectedRun?.variantsSnapshot?.[s.variantIndex] ? `Variante ${s.variantIndex + 1}` : "—",
            },
            {
                key: "error",
                header: "Erro",
                cell: (s) => (s.status === "failed" ? <span className="text-destructive text-xs">{s.lastError || "Erro desconhecido"}</span> : "—"),
            },
        ],
        [selectedRun]
    );

    if (loading) {
        return (
            <PageContainer>
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </PageContainer>
        );
    }

    if (!campaign) {
        return (
            <PageContainer>
                <PageContent>
                    <p className="text-center text-muted-foreground py-20">Campanha não encontrada.</p>
                </PageContent>
            </PageContainer>
        );
    }

    const totalSendsPages = Math.max(1, Math.ceil(sendsCount / 20));
    const totalRepliesLoaded = replies.length + (repliesPage - 1) * 20;
    const hasMoreReplies = totalRepliesLoaded < quotedCount + windowCount;

    return (
        <PageContainer>
            <PageHeader title={`Relatório — ${campaign.name}`} description="Envios e respostas por ocorrência">
                <Button variant="ghost" onClick={() => navigate("/grupos-whatsapp/campanhas")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>
            </PageHeader>

            <PageContent>
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">Ocorrência:</span>
                        <Select
                            value={selectedRunId ? String(selectedRunId) : ""}
                            onValueChange={(v) => setSelectedRunId(Number(v))}
                        >
                            <SelectTrigger className="w-[320px]">
                                <SelectValue placeholder="Selecione uma ocorrência" />
                            </SelectTrigger>
                            <SelectContent>
                                {runs.map((r) => (
                                    <SelectItem key={r.id} value={String(r.id)}>
                                        {new Date(r.scheduledFor).toLocaleString("pt-BR")} · {r.status}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {!selectedRun ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                            Esta campanha ainda não teve nenhuma ocorrência disparada.
                        </p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                                    <CardContent className="p-4 flex items-center gap-3">
                                        <Send className="h-5 w-5 text-emerald-600" />
                                        <div>
                                            <p className="text-xl font-semibold">{selectedRun.sentCount}</p>
                                            <p className="text-xs text-muted-foreground">Enviados</p>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                                    <CardContent className="p-4 flex items-center gap-3">
                                        <XCircle className="h-5 w-5 text-destructive" />
                                        <div>
                                            <p className="text-xl font-semibold">{selectedRun.failedCount}</p>
                                            <p className="text-xs text-muted-foreground">Falhas</p>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                                    <CardContent className="p-4 flex items-center gap-3">
                                        <SkipForward className="h-5 w-5 text-amber-600" />
                                        <div>
                                            <p className="text-xl font-semibold">{selectedRun.skippedCount}</p>
                                            <p className="text-xs text-muted-foreground">Ignorados</p>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                                    <CardContent className="p-4 flex items-center gap-3">
                                        <MessageCircle className="h-5 w-5 text-primary" />
                                        <div>
                                            <p className="text-xl font-semibold">{selectedRun.replyCount}</p>
                                            <p className="text-xs text-muted-foreground">Respostas (run)</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {variantStats.length > 0 && (
                                <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                                    <CardContent className="p-5 space-y-3">
                                        <p className="text-sm font-semibold">Taxa de resposta por variante</p>
                                        {variantStatsLoading ? (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" /> Calculando...
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {variantStats.map((v) => (
                                                    <div key={v.index} className="rounded-lg border px-3 py-2">
                                                        <p className="text-sm font-medium">{v.label}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {v.replies} de {v.sent} (
                                                            {v.sent > 0 ? Math.round((v.replies / v.sent) * 100) : 0}%)
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                                <CardContent className="p-5 space-y-3">
                                    <p className="text-sm font-semibold">Envios desta ocorrência</p>
                                    <DataTable
                                        columns={sendColumns}
                                        data={sends}
                                        getRowKey={(s) => s.id}
                                        loading={sendsLoading}
                                        emptyTitle="Nenhum envio"
                                    />
                                    {sendsCount > 20 && (
                                        <div className="flex items-center justify-between pt-2">
                                            <span className="text-xs text-muted-foreground">
                                                Página {sendsPage} de {totalSendsPages} · {sendsCount} envios
                                            </span>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={sendsPage <= 1 || sendsLoading}
                                                    onClick={() => fetchSends(sendsPage - 1)}
                                                >
                                                    Anterior
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={sendsPage >= totalSendsPages || sendsLoading}
                                                    onClick={() => fetchSends(sendsPage + 1)}
                                                >
                                                    Próxima
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}

                    <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                        <CardContent className="p-5 space-y-4">
                            <p className="text-sm font-semibold">Respostas da campanha</p>
                            <p className="text-xs text-muted-foreground">
                                Citação e janela de tempo nunca são somadas num único número — o sinal de janela é
                                mais fraco (conta qualquer conversa do grupo).
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5 text-sm">
                                    <Quote className="h-4 w-4 text-primary" />
                                    <span className="font-semibold">{quotedCount}</span>
                                    <span className="text-muted-foreground">com citação</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-sm">
                                    <Clock className="h-4 w-4 text-amber-600" />
                                    <span className="font-semibold">{windowCount}</span>
                                    <span className="text-muted-foreground">na janela</span>
                                </div>
                            </div>

                            {repliesLoading ? (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                </div>
                            ) : replies.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma resposta capturada ainda.</p>
                            ) : (
                                <div className="space-y-2">
                                    {replies.map((r) => (
                                        <div key={r.id} className="rounded-lg border px-3 py-2 flex items-start gap-2">
                                            {r.matchType === "quoted" ? (
                                                <Quote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                            ) : (
                                                <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-medium">{r.contactName || r.participant || "Participante"}</span>
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {r.matchType === "quoted" ? "Citação" : "Janela"}
                                                    </Badge>
                                                    {r.isOptOut && (
                                                        <Badge variant="destructive" className="gap-1 text-[10px]">
                                                            <Ban className="h-3 w-3" /> Opt-out
                                                        </Badge>
                                                    )}
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {new Date(r.repliedAt).toLocaleString("pt-BR")}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground truncate">{r.body}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {(repliesPage > 1 || hasMoreReplies) && (
                                <div className="flex items-center justify-between pt-2">
                                    <span className="text-xs text-muted-foreground">Página {repliesPage}</span>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={repliesPage <= 1 || repliesLoading}
                                            onClick={() => fetchReplies(repliesPage - 1)}
                                        >
                                            Anterior
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={!hasMoreReplies || repliesLoading}
                                            onClick={() => fetchReplies(repliesPage + 1)}
                                        >
                                            Próxima
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </PageContent>
        </PageContainer>
    );
};

export default GroupCampaignReport;
