import React from "react";
import { useNavigate } from "react-router";
import { Maximize, RefreshCw, ArrowLeft, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface KanbanHeaderProps {
  tvMode: boolean;
  onRefresh: () => Promise<void>;
  onTvMode: () => void;
}

const KanbanHeader: React.FC<KanbanHeaderProps> = ({
  tvMode,
  onRefresh,
  onTvMode,
}) => {
  const navigate = useNavigate();

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg bg-[var(--bg-surface)] p-3 shadow-sm">
      <div className="flex items-center gap-2">
        {!tvMode && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/helpdesk")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Ticket className="h-5 w-5 text-muted-foreground" />
          Helpdesk Kanban
        </h1>
      </div>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onRefresh}>
              <RefreshCw className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Atualizar</TooltipContent>
        </Tooltip>

        {!tvMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onTvMode}>
                <Maximize className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Modo TV (Tela Cheia)</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default KanbanHeader;
