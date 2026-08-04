import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { Plus, Trash2, Tag, Bell, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    listWatchTags,
    createWatchTag,
    deleteWatchTag,
    listWatchMatches,
    GroupWatchTag,
    GroupWatchMatch,
} from "../../../services/groupService";
import { subscribeToSocket } from "../../../services/sse-client";

const timeAgo = (iso: string): string => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `${min}min atrás`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
};

const MonitoramentoTab: React.FC = () => {
    const navigate = useNavigate();
    const [tags, setTags] = useState<GroupWatchTag[]>([]);
    const [matches, setMatches] = useState<GroupWatchMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTagOpen, setNewTagOpen] = useState(false);
    const [phrase, setPhrase] = useState("");
    const [saving, setSaving] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [t, m] = await Promise.all([listWatchTags(), listWatchMatches()]);
            setTags(t);
            setMatches(m);
        } catch {
            toast.error("Erro ao carregar monitoramento de frases.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // Feed ao vivo: cada match novo aparece na hora, sem esperar o próximo
    // refresh manual — a listagem inicial (fetchAll) já cobre o histórico.
    useEffect(() => {
        const cleanup = subscribeToSocket({
            "group-watch-match": (payload: GroupWatchMatch) => {
                if (!payload || typeof payload.id !== "number") return;
                setMatches((prev) => {
                    if (prev.some((m) => m.id === payload.id)) return prev;
                    return [payload, ...prev].slice(0, 100);
                });
                toast.info(
                    `"${payload.phrase}" mencionada em ${payload.groupSubject || "um grupo"}`,
                    { onClick: () => navigate(`/tickets/${payload.ticketId}`) }
                );
            },
        });
        return cleanup;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreateTag = async () => {
        const trimmed = phrase.trim();
        if (!trimmed) return;
        setSaving(true);
        try {
            const tag = await createWatchTag(trimmed);
            setTags((prev) => [tag, ...prev]);
            setPhrase("");
            setNewTagOpen(false);
            toast.success("Frase monitorada com sucesso!");
        } catch {
            toast.error("Erro ao criar frase monitorada.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTag = async (id: number) => {
        try {
            await deleteWatchTag(id);
            setTags((prev) => prev.filter((t) => t.id !== id));
            toast.success("Frase removida.");
        } catch {
            toast.error("Erro ao remover frase.");
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                {tags.length === 0 && !loading ? (
                    <span className="text-sm text-muted-foreground">
                        Nenhuma frase monitorada ainda.
                    </span>
                ) : (
                    tags.map((t) => (
                        <Badge key={t.id} variant="secondary" className="gap-1.5 pr-1">
                            {t.phrase}
                            <button
                                type="button"
                                onClick={() => handleDeleteTag(t.id)}
                                className="rounded-full hover:bg-black/10 p-0.5"
                                aria-label={`Remover "${t.phrase}"`}
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))
                )}
                <Button onClick={() => setNewTagOpen(true)} className="ml-auto gap-2">
                    <Plus className="h-4 w-4" />
                    Nova frase
                </Button>
            </div>

            <div className="flex items-center gap-2 pt-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Menções recentes</h3>
            </div>

            {loading ? (
                <p className="text-sm text-muted-foreground px-1">Carregando...</p>
            ) : matches.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 text-center px-6 py-16">
                    <MessageSquareText className="h-8 w-8 text-muted-foreground" />
                    <h3 className="text-base font-medium">Nenhuma menção ainda</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                        Assim que alguém mencionar uma frase monitorada em um grupo, ela aparece aqui.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {matches.map((m) => (
                        <Card
                            key={m.id}
                            className="rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)] cursor-pointer hover:shadow-[0px_6px_24px_rgba(0,0,0,0.12)] transition-shadow"
                            onClick={() => navigate(`/tickets/${m.ticketId}`)}
                        >
                            <CardContent className="p-4 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <Badge variant="secondary">{m.phrase}</Badge>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                        {timeAgo(m.createdAt)}
                                    </span>
                                </div>
                                <p className="text-sm font-medium truncate">{m.groupSubject || "Grupo"}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {m.contactName ? `${m.contactName}: ` : ""}
                                    {m.snippet}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={newTagOpen} onOpenChange={setNewTagOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova frase monitorada</DialogTitle>
                    </DialogHeader>
                    <Input
                        placeholder="ex: alguém pode me ajudar"
                        value={phrase}
                        onChange={(e) => setPhrase(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewTagOpen(false)} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button onClick={handleCreateTag} disabled={saving || !phrase.trim()}>
                            {saving ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MonitoramentoTab;
