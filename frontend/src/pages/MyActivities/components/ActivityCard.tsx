import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Clock, ListChecks, MessageSquareWarning } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import notify from "@/lib/notify";
import api from "../../../services/api";
import { Activity, ACTIVITY_STATUS_LABELS, ACTIVITY_PRIORITY_LABELS, NewOccurrence } from "../activityTypes";
import { timeToMinutes } from "../activityHelpers";
import OccurrenceModal from "./OccurrenceModal";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  in_progress: "secondary",
  done: "default",
  cancelled: "destructive",
};

const DEFAULT_OCCURRENCE: NewOccurrence = { description: "", type: "info", timeImpact: "" };

interface ActivityCardProps {
  activity: Activity;
  onExecute: (activity: Activity) => void;
  onOccurrenceRegistered: () => void;
}

// Card da listagem — badge de status, badge de SLA/parada, progresso do
// checklist, prazo, atalho "Registrar ocorrência" sem entrar na execução
// (docs/agents/activities.md §Melhorias de UX).
const ActivityCard: React.FC<ActivityCardProps> = ({ activity, onExecute, onOccurrenceRegistered }) => {
  const [occurrenceModalOpen, setOccurrenceModalOpen] = useState(false);
  const [newOccurrence, setNewOccurrence] = useState<NewOccurrence>(DEFAULT_OCCURRENCE);

  const handleQuickOccurrence = async () => {
    if (!newOccurrence.description.trim()) return;
    try {
      await api.post(`/activities/${activity.id}/occurrences`, {
        description: newOccurrence.description.trim(),
        type: newOccurrence.type,
        timeImpact: timeToMinutes(newOccurrence.timeImpact),
      });
      notify.success("Ocorrência registrada");
      setOccurrenceModalOpen(false);
      setNewOccurrence(DEFAULT_OCCURRENCE);
      onOccurrenceRegistered();
    } catch (err) {
      notify.error(err);
    }
  };

  const progress = activity.checklistProgress;
  const slaChip = activity.slaStatus === "overdue"
    ? { label: `Atrasada${activity.slaDueAt ? " há " + formatDistanceToNow(new Date(activity.slaDueAt), { locale: ptBR }) : ""}`, status: "error" as const }
    : activity.slaStatus === "atRisk"
      ? { label: `Vence em ${activity.slaDueAt ? formatDistanceToNow(new Date(activity.slaDueAt), { locale: ptBR }) : ""}`, status: "warning" as const }
      : null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <Badge variant={STATUS_VARIANT[activity.status] ?? "outline"}>
            {ACTIVITY_STATUS_LABELS[activity.status]}
          </Badge>
          <Badge variant="outline">{ACTIVITY_PRIORITY_LABELS[activity.priority]}</Badge>
          <span className="text-xs text-muted-foreground ml-auto">#{activity.id}</span>
        </div>
        <CardTitle className="text-base leading-snug">{activity.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {activity.description || "Sem descrição"}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {activity.staleSince && (
            <StatusChip
              status="warning"
              size="sm"
              label={`Parada há ${formatDistanceToNow(new Date(activity.staleSince), { locale: ptBR })}`}
            />
          )}
          {slaChip && <StatusChip status={slaChip.status} size="sm" label={slaChip.label} />}
        </div>

        {progress && progress.total > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" />
            {progress.done}/{progress.total} itens
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {formatDistanceToNow(new Date(activity.createdAt), { locale: ptBR, addSuffix: true })}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOccurrenceModalOpen(true)}
            title="Registrar ocorrência"
          >
            <MessageSquareWarning className="h-4 w-4" />
          </Button>
          <Button size="sm" className="flex-1" onClick={() => onExecute(activity)}>
            Executar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>

      <OccurrenceModal
        open={occurrenceModalOpen}
        newOccurrence={newOccurrence}
        onChange={setNewOccurrence}
        onConfirm={handleQuickOccurrence}
        onCancel={() => setOccurrenceModalOpen(false)}
      />
    </Card>
  );
};

export default ActivityCard;
