import { useCallback, useEffect, useState } from "react";
import api from "../../../services/api";
import { Activity } from "../activityTypes";

export interface ActivityKpis {
  today: number;
  inProgress: number;
  overdue: number;
  completedThisWeek: number;
  avgExecutionMinutes: number;
  tabCounts: { all: number; overdue: number; inProgress: number; done: number };
}

export type ActivityErrorKind = "forbidden" | "generic" | null;

const EMPTY_KPIS: ActivityKpis = {
  today: 0, inProgress: 0, overdue: 0, completedThisWeek: 0, avgExecutionMinutes: 0,
  tabCounts: { all: 0, overdue: 0, inProgress: 0, done: 0 },
};

export type ActivityTab = "all" | "overdue" | "inProgress" | "done";

// Ordenação por urgência (overdue → atRisk → prazo mais próximo → sem prazo)
// já vem pronta do backend (GET /my-activities) — aqui só filtra por aba e
// pelos campos de busca/status/prioridade, tudo client-side sobre a lista
// já ordenada (mesmo padrão de GruposTab: sem paginação, sem fetch por filtro).
export interface UseMyActivitiesReturn {
  loading: boolean;
  errorKind: ActivityErrorKind;
  activities: Activity[];
  kpis: ActivityKpis;
  tab: ActivityTab;
  setTab: (t: ActivityTab) => void;
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  priorityFilter: string;
  setPriorityFilter: (v: string) => void;
  filtered: Activity[];
  refetch: () => void;
}

export const useMyActivities = (): UseMyActivitiesReturn => {
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<ActivityErrorKind>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [kpis, setKpis] = useState<ActivityKpis>(EMPTY_KPIS);
  const [tab, setTab] = useState<ActivityTab>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErrorKind(null);
    try {
      const [{ data: listData }, { data: kpisData }] = await Promise.all([
        api.get<{ activities?: Activity[] }>("/my-activities"),
        api.get<ActivityKpis>("/my-activities/kpis"),
      ]);
      setActivities(listData.activities ?? []);
      setKpis(kpisData);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setErrorKind(status === 403 ? "forbidden" : "generic");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = activities.filter((a) => {
    if (tab === "overdue" && a.slaStatus !== "overdue") return false;
    if (tab === "inProgress" && a.status !== "in_progress") return false;
    if (tab === "done" && a.status !== "done") return false;
    if (statusFilter && a.status !== statusFilter) return false;
    if (priorityFilter && a.priority !== priorityFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return {
    loading, errorKind, activities, kpis, tab, setTab,
    search, setSearch, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter,
    filtered, refetch: fetchAll,
  };
};
