import React from "react";
import { ArrowLeft, Eye, Layers, Lightbulb, Loader2, Pencil } from "lucide-react";
import MainContainer from "@/components/MainContainer";
import MainHeader from "@/components/MainHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { usePipelineCreator } from "./hooks/usePipelineCreator";
import PipelineFormFields from "./components/PipelineFormFields";
import PipelineStageList from "./components/PipelineStageList";
import PipelinePreview from "./components/PipelinePreview";
import PipelineAIChat from "./components/PipelineAIChat";

function SectionHeader({
    icon,
    title,
    subtitle,
    iconColor = "hsl(var(--status-info))",
    iconBg = "hsl(var(--status-info-bg))",
}: {
    icon: React.ReactNode;
    title: React.ReactNode;
    subtitle: string;
    iconColor?: string;
    iconBg?: string;
}) {
    return (
        <div className="flex items-start gap-3 mb-5">
            <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: iconBg, color: iconColor }}
            >
                {icon}
            </div>
            <div>
                <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
        </div>
    );
}

const PipelineCreator: React.FC = () => {
    const {
        pipelineId,
        data,
        setData,
        loading,
        aiEnabled,
        messages,
        input,
        setInput,
        aiLoading,
        messagesEndRef,
        handleSave,
        handleStageChange,
        handleStageColorChange,
        handleAddStage,
        handleRemoveStage,
        handleMoveStage,
        handleSendMessage,
        handleKeyDown,
        navigate,
        pendingSave,
        setPendingSave,
        removedStages,
    } = usePipelineCreator();

    return (
        <>
            {/* Confirmation dialog for removed stages */}
            <Dialog open={pendingSave} onOpenChange={setPendingSave}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar alteração de etapas</DialogTitle>
                        <DialogDescription>
                            As seguintes etapas serão removidas:{" "}
                            <strong>{removedStages.join(", ")}</strong>. Os deals nessas etapas
                            serão movidos automaticamente para a primeira etapa disponível.
                            Deseja continuar?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingSave(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave}>Confirmar e Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <MainContainer>
                <MainHeader>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate("/pipelines")}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-base font-semibold leading-tight">
                                {pipelineId ? "Editar Pipeline" : "Novo Pipeline"}
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Configure as etapas do seu funil de vendas e a cor de cada estágio
                            </p>
                        </div>
                    </div>
                </MainHeader>

                <div className="flex flex-1 overflow-hidden gap-4 p-4">
                    {/* Main form card */}
                    <Card className="flex-[2] overflow-y-auto p-6 flex flex-col gap-0 rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)]">
                        {/* ── Section 1: Definições ── */}
                        <section>
                            <SectionHeader
                                icon={<Pencil className="h-4 w-4" />}
                                title="Definições"
                                subtitle="Identifique o pipeline e como ele será exibido"
                            />
                            <PipelineFormFields data={data} onChange={setData} />
                        </section>

                        <div className="my-6 border-t border-border" />

                        {/* ── Section 2: Etapas ── */}
                        <section>
                            <SectionHeader
                                icon={<Layers className="h-4 w-4" />}
                                title="Etapas"
                                subtitle="Defina o nome e a cor de cada estágio do funil"
                                iconColor="hsl(var(--status-info))"
                                iconBg="hsl(var(--status-info-bg))"
                            />
                            <PipelineStageList
                                stages={data.stages}
                                onStageChange={handleStageChange}
                                onStageColorChange={handleStageColorChange}
                                onAddStage={handleAddStage}
                                onRemoveStage={handleRemoveStage}
                                onMoveStage={handleMoveStage}
                            />
                        </section>

                        <div className="my-6 border-t border-border" />

                        {/* ── Section 3: Prévia do funil ── */}
                        <section>
                            <SectionHeader
                                icon={<Eye className="h-4 w-4" />}
                                title="Prévia do funil"
                                subtitle="Veja como suas etapas aparecerão para a equipe"
                                iconColor="hsl(var(--status-success))"
                                iconBg="hsl(var(--status-success-bg))"
                            />

                            {/* Info banner */}
                            <div
                                className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-4 text-xs"
                                style={{
                                    backgroundColor: "hsl(var(--status-warning-bg))",
                                    color: "hsl(var(--status-warning))",
                                }}
                            >
                                <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                                <span className="font-medium">
                                    Atualiza em tempo real conforme você edita as etapas acima
                                </span>
                            </div>

                            <PipelinePreview stages={data.stages} />
                        </section>

                        {/* ── Footer actions ── */}
                        <div className="mt-8 pt-4 border-t border-border flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => navigate("/pipelines")}
                                className="min-w-[100px]"
                            >
                                Cancelar
                            </Button>
                            <Button
                                disabled={loading || !data.name.trim()}
                                onClick={handleSave}
                                className="min-w-[140px]"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    "Salvar Pipeline"
                                )}
                            </Button>
                        </div>
                    </Card>

                    {/* AI sidebar — conditional */}
                    {aiEnabled && (
                        <PipelineAIChat
                            messages={messages}
                            input={input}
                            aiLoading={aiLoading}
                            messagesEndRef={messagesEndRef}
                            onInputChange={setInput}
                            onSend={handleSendMessage}
                            onKeyDown={handleKeyDown}
                        />
                    )}
                </div>
            </MainContainer>
        </>
    );
};

export default PipelineCreator;
