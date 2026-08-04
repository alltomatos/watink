import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import notify from "@/lib/notify";
import api from "../../../services/api";
import { Activity, ActivityPriority, ACTIVITY_PRIORITY_LABELS } from "../../MyActivities/activityTypes";
import ActivityAssigneesPanel from "./ActivityAssigneesPanel";
import ActivityChecklistBuilder, { ChecklistDraftItem } from "./ActivityChecklistBuilder";

interface ActivityFormDialogProps {
  open: boolean;
  activity: Activity | null;
  onClose: () => void;
}

interface FormState {
  title: string;
  description: string;
  priority: ActivityPriority;
  scheduledAt: string;
}

const DEFAULT_FORM: FormState = { title: "", description: "", priority: "medium", scheduledAt: "" };

// ActivityFormDialog — dados básicos + atribuição N:N + montador de
// checklist. O checklist só é editável na CRIAÇÃO: o backend hoje não expõe
// rota para adicionar/remover item de uma Activity já existente (só
// PUT .../items/:itemId para marcar isDone/value) — ver
// ActivityChecklistBuilder. Atribuição funciona nos dois modos: no create
// fica em memória pro payload de POST; na edição persiste na hora via
// PUT /activities/:id/assignees a cada mudança (upsert por diferença no
// backend, idempotente).
const ActivityFormDialog: React.FC<ActivityFormDialogProps> = ({ open, activity, onClose }) => {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistDraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [slaPreviewMinutes, setSlaPreviewMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(activity ? {
      title: activity.title,
      description: activity.description ?? "",
      priority: activity.priority,
      scheduledAt: activity.scheduledAt ? activity.scheduledAt.slice(0, 16) : "",
    } : DEFAULT_FORM);
    setAssigneeIds(activity?.assignees?.map((a) => a.userId) ?? []);
    setChecklistItems([]);
  }, [open, activity]);

  useEffect(() => {
    if (!open) return;
    api.get<{ slaConfig: Record<ActivityPriority, number> }>("/activities/sla-config")
      .then(({ data }) => setSlaPreviewMinutes(data.slaConfig[form.priority]))
      .catch(() => setSlaPreviewMinutes(null));
  }, [open, form.priority]);

  const handleAssigneesChange = async (nextUserIds: number[]) => {
    setAssigneeIds(nextUserIds);
    if (!activity) return; // create: só guarda em memória, vai no POST
    try {
      await api.put(`/activities/${activity.id}/assignees`, { userIds: nextUserIds });
    } catch (err) {
      notify.error(err);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        priority: form.priority,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      };
      if (activity) {
        await api.put(`/activities/${activity.id}`, payload);
        notify.success("Atividade atualizada");
      } else {
        await api.post("/activities", {
          ...payload,
          assigneeIds,
          items: checklistItems
            .filter((item) => item.label.trim())
            .map((item) => ({ ...item, label: item.label.trim() })),
        });
        notify.success("Atividade criada");
      }
      onClose();
    } catch (err) {
      notify.error(err);
    } finally {
      setSaving(false);
    }
  };

  const slaLabel = slaPreviewMinutes != null
    ? slaPreviewMinutes >= 1440
      ? `${Math.round(slaPreviewMinutes / 1440)} dia(s)`
      : slaPreviewMinutes >= 60
        ? `${Math.round(slaPreviewMinutes / 60)}h`
        : `${slaPreviewMinutes}min`
    : null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{activity ? "Editar Atividade" : "Nova Atividade"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <FormField htmlFor="activity-title" label="Título" required>
            <Input
              id="activity-title"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Instalar roteador no cliente"
            />
          </FormField>

          <FormField htmlFor="activity-description" label="Descrição">
            <Textarea
              id="activity-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </FormField>

          <FormField
            htmlFor="activity-priority"
            label="Prioridade"
            helperText={slaLabel ? `Prazo de SLA aplicado: ${slaLabel}` : undefined}
          >
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((prev) => ({ ...prev, priority: v as ActivityPriority }))}
            >
              <SelectTrigger id="activity-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTIVITY_PRIORITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField htmlFor="activity-scheduled" label="Agendada para (opcional)">
            <Input
              id="activity-scheduled"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
            />
          </FormField>

          <Separator />

          <FormField htmlFor="activity-assignees" label="Responsáveis">
            <ActivityAssigneesPanel selectedUserIds={assigneeIds} onChange={handleAssigneesChange} />
          </FormField>

          <Separator />

          {activity ? (
            <FormField htmlFor="activity-checklist" label="Checklist">
              {activity.items && activity.items.length > 0 ? (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {activity.items.map((item) => (
                    <li key={item.id}>• {item.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum item no checklist.</p>
              )}
            </FormField>
          ) : (
            <FormField htmlFor="activity-checklist" label="Checklist">
              <ActivityChecklistBuilder items={checklistItems} onChange={setChecklistItems} />
            </FormField>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.title.trim()}>
            {activity ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityFormDialog;
