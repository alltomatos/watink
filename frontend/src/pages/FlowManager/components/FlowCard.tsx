import React from "react";
import { useNavigate } from "react-router";
import { Edit, Trash2, Play, GitFork, Calendar } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Switch } from "../../../components/ui/switch";
import { Flow } from "../flowManagerTypes";

interface FlowCardProps {
  flow: Flow;
  onEdit: (flow: Flow) => void;
  onDelete: (flow: Flow) => void;
  onToggleActive: (flow: Flow, active: boolean) => void;
}

const FlowCard: React.FC<FlowCardProps> = ({
  flow,
  onEdit,
  onDelete,
  onToggleActive,
}) => {
  const navigate = useNavigate();

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <GitFork size={20} />
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={flow.isActive ? "default" : "outline"}
              className="text-[10px] uppercase"
            >
              {flow.isActive ? "Ativo" : "Inativo"}
            </Badge>
            <Switch
              checked={flow.isActive}
              onCheckedChange={(checked) => onToggleActive(flow, checked)}
              aria-label={flow.isActive ? "Desativar fluxo" : "Ativar fluxo"}
            />
          </div>
        </div>
        <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors truncate">
          {flow.name}
        </CardTitle>
        <CardDescription className="flex items-center gap-1 mt-1">
          <Calendar size={12} />
          Atualizado em {new Date(flow.updatedAt).toLocaleDateString()}
        </CardDescription>
        {flow.whatsapp && (
          <CardDescription className="mt-1 text-xs">
            Conexão: <strong>{flow.whatsapp.name}</strong>
          </CardDescription>
        )}
      </CardHeader>
      <CardFooter className="mt-auto pt-4 border-t border-border/50 flex justify-between gap-2">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(flow);
            }}
          >
            <Trash2 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(flow);
            }}
          >
            <Edit size={16} />
          </Button>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => navigate(`/flowbuilder/${flow.id}`)}
        >
          <Play size={14} fill="currentColor" />
          Abrir Editor
        </Button>
      </CardFooter>
    </Card>
  );
};

export default FlowCard;
