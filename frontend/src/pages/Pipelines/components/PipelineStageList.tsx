import React, { useRef, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STAGE_COLOR_PALETTE, getColorByKey } from "../pipelineCreatorTypes";
import type { StageFormItem } from "../pipelineCreatorTypes";

interface PipelineStageListProps {
    stages: StageFormItem[];
    onStageChange: (index: number, value: string) => void;
    onStageColorChange: (index: number, colorKey: string) => void;
    onAddStage: () => void;
    onRemoveStage: (index: number) => void;
    onMoveStage: (index: number, direction: "up" | "down") => void;
}

function ColorPicker({
    colorKey,
    onChange,
}: {
    colorKey: string;
    onChange: (key: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const current = getColorByKey(colorKey);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="text-xs font-semibold px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 whitespace-nowrap"
                style={{ color: current.color, backgroundColor: current.bg }}
            >
                {current.label}
            </button>

            {open && (
                <div className="absolute right-0 top-8 z-20 rounded-xl border bg-popover shadow-lg p-2.5 w-40">
                    <p className="text-[11px] text-muted-foreground mb-2 font-medium">Cor da etapa</p>
                    <div className="flex flex-wrap gap-2">
                        {STAGE_COLOR_PALETTE.map((c) => (
                            <button
                                key={c.key}
                                type="button"
                                title={c.label}
                                onClick={() => {
                                    onChange(c.key);
                                    setOpen(false);
                                }}
                                className={cn(
                                    "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                                    c.key === colorKey
                                        ? "border-foreground scale-110"
                                        : "border-transparent"
                                )}
                                style={{ backgroundColor: c.color }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const PipelineStageList: React.FC<PipelineStageListProps> = ({
    stages,
    onStageChange,
    onStageColorChange,
    onAddStage,
    onRemoveStage,
    onMoveStage,
}) => (
    <div>
        <div className="flex items-start justify-between mb-1">
            <div>
                <h3 className="text-sm font-semibold text-foreground">
                    Etapas{" "}
                    <span className="text-muted-foreground font-normal">[{stages.length}]</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Defina o nome e a cor de cada estágio do funil
                </p>
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddStage}
                className="shrink-0 text-xs h-8"
            >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar
            </Button>
        </div>

        <div className="mt-3 flex flex-col gap-2">
            {stages.map((stage, index) => {
                const color = getColorByKey(stage.colorKey);
                const initial = stage.name.trim().charAt(0).toUpperCase() || "?";
                return (
                    <div
                        key={index}
                        className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 transition-shadow hover:shadow-sm"
                    >
                        {/* Drag handle (visual only) */}
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40 cursor-grab" />

                        {/* Move up/down */}
                        <div className="flex flex-col shrink-0 -mx-1">
                            <button
                                type="button"
                                onClick={() => onMoveStage(index, "up")}
                                disabled={index === 0}
                                aria-label={`Mover "${stage.name}" para cima`}
                                className="h-3.5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:pointer-events-none"
                            >
                                <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => onMoveStage(index, "down")}
                                disabled={index === stages.length - 1}
                                aria-label={`Mover "${stage.name}" para baixo`}
                                className="h-3.5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:pointer-events-none"
                            >
                                <ChevronDown className="h-3 w-3" />
                            </button>
                        </div>

                        {/* Number badge */}
                        <span className="text-xs font-semibold text-muted-foreground w-5 shrink-0 text-center">
                            {index + 1}
                        </span>

                        {/* Color avatar */}
                        <span
                            className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ backgroundColor: color.color }}
                        >
                            {initial}
                        </span>

                        {/* Name input */}
                        <input
                            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-foreground placeholder:text-muted-foreground min-w-0"
                            value={stage.name}
                            onChange={(e) => onStageChange(index, e.target.value)}
                            placeholder="Nome da etapa"
                        />

                        {/* Color picker */}
                        <ColorPicker
                            colorKey={stage.colorKey}
                            onChange={(key) => onStageColorChange(index, key)}
                        />

                        {/* Remove */}
                        <button
                            type="button"
                            onClick={() => onRemoveStage(index)}
                            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                );
            })}

            {stages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                    <p>Nenhuma etapa adicionada</p>
                    <button
                        type="button"
                        onClick={onAddStage}
                        className="mt-2 text-primary text-xs underline"
                    >
                        Adicionar primeira etapa
                    </button>
                </div>
            )}
        </div>
    </div>
);

export default PipelineStageList;
