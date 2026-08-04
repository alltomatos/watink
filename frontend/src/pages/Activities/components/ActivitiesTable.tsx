import React from "react";
import { Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { Can } from "../../../components/Can";
import type { User } from "../../../types/domain";
import { Activity, ACTIVITY_STATUS_LABELS, ACTIVITY_PRIORITY_LABELS } from "../../MyActivities/activityTypes";

interface ActivitiesTableProps {
  activities: Activity[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  user: User | undefined;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
}

const STATUS_CHIP: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  pending: "default",
  in_progress: "info",
  done: "success",
  cancelled: "error",
};

export function ActivitiesTable({ activities, loading, error, onRetry, user, onEdit, onDelete }: ActivitiesTableProps) {
  const columns: DataTableColumn<Activity>[] = [
    {
      key: "status",
      header: "Status",
      cell: (a) => <StatusChip status={STATUS_CHIP[a.status]} label={ACTIVITY_STATUS_LABELS[a.status]} />,
    },
    { key: "title", header: "Título", cell: (a) => <span className="font-medium">{a.title}</span> },
    { key: "priority", header: "Prioridade", cell: (a) => ACTIVITY_PRIORITY_LABELS[a.priority] },
    {
      key: "assignees",
      header: "Responsáveis",
      cell: (a) => (a.assignees && a.assignees.length > 0
        ? a.assignees.map((asg) => asg.user?.name).filter(Boolean).join(", ")
        : <span className="text-muted-foreground">Sem responsável</span>),
    },
    {
      key: "slaDueAt",
      header: "Prazo",
      cell: (a) => (a.slaDueAt
        ? format(new Date(a.slaDueAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
        : <span className="text-muted-foreground">—</span>),
    },
    {
      key: "checklistProgress",
      header: "Checklist",
      cell: (a) => (a.checklistProgress && a.checklistProgress.total > 0
        ? `${a.checklistProgress.done}/${a.checklistProgress.total}`
        : <span className="text-muted-foreground">—</span>),
    },
    {
      key: "actions",
      header: "Ações",
      className: "text-right w-[100px]",
      cell: (activity) => (
        <div className="flex items-center justify-end gap-1">
          <Can
            user={user}
            perform="activities:manage"
            yes={() => (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(activity)}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
          />
          <Can
            user={user}
            perform="activities:delete"
            yes={() => (
              <Button variant="destructive-ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(activity)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={activities}
      getRowKey={(a) => a.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyTitle="Nenhuma atividade encontrada"
      emptyDescription="Crie a primeira atividade para começar."
    />
  );
}
