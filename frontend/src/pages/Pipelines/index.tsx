import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { Copy, FileDown, Layers, MoreVertical, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import api from "../../services/api";
import { useLocalStorage } from "../../hooks/useLocalStorage";

const STAGE_COLORS = [
    "hsl(var(--status-info))",
    "hsl(var(--status-warning))",
    "hsl(var(--status-success))",
    "hsl(var(--status-error))",
    "hsl(var(--status-default-text))",
];

interface PipelineStage {
    id: number;
    name: string;
}

interface Pipeline {
    id: number;
    name: string;
    description: string;
    type: "kanban" | "funnel" | "funil";
    stages: PipelineStage[];
    createdAt?: string;
    dealsCount?: number;
    dealsValue?: number;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

type PipelineSortOption = "name" | "date";

const Pipelines: React.FC = () => {
    const navigate = useNavigate();
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [loading, setLoading] = useState(true);
    const [pipelineToDelete, setPipelineToDelete] = useState<Pipeline | null>(null);
    const [sortBy, setSortBy] = useLocalStorage<PipelineSortOption>("pipelinesSortBy", "name");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchPipelines();
    }, []);

    const fetchPipelines = async () => {
        try {
            const { data } = await api.get("/pipelines");
            setPipelines(Array.isArray(data) ? data : []);
        } catch {
            toast.error("Erro ao carregar pipelines");
        }
        setLoading(false);
    };

    const handleOpenPipeline = (id: number) => navigate(`/pipelines/${id}`);
    const handleEditPipeline = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        navigate(`/pipelines/${id}/edit`);
    };

    const handleRequestDeletePipeline = (e: React.MouseEvent, pipeline: Pipeline) => {
        e.stopPropagation();
        // Adia a abertura do Dialog para o próximo tick -- abrir um Dialog
        // (ConfirmationModal) no mesmo tick em que o DropdownMenu ainda está
        // fechando faz os FocusScopes dos dois se disputarem o foco. Deixar o
        // dropdown terminar de fechar primeiro evita esse conflito.
        setTimeout(() => setPipelineToDelete(pipeline), 0);
    };

    const handleConfirmDeletePipeline = async () => {
        if (!pipelineToDelete) return;
        try {
            await api.delete(`/pipelines/${pipelineToDelete.id}`);
            toast.success("Pipeline excluído com sucesso!");
            fetchPipelines();
        } catch {
            toast.error("Erro ao excluir pipeline");
        } finally {
            setPipelineToDelete(null);
        }
    };

    const handleDuplicatePipeline = async (e: React.MouseEvent, pipeline: Pipeline) => {
        e.stopPropagation();
        try {
            await api.post("/pipelines", {
                name: `${pipeline.name} (cópia)`,
                description: pipeline.description,
                type: pipeline.type,
                stages: pipeline.stages.map((s) => ({ name: s.name })),
            });
            toast.success("Pipeline duplicado com sucesso!");
            fetchPipelines();
        } catch {
            toast.error("Erro ao duplicar pipeline");
        }
    };

    const handleExportPipeline = async (e: React.MouseEvent, pipeline: Pipeline) => {
        e.stopPropagation();
        try {
            const { data } = await api.get(`/pipelines/export/${pipeline.id}`);
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const href = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = href;
            link.download = `${pipeline.name.replace(/\s+/g, "_")}_pipeline.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(href);
        } catch {
            toast.error("Erro ao exportar pipeline");
        }
    };

    const sortedPipelines = [...pipelines]
        .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === "date") {
                return (
                    new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
                );
            }
            return a.name.localeCompare(b.name);
        });

    const handleImportPipeline = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                if (!ev.target?.result) throw new Error("File empty");
                const json = JSON.parse(ev.target.result as string);
                await api.post("/pipelines/import", json);
                toast.success("Pipeline importado com sucesso!");
                fetchPipelines();
            } catch (err) {
                const message = err instanceof Error ? err.message : "Erro desconhecido";
                toast.error("Erro ao importar pipeline: " + message);
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    return (
        <PageContainer>
            <ConfirmationModal
                title="Excluir pipeline"
                open={!!pipelineToDelete}
                onClose={() => setPipelineToDelete(null)}
                onConfirm={handleConfirmDeletePipeline}
            >
                Tem certeza que deseja excluir o pipeline "{pipelineToDelete?.name}"? Todas as
                etapas e negócios vinculados a ele serão excluídos permanentemente. Esta ação não
                pode ser desfeita.
            </ConfirmationModal>

            <PageHeader
                title="Pipelines"
                description="Gerencie seus fluxos de atendimento e funis de vendas"
            >
                {pipelines.length > 1 && (
                    <div className="relative w-full max-w-[220px] hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar pipeline..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10"
                        />
                    </div>
                )}

                {pipelines.length > 1 && (
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as PipelineSortOption)}>
                        <SelectTrigger className="w-[160px] h-10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name">Nome (A-Z)</SelectItem>
                            <SelectItem value="date">Mais recentes</SelectItem>
                        </SelectContent>
                    </Select>
                )}

                <input
                    style={{ display: "none" }}
                    id="import-pipeline"
                    type="file"
                    accept=".json"
                    onChange={handleImportPipeline}
                />
                <label htmlFor="import-pipeline">
                    <Button variant="ghost" className="cursor-pointer" asChild>
                        <span>
                            <Upload className="mr-2 h-4 w-4" />
                            Importar Pipeline
                        </span>
                    </Button>
                </label>
                <Button onClick={() => navigate("/pipelines/new")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Pipeline
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

                {!loading && pipelines.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                            <Layers className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">Nenhum pipeline criado</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Crie seu primeiro funil de vendas para começar
                            </p>
                        </div>
                        <Button onClick={() => navigate("/pipelines/new")}>
                            <Plus className="mr-2 h-4 w-4" />
                            Criar Pipeline
                        </Button>
                    </div>
                )}

                {!loading && pipelines.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {sortedPipelines.map((pipeline) => (
                            <Card
                                key={pipeline.id}
                                className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)] border group relative"
                                onClick={() => handleOpenPipeline(pipeline.id)}
                            >
                                <CardContent className="p-4 flex flex-col gap-3">
                                    {/* Title + edit */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-base leading-tight line-clamp-1">
                                                {pipeline.name}
                                            </p>
                                            {pipeline.description && (
                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                                    {pipeline.description}
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
                                                    <DropdownMenuItem onClick={(e) => handleEditPipeline(e, pipeline.id)}>
                                                        <Pencil className="mr-2 h-3.5 w-3.5" />
                                                        Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => handleDuplicatePipeline(e, pipeline)}>
                                                        <Copy className="mr-2 h-3.5 w-3.5" />
                                                        Duplicar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => handleExportPipeline(e, pipeline)}>
                                                        <FileDown className="mr-2 h-3.5 w-3.5" />
                                                        Exportar JSON
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onClick={(e) => handleRequestDeletePipeline(e, pipeline)}
                                                    >
                                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                        Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>

                                    {/* Stage color dots */}
                                    {pipeline.stages?.length > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            {pipeline.stages.slice(0, 6).map((stage, i) => (
                                                <span
                                                    key={stage.id}
                                                    title={stage.name}
                                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                                    style={{
                                                        backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length],
                                                    }}
                                                />
                                            ))}
                                            {pipeline.stages.length > 6 && (
                                                <span className="text-[11px] text-muted-foreground">
                                                    +{pipeline.stages.length - 6}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Footer: type badge + stage count */}
                                    <div className="flex items-center justify-between">
                                        <Badge
                                            variant="outline"
                                            className={
                                                pipeline.type === "kanban"
                                                    ? "border-transparent text-[11px] font-semibold"
                                                    : "border-transparent text-[11px] font-semibold"
                                            }
                                            style={
                                                pipeline.type === "kanban"
                                                    ? {
                                                          backgroundColor: "hsl(var(--status-info-bg))",
                                                          color: "hsl(var(--status-info))",
                                                      }
                                                    : {
                                                          backgroundColor: "hsl(var(--status-warning-bg))",
                                                          color: "hsl(var(--status-warning))",
                                                      }
                                            }
                                        >
                                            {pipeline.type === "kanban" ? "Kanban" : "Funil de Vendas"}
                                        </Badge>
                                        {pipeline.stages?.length > 0 && (
                                            <span className="text-[11px] text-muted-foreground">
                                                {pipeline.stages.length} etapa
                                                {pipeline.stages.length !== 1 ? "s" : ""}
                                            </span>
                                        )}
                                    </div>

                                    {/* Quick metrics: deal count + total value */}
                                    {!!pipeline.dealsCount && (
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2 -mb-1">
                                            <span>
                                                {pipeline.dealsCount} negócio
                                                {pipeline.dealsCount !== 1 ? "s" : ""}
                                            </span>
                                            {!!pipeline.dealsValue && (
                                                <span className="font-semibold">
                                                    {formatCurrency(pipeline.dealsValue)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </PageContent>
        </PageContainer>
    );
};

export default Pipelines;
