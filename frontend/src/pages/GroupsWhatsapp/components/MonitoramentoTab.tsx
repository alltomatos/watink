import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { Plus, Trash2, Pencil, Tag, Bell, MessageSquareText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    listWatchTags,
    createWatchTag,
    updateWatchTag,
    deleteWatchTag,
    listWatchMatches,
    GroupWatchTag,
    GroupWatchMatch,
    GroupWatchMatchMode,
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

interface TagFormState {
    phrase: string;
    matchMode: GroupWatchMatchMode;
    notifyGlobally: boolean;
    active: boolean;
}

const emptyForm: TagFormState = { phrase: "", matchMode: "contains", notifyGlobally: false, active: true };

const MonitoramentoTab: React.FC = () => {
    const navigate = useNavigate();
    const [tags, setTags] = useState<GroupWatchTag[]>([]);
    const [matches, setMatches] = useState<GroupWatchMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [matchesLoading, setMatchesLoading] = useState(false);
    const [activeFilterTagId, setActiveFilterTagId] = useState<number | null>(null);

    const [formOpen, setFormOpen] = useState(false);
    const [editingTag, setEditingTag] = useState<GroupWatchTag | null>(null);
    const [form, setForm] = useState<TagFormState>(emptyForm);
    const [saving, setSaving] = useState(false);

    const fetchMatches = useCallback(async (tagId: number | null) => {
        setMatchesLoading(true);
        try {
            setMatches(await listWatchMatches(tagId ?? undefined));
        } catch {
            toast.error("Erro ao carregar menções.");
        } finally {
            setMatchesLoading(false);
        }
    }, []);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [t] = await Promise.all([listWatchTags(), fetchMatches(activeFilterTagId)]);
            setTags(t);
        } catch {
            toast.error("Erro ao carregar monitoramento de frases.");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // Feed ao vivo: cada match novo aparece na hora, sem esperar o próximo
    // refresh manual — a listagem inicial (fetchAll) já cobre o histórico.
    // Respeita o filtro de tag ativo: só entra na lista visível se casar.
    useEffect(() => {
        const cleanup = subscribeToSocket({
            "group-watch-match": (payload: GroupWatchMatch) => {
                if (!payload || typeof payload.id !== "number") return;
                if (activeFilterTagId !== null && payload.tagId !== activeFilterTagId) return;
                setMatches((prev) => {
                    if (prev.some((m) => m.id === payload.id)) return prev;
                    return [payload, ...prev].slice(0, 100);
                });
            },
        });
        return cleanup;
    }, [activeFilterTagId]);

    const handleSelectFilter = (tagId: number | null) => {
        setActiveFilterTagId(tagId);
        fetchMatches(tagId);
    };

    const openCreate = () => {
        setEditingTag(null);
        setForm(emptyForm);
        setFormOpen(true);
    };

    const openEdit = (tag: GroupWatchTag) => {
        setEditingTag(tag);
        setForm({
            phrase: tag.phrase,
            matchMode: tag.matchMode,
            notifyGlobally: tag.notifyGlobally,
            active: tag.active,
        });
        setFormOpen(true);
    };

    const handleSubmit = async () => {
        const phrase = form.phrase.trim();
        if (!phrase) return;
        setSaving(true);
        try {
            if (editingTag) {
                const updated = await updateWatchTag(editingTag.id, { ...form, phrase });
                setTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                toast.success("Frase atualizada!");
            } else {
                const created = await createWatchTag({
                    phrase,
                    matchMode: form.matchMode,
                    notifyGlobally: form.notifyGlobally,
                });
                setTags((prev) => [created, ...prev]);
                toast.success("Frase monitorada com sucesso!");
            }
            setFormOpen(false);
        } catch {
            toast.error(editingTag ? "Erro ao atualizar frase." : "Erro ao criar frase monitorada.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTag = async (id: number) => {
        try {
            await deleteWatchTag(id);
            setTags((prev) => prev.filter((t) => t.id !== id));
            if (activeFilterTagId === id) handleSelectFilter(null);
            toast.success("Frase removida.");
        } catch {
            toast.error("Erro ao remover frase.");
        }
    };

    const activeFilterTag = tags.find((t) => t.id === activeFilterTagId) ?? null;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                {tags.length === 0 && !loading ? (
                    <span className="text-sm text-muted-foreground">
                        Nenhuma frase monitorada ainda.
                    </span>
                ) : (
                    tags.map((t) => {
                        const isActiveFilter = t.id === activeFilterTagId;
                        return (
                            <Badge
                                key={t.id}
                                variant={isActiveFilter ? "default" : "secondary"}
                                className="gap-1.5 pr-1 cursor-pointer select-none"
                                onClick={() => handleSelectFilter(isActiveFilter ? null : t.id)}
                                title={isActiveFilter ? "Clique para remover o filtro" : "Clique para filtrar por essa frase"}
                            >
                                {t.phrase}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openEdit(t);
                                    }}
                                    className="rounded-full hover:bg-black/10 p-0.5"
                                    aria-label={`Editar "${t.phrase}"`}
                                >
                                    <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTag(t.id);
                                    }}
                                    className="rounded-full hover:bg-black/10 p-0.5"
                                    aria-label={`Remover "${t.phrase}"`}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </Badge>
                        );
                    })
                )}
                <Button onClick={openCreate} className="ml-auto gap-2">
                    <Plus className="h-4 w-4" />
                    Nova frase
                </Button>
            </div>

            <div className="flex items-center gap-2 pt-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Menções recentes</h3>
                {activeFilterTag && (
                    <Badge variant="outline" className="gap-1 ml-1">
                        Filtrado: {activeFilterTag.phrase}
                        <button
                            type="button"
                            onClick={() => handleSelectFilter(null)}
                            className="rounded-full hover:bg-black/10 p-0.5"
                            aria-label="Limpar filtro"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                )}
            </div>

            {loading || matchesLoading ? (
                <p className="text-sm text-muted-foreground px-1">Carregando...</p>
            ) : matches.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 text-center px-6 py-16">
                    <MessageSquareText className="h-8 w-8 text-muted-foreground" />
                    <h3 className="text-base font-medium">
                        {activeFilterTag ? "Nenhuma menção dessa frase ainda" : "Nenhuma menção ainda"}
                    </h3>
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

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTag ? "Editar frase monitorada" : "Nova frase monitorada"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="watch-phrase">Frase</Label>
                            <Input
                                id="watch-phrase"
                                placeholder="ex: alguém pode me ajudar"
                                value={form.phrase}
                                onChange={(e) => setForm((f) => ({ ...f, phrase: e.target.value }))}
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Tipo de busca</Label>
                            <Select
                                value={form.matchMode}
                                onValueChange={(v) => setForm((f) => ({ ...f, matchMode: v as GroupWatchMatchMode }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="contains">Derivativa</SelectItem>
                                    <SelectItem value="exact">Exata</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                {form.matchMode === "exact"
                                    ? "A mensagem precisa ser exatamente igual à frase."
                                    : 'Casa em qualquer parte da mensagem (ex.: "ajuda" acha "preciso de ajuda").'}
                            </p>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <Label htmlFor="watch-notify-globally">Notificar em qualquer tela</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Mostra um toast assim que essa frase for mencionada, mesmo fora da aba Monitoramento
                                </p>
                            </div>
                            <Switch
                                id="watch-notify-globally"
                                checked={form.notifyGlobally}
                                onCheckedChange={(v) => setForm((f) => ({ ...f, notifyGlobally: v }))}
                            />
                        </div>
                        {editingTag && (
                            <div className="flex items-center justify-between">
                                <Label htmlFor="watch-active">Ativa</Label>
                                <Switch
                                    id="watch-active"
                                    checked={form.active}
                                    onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} disabled={saving || !form.phrase.trim()}>
                            {saving ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MonitoramentoTab;
