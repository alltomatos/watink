import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { DropResult } from "@hello-pangea/dnd";
import { ArrowLeft, FileDown, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api from "../../services/api";
import { toast } from "react-toastify";
import PipelineKanban from "./PipelineKanban";
import PipelineFunnelView from "./PipelineFunnelView";

interface Contact {
    name?: string;
}

interface Deal {
    id: number;
    title: string;
    stageId: number;
    contact?: Contact;
    value?: number | string;
    updatedAt?: string;
    createdAt: string;
}

interface Stage {
    id: number;
    name: string;
}

interface ColumnData {
    items: Deal[];
}

interface Pipeline {
    id: number;
    name: string;
    type: "kanban" | "funnel" | "funil";
    stages: Stage[];
}

const PipelineBoard: React.FC = () => {
    const { pipelineId } = useParams<{ pipelineId: string }>();
    const navigate = useNavigate();
    const [pipeline, setPipeline] = useState<Pipeline | null>(null);
    const [columns, setColumns] = useState<Record<string | number, ColumnData>>({});
    const [loading, setLoading] = useState(true);
    const [deals, setDeals] = useState<Deal[]>([]);

    useEffect(() => {
        fetchPipelineData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pipelineId]);

    const fetchPipelineData = async () => {
        try {
            setLoading(true);
            const { data } = await api.get(`/pipelines`);
            const selected = data.find((p: Pipeline) => p.id === Number(pipelineId));

            if (selected) {
                setPipeline(selected);

                const { data: dealData } = await api.get(`/deals`, {
                    params: { pipelineId },
                });

                setDeals(dealData.deals);

                const stageMap: Record<string | number, ColumnData> = {};
                selected.stages.forEach((stage: Stage) => {
                    stageMap[stage.id] = {
                        ...stage,
                        items: dealData.deals.filter((d: Deal) => d.stageId === stage.id),
                    };
                });
                setColumns(stageMap);
            }
            setLoading(false);
        } catch {
            toast.error("Erro ao carregar pipeline");
            setLoading(false);
        }
    };

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;

        if (source.droppableId !== destination.droppableId) {
            const sourceCol = columns[source.droppableId];
            const destCol = columns[destination.droppableId];
            const sourceItems = [...sourceCol.items];
            const destItems = [...destCol.items];
            const [removed] = sourceItems.splice(source.index, 1);
            removed.stageId = Number(destination.droppableId);
            destItems.splice(destination.index, 0, removed);

            setColumns({
                ...columns,
                [source.droppableId]: { ...sourceCol, items: sourceItems },
                [destination.droppableId]: { ...destCol, items: destItems },
            });
            setDeals((prev) => prev.map((d) => (d.id === removed.id ? removed : d)));

            try {
                await api.put(`/deals/${draggableId}`, {
                    stageId: Number(destination.droppableId),
                    pipelineId: Number(pipelineId),
                });
            } catch {
                toast.error("Erro ao mover card");
                fetchPipelineData();
            }
        }
    };

    const exportPipeline = async () => {
        try {
            const { data } = await api.get(`/pipelines/export/${pipelineId}`);
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const href = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = href;
            link.download = `${data.name.replace(/\s+/g, "_")}_pipeline.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch {
            toast.error("Erro ao exportar");
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!pipeline) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <p className="text-muted-foreground">Pipeline não encontrado</p>
                <Button variant="outline" onClick={() => navigate("/pipelines")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>
            </div>
        );
    }

    const isEnterprise = pipeline.type === "funnel" || pipeline.type === "funil";

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* ── Board header ── */}
            <div className="px-4 py-3 border-b bg-card flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => navigate("/pipelines")}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold">{pipeline.name}</h2>
                        <Badge
                            variant="outline"
                            className="border-transparent text-[11px] font-semibold shrink-0"
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
                            {pipeline.type === "kanban" ? "Kanban" : "Funil"}
                        </Badge>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/pipelines/${pipelineId}/edit`)}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportPipeline}>
                        <FileDown className="mr-1.5 h-3.5 w-3.5" />
                        Exportar
                    </Button>
                </div>
            </div>

            {/* ── Board content ── */}
            <div className="flex-1 overflow-hidden">
                {isEnterprise ? (
                    <PipelineFunnelView
                        pipeline={pipeline}
                        columns={columns}
                        setColumns={setColumns}
                        onDragEnd={handleDragEnd}
                        deals={deals}
                    />
                ) : (
                    <PipelineKanban
                        pipeline={pipeline}
                        columns={columns}
                        setColumns={
                            setColumns as unknown as React.ComponentProps<
                                typeof PipelineKanban
                            >["setColumns"]
                        }
                        onDragEnd={handleDragEnd}
                    />
                )}
            </div>
        </div>
    );
};

export default PipelineBoard;
