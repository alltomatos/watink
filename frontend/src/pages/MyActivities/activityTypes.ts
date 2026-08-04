// Tipos pinados ao DTO real do backend (activity_execution.go/activity_kpi.go
// no pacote controllers) — unificados numa única fonte depois de existirem
// duas interfaces `Activity` divergentes (aqui e em `index.tsx`). Ids são
// `number`, como o backend serializa (PK int) — nunca `string`.

export interface ChecklistItem {
  id: number;
  activityId: number;
  label: string;
  isRequired: boolean;
  isDone: boolean;
  inputType: "text" | "number" | "photo";
  value?: string;
  position: number;
}

export interface Material {
  id: number;
  activityId: number;
  materialName: string;
  quantity: number;
  unit: string;
  isBillable: boolean;
  notes?: string;
}

export interface Occurrence {
  id: number;
  activityId: number;
  description: string;
  type: "info" | "impediment" | "delay";
  timeImpact?: number;
}

export interface ActivityAssignee {
  id: number;
  activityId: number;
  userId: number;
  user?: { id: number; name: string; email: string };
}

export interface ActivityProtocolClient {
  name: string;
}

export interface ActivityProtocol {
  id: number;
  subject: string;
  client?: ActivityProtocolClient;
}

export interface ChecklistProgress {
  done: number;
  total: number;
}

export type ActivityStatus = "pending" | "in_progress" | "done" | "cancelled";
export type ActivityPriority = "low" | "medium" | "high" | "urgent";
export type ActivitySlaStatus = "onTime" | "atRisk" | "overdue" | "";

export interface Activity {
  id: number;
  title: string;
  description?: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  protocolId?: number | null;
  dealId?: number | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastActivityAt: string;
  slaDueAt?: string | null;
  clientSignatureUrl?: string;
  technicianSignatureUrl?: string;
  createdAt: string;
  updatedAt: string;

  // Campos computados no backend (GET /my-activities, GET /activities) —
  // nunca recalculados no frontend (activities.md §Alertas).
  slaStatus?: ActivitySlaStatus;
  staleSince?: string | null;
  checklistProgress?: ChecklistProgress;

  // Relations — presentes no detalhe (GET /activities/:id), ausentes na
  // listagem (exceto assignees, que List/MyActivities já trazem).
  protocol?: ActivityProtocol;
  assignees?: ActivityAssignee[];
  items?: ChecklistItem[];
  materials?: Material[];
  occurrences?: Occurrence[];
}

export interface NewOccurrence {
  description: string;
  type: "info" | "impediment" | "delay";
  timeImpact: string;
}

export const OCCURRENCE_TYPE_LABELS: Record<string, string> = {
  info: "Informativo",
  impediment: "Impedimento",
  delay: "Atraso",
};

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  pending: "Pendente",
  in_progress: "Em Progresso",
  done: "Concluído",
  cancelled: "Cancelado",
};

export const ACTIVITY_PRIORITY_LABELS: Record<ActivityPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};
