import React, { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar } from "@/components/ui/avatar";
import notify from "@/lib/notify";
import api from "../../../services/api";

interface UserOption {
  id: number;
  name: string;
  email: string;
}

interface ActivityAssigneesPanelProps {
  /** userIds selecionados atualmente. */
  selectedUserIds: number[];
  /**
   * onChange(nextUserIds) — o caller decide o que fazer: no create, guarda
   * em memória pro payload de POST /activities; na edição, persiste na hora
   * via PUT /activities/:id/assignees (atribuição é N:N desde a Fase 0,
   * mesmo com só um responsável selecionado).
   */
  onChange: (nextUserIds: number[]) => void;
}

// ActivityAssigneesPanel — multi-select de usuários do tenant. Nunca lista
// usuário de outro tenant (GET /users já escopa por tenantId no backend).
const ActivityAssigneesPanel: React.FC<ActivityAssigneesPanelProps> = ({ selectedUserIds, onChange }) => {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ users: UserOption[] }>("/users")
      .then(({ data }) => setUsers(data.users ?? []))
      .catch((err) => notify.error(err))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (userId: number) => {
    onChange(
      selectedUserIds.includes(userId)
        ? selectedUserIds.filter((id) => id !== userId)
        : [...selectedUserIds, userId],
    );
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando usuários...</p>;
  }

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum usuário disponível neste tenant.</p>;
  }

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border border-border p-2">
      {users.map((u) => (
        <label
          key={u.id}
          htmlFor={`assignee-${u.id}`}
          className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
        >
          <Checkbox
            id={`assignee-${u.id}`}
            checked={selectedUserIds.includes(u.id)}
            onCheckedChange={() => toggle(u.id)}
          />
          <Avatar size="sm" name={u.name} />
          <span className="text-sm flex-1 truncate">{u.name}</span>
          <span className="text-xs text-muted-foreground truncate">{u.email}</span>
        </label>
      ))}
    </div>
  );
};

export default ActivityAssigneesPanel;
