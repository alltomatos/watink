import React from "react";
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
    DroppableProvided,
    DroppableStateSnapshot,
    DraggableProvided,
    DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getContactDisplayName } from "@/utils/clientDisplayName";

interface Contact {
    name?: string;
    client?: { socialName?: string | null } | null;
}

interface Deal {
    id: number;
    title: string;
    contact?: Contact;
    value?: number | string;
    updatedAt?: string;
    stageId?: number;
}

interface Stage {
    id: number;
    name: string;
}

interface ColumnData {
    items: Deal[];
}

interface Pipeline {
    stages: Stage[];
}

interface PipelineKanbanProps {
    pipeline?: Pipeline;
    columns: Record<string | number, ColumnData>;
    setColumns: React.Dispatch<React.SetStateAction<Record<string | number, ColumnData>>>;
    onDragEnd: (result: DropResult) => void;
    isEnterprise?: boolean;
    onNewDeal?: (stageId: number) => void;
}

// Paired: solid header color + light bg — using hsl() wrapper so HSL channel tokens resolve correctly
const COLUMN_PALETTE = [
    { header: "hsl(var(--status-info))",        bg: "hsl(var(--status-info-bg))" },
    { header: "hsl(var(--status-warning))",     bg: "hsl(var(--status-warning-bg))" },
    { header: "hsl(var(--status-success))",     bg: "hsl(var(--status-success-bg))" },
    { header: "hsl(var(--status-error))",       bg: "hsl(var(--status-error-bg))" },
    { header: "hsl(var(--status-default-text))", bg: "hsl(var(--status-default-bg))" },
];

const getColumnColor = (index: number) => COLUMN_PALETTE[index % COLUMN_PALETTE.length];

const fmt = (value: number | string | undefined) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
        parseFloat(String(value ?? 0)) || 0
    );

const calcTotal = (items: Deal[]) =>
    items.reduce((acc, d) => acc + (parseFloat(String(d.value)) || 0), 0);

const PipelineKanban: React.FC<PipelineKanbanProps> = ({
    pipeline,
    columns,
    onDragEnd,
    onNewDeal,
}) => (
    <div className="flex h-full overflow-x-auto p-4 gap-3">
        <DragDropContext onDragEnd={onDragEnd}>
            {pipeline?.stages.map((stage, stageIndex) => {
                const col = columns[stage.id];
                if (!col) return null;
                const palette = getColumnColor(stageIndex);
                const total = calcTotal(col.items);

                return (
                    <div
                        key={stage.id}
                        className="flex flex-col w-[280px] shrink-0 rounded-2xl overflow-hidden shadow-[0px_2px_12px_rgba(0,0,0,0.08)]"
                        style={{ backgroundColor: palette.bg }}
                    >
                        {/* ── Column header ── */}
                        <div
                            className="px-4 py-3 flex items-center justify-between"
                            style={{ backgroundColor: palette.header }}
                        >
                            <span className="text-sm font-semibold text-white truncate">{stage.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                                {total > 0 && (
                                    <span className="text-[11px] text-white/80 font-medium">
                                        {fmt(total)}
                                    </span>
                                )}
                                <span className="h-5 min-w-[1.25rem] rounded-full bg-white/20 text-white text-[11px] font-bold flex items-center justify-center px-1.5">
                                    {col.items.length}
                                </span>
                            </div>
                        </div>

                        {/* ── Cards area ── */}
                        <Droppable droppableId={String(stage.id)}>
                            {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-[120px] transition-colors"
                                    style={{
                                        backgroundColor: snapshot.isDraggingOver
                                            ? `color-mix(in srgb, ${palette.header} 12%, transparent)`
                                            : undefined,
                                    }}
                                >
                                    {col.items.map((deal, index) => (
                                        <Draggable
                                            key={deal.id}
                                            draggableId={String(deal.id)}
                                            index={index}
                                        >
                                            {(prov: DraggableProvided, snap: DraggableStateSnapshot) => (
                                                <div
                                                    ref={prov.innerRef}
                                                    {...prov.draggableProps}
                                                    {...prov.dragHandleProps}
                                                    style={prov.draggableProps.style as React.CSSProperties}
                                                    className={cn(
                                                        "rounded-xl bg-white px-3 py-2.5 shadow-sm transition-all cursor-grab active:cursor-grabbing",
                                                        "border border-transparent",
                                                        snap.isDragging
                                                            ? "shadow-lg rotate-[1deg] border-primary/20"
                                                            : "hover:-translate-y-0.5 hover:shadow-md"
                                                    )}
                                                >
                                                    {/* Deal title */}
                                                    <p className="text-sm font-semibold text-foreground leading-tight">
                                                        {deal.title}
                                                    </p>

                                                    {/* Contact & value row */}
                                                    <div className="flex items-center justify-between mt-1.5">
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <User className="h-3 w-3 shrink-0" />
                                                            <span className="truncate max-w-[120px]">
                                                                {getContactDisplayName(deal.contact) || "Sem contato"}
                                                            </span>
                                                        </div>
                                                        {deal.value && parseFloat(String(deal.value)) > 0 && (
                                                            <span
                                                                className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
                                                                style={{
                                                                    backgroundColor: palette.bg,
                                                                    color: palette.header,
                                                                }}
                                                            >
                                                                {fmt(deal.value)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>

                        {/* ── Add deal button ── */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="m-2 mt-0 text-xs rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/70"
                            onClick={() => onNewDeal?.(stage.id)}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Novo Deal
                        </Button>
                    </div>
                );
            })}
        </DragDropContext>
    </div>
);

export default PipelineKanban;
