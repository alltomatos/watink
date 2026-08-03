import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { Copy, MoreVertical, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import ConfirmationModal from "@/components/ConfirmationModal";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import {
    Assistant,
    deleteAssistant,
    duplicateAssistant,
    listAssistants,
    updateAssistant,
} from "../../services/assistantService";

const MODE_LABELS: Record<Assistant["mode"], string> = {
    pipeline: "Pipeline",
    flow: "Flow",
    persona: "Persona",
    router: "Roteador",
};

type AssistantSortOption = "name" | "date";

const Assistants: React.FC = () => {
    const navigate = useNavigate();
    const [assistants, setAssistants] = useState<Assistant[]>([]);
    const [loading, setLoading] = useState(true);
    const [assistantToDelete, setAssistantToDelete] = useState<Assistant | null>(null);
    const [sortBy, setSortBy] = useLocalStorage<AssistantSortOption>("assistantsSortBy", "name");
    const [searchTerm, setSearchTerm] = useState("");
    const [togglingId, setTogglingId] = useState<number | null>(null);

    useEffect(() => {
        fetchAssistants();
    }, []);

    const fetchAssistants = async () => {
        try {
            setAssistants(await listAssistants());
        } catch {
            toast.error("Erro ao carregar assistentes");
        }
        setLoading(false);
    };

    const handleOpenAssistant = (id: number) => navigate(`/assistants/${id}/edit`);

    const handleRequestDelete = (e: React.MouseEvent, assistant: Assistant) => {
        e.stopPropagation();
        // Adia a abertura do Dialog para o próximo tick — mesmo padrão de
        // Pipelines/index.tsx, evita disputa de foco entre DropdownMenu e Dialog.
        setTimeout(() => setAssistantToDelete(assistant), 0);
    };

    const handleConfirmDelete = async () => {
        if (!assistantToDelete) return;
        try {
            await deleteAssistant(assistantToDelete.id);
            toast.success("Assistente excluído com sucesso!");
            fetchAssistants();
        } catch {
            toast.error("Erro ao excluir assistente");
        } finally {
            setAssistantToDelete(null);
        }
    };

    const handleDuplicate = async (e: React.MouseEvent, assistant: Assistant) => {
        e.stopPropagation();
        try {
            await duplicateAssistant(assistant.id);
            toast.success("Assistente duplicado com sucesso!");
            fetchAssistants();
        } catch {
            toast.error("Erro ao duplicar assistente");
        }
    };

    const handleToggleActive = async (assistant: Assistant) => {
        const nextActive = !assistant.active;
        setTogglingId(assistant.id);
        // Otimista: reflete na hora, reverte se a API rejeitar (ex.: já existe
        // outro assistant ativo nessa conexão sem "permitir múltiplos").
        setAssistants((prev) => prev.map((a) => (a.id === assistant.id ? { ...a, active: nextActive } : a)));
        try {
            const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = assistant;
            await updateAssistant(id, { ...rest, active: nextActive });
            toast.success(nextActive ? "Assistente ativado!" : "Assistente desativado!");
        } catch (err) {
            setAssistants((prev) => prev.map((a) => (a.id === assistant.id ? { ...a, active: !nextActive } : a)));
            const message =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                "Erro ao alterar status do assistente";
            toast.error(message);
        } finally {
            setTogglingId(null);
        }
    };

    const sortedAssistants = [...assistants]
        .filter((a) => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === "date") {
                return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
            }
            return a.name.localeCompare(b.name);
        });

    return (
        <PageContainer>
            <ConfirmationModal
                title="Excluir assistente"
                open={!!assistantToDelete}
                onClose={() => setAssistantToDelete(null)}
                onConfirm={handleConfirmDelete}
            >
                Tem certeza que deseja excluir o assistente "{assistantToDelete?.name}"? Esta ação
                não pode ser desfeita.
            </ConfirmationModal>

            <PageHeader
                title="Assistentes de IA"
                description="Crie atendentes automáticos ligados a um pipeline, flow ou persona"
            >
                {assistants.length > 1 && (
                    <div className="relative w-full max-w-[220px] hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar assistente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10"
                        />
                    </div>
                )}

                {assistants.length > 1 && (
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as AssistantSortOption)}>
                        <SelectTrigger className="w-[160px] h-10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name">Nome (A-Z)</SelectItem>
                            <SelectItem value="date">Mais recentes</SelectItem>
                        </SelectContent>
                    </Select>
                )}

                <Button onClick={() => navigate("/assistants/new")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Assistente
                </Button>
            </PageHeader>

            <PageContent>
                {loading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map((n) => (
                            <div key={n} className="h-36 rounded-2xl bg-muted animate-pulse" />
                        ))}
                    </div>
                )}

                {!loading && assistants.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                            <Sparkles className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">Nenhum assistente criado</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Crie seu primeiro assistente de IA para começar
                            </p>
                        </div>
                        <Button onClick={() => navigate("/assistants/new")}>
                            <Plus className="mr-2 h-4 w-4" />
                            Criar Assistente
                        </Button>
                    </div>
                )}

                {!loading && assistants.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {sortedAssistants.map((assistant) => (
                            <Card
                                key={assistant.id}
                                className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)] border group relative"
                                onClick={() => handleOpenAssistant(assistant.id)}
                            >
                                <CardContent className="p-4 flex flex-col gap-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-base leading-tight line-clamp-1">
                                                {assistant.name}
                                            </p>
                                            {assistant.description && (
                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                                    {assistant.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 -mt-0.5 -mr-1 text-muted-foreground hover:text-foreground"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <MoreVertical className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    onCloseAutoFocus={(e) => e.preventDefault()}
                                                >
                                                    <DropdownMenuItem
                                                        onClick={() => navigate(`/assistants/${assistant.id}/edit`)}
                                                    >
                                                        <Pencil className="mr-2 h-3.5 w-3.5" />
                                                        Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => handleDuplicate(e, assistant)}>
                                                        <Copy className="mr-2 h-3.5 w-3.5" />
                                                        Duplicar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onClick={(e) => handleRequestDelete(e, assistant)}
                                                    >
                                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                        Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <Badge
                                            variant="outline"
                                            className="border-transparent text-[11px] font-semibold"
                                            style={{
                                                backgroundColor: "hsl(var(--status-info-bg))",
                                                color: "hsl(var(--status-info))",
                                            }}
                                        >
                                            {MODE_LABELS[assistant.mode]}
                                        </Badge>
                                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                            <span
                                                className={
                                                    assistant.active
                                                        ? "text-[11px] text-emerald-600 font-medium"
                                                        : "text-[11px] text-muted-foreground"
                                                }
                                            >
                                                {assistant.active ? "Ativo" : "Inativo"}
                                            </span>
                                            <Switch
                                                checked={assistant.active}
                                                disabled={togglingId === assistant.id}
                                                onCheckedChange={() => handleToggleActive(assistant)}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </PageContent>
        </PageContainer>
    );
};

export default Assistants;
