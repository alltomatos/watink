import React, { useState } from "react";
import { Tags as TagsIcon, Kanban } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "../../services/api";
import TicketTagsSection from "../../pages/Tickets/components/TicketTagsSection";

interface Stage {
  id: number;
  name: string;
}

interface Pipeline {
  id: number;
  name: string;
  stages: Stage[];
}

interface Deal {
  id: number;
  stageId: number;
}

interface TicketQuickShortcutsProps {
  ticketId: number;
}

/**
 * Quick-access shortcuts (Add Tag / move Pipeline stage) directly from the
 * ticket header, without navigating to the Dados sidebar tab. Reuses the
 * existing tag-management UI as-is; the pipeline mover is a compact stage
 * picker scoped to whichever single Deal is linked to this ticket.
 */
const TicketQuickShortcuts: React.FC<TicketQuickShortcutsProps> = ({ ticketId }) => {
  const [tagsOpen, setTagsOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);

  const loadPipelineData = async () => {
    setLoadingPipeline(true);
    try {
      const { data: dealsData } = await api.get<{ deals: Deal[] } | Deal[]>("/deals", {
        params: { ticketId },
      });
      const deals = Array.isArray(dealsData) ? dealsData : dealsData.deals;
      const linkedDeal = deals?.[0] ?? null;
      setDeal(linkedDeal);

      if (linkedDeal) {
        const { data: pipelines } = await api.get<Pipeline[]>("/pipelines");
        const owning = pipelines.find((p) =>
          p.stages.some((s) => s.id === linkedDeal.stageId)
        );
        setPipeline(owning ?? null);
      } else {
        setPipeline(null);
      }
    } catch {
      setDeal(null);
      setPipeline(null);
    } finally {
      setLoadingPipeline(false);
    }
  };

  const handleOpenPipeline = (isOpen: boolean) => {
    setPipelineOpen(isOpen);
    if (isOpen) loadPipelineData();
  };

  const handleMoveStage = async (stageId: string) => {
    if (!deal) return;
    try {
      await api.put(`/deals/${deal.id}`, { stageId: Number(stageId) });
      setDeal({ ...deal, stageId: Number(stageId) });
      toast.success("Negócio movido de etapa com sucesso!");
    } catch {
      toast.error("Erro ao mover o negócio de etapa.");
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Adicionar tag rapidamente">
            <TagsIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end">
          <TicketTagsSection ticketId={ticketId} />
        </PopoverContent>
      </Popover>

      <Popover open={pipelineOpen} onOpenChange={handleOpenPipeline}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mover no pipeline">
            <Kanban className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          {loadingPipeline && (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          )}
          {!loadingPipeline && !deal && (
            <p className="text-xs text-muted-foreground">
              Nenhum negócio vinculado a este ticket.
            </p>
          )}
          {!loadingPipeline && deal && !pipeline && (
            <p className="text-xs text-muted-foreground">
              Não foi possível carregar o pipeline deste negócio.
            </p>
          )}
          {!loadingPipeline && deal && pipeline && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pipeline.name}
              </p>
              <Select value={String(deal.stageId)} onValueChange={handleMoveStage}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pipeline.stages.map((stage) => (
                    <SelectItem key={stage.id} value={String(stage.id)}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default TicketQuickShortcuts;
