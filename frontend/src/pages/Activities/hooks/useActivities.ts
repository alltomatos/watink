import { useState, useEffect, useCallback } from "react";
import notify from "@/lib/notify";
import api from "../../../services/api";
import { Activity } from "../../MyActivities/activityTypes";

interface UseActivitiesReturn {
  activities: Activity[];
  loading: boolean;
  error: boolean;
  searchParam: string;
  setSearchParam: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  priorityFilter: string;
  setPriorityFilter: (v: string) => void;
  formOpen: boolean;
  selectedActivity: Activity | null;
  confirmDeleteOpen: boolean;
  activityToDelete: Activity | null;
  handleOpenForm: (activity?: Activity) => void;
  handleCloseForm: () => void;
  handleDeleteClick: (activity: Activity) => void;
  handleConfirmDelete: () => Promise<void>;
  setConfirmDeleteOpen: (open: boolean) => void;
  refetch: () => void;
}

// GET /activities (tenant-wide, visão de gestão) — distinto de
// GET /my-activities (visão do executor, filtro por assignee). Sem
// paginação, mesmo precedente de Clients (client_history.go usa cap fixo,
// List não pagina).
export function useActivities(): UseActivitiesReturn {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const { data } = await api.get<{ activities: Activity[] }>("/activities", {
        params: {
          searchParam: searchParam || undefined,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
        },
      });
      setActivities(data.activities ?? []);
    } catch (err) {
      setError(true);
      notify.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchParam, statusFilter, priorityFilter]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleOpenForm = (activity?: Activity) => {
    setSelectedActivity(activity ?? null);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setSelectedActivity(null);
    setFormOpen(false);
    loadActivities();
  };

  const handleDeleteClick = (activity: Activity) => {
    setActivityToDelete(activity);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/activities/${activityToDelete?.id}`);
      notify.success("Atividade excluída com sucesso");
      loadActivities();
    } catch (err) {
      notify.error(err);
    }
    setConfirmDeleteOpen(false);
    setActivityToDelete(null);
  };

  return {
    activities, loading, error,
    searchParam, setSearchParam, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter,
    formOpen, selectedActivity, confirmDeleteOpen, activityToDelete,
    handleOpenForm, handleCloseForm, handleDeleteClick, handleConfirmDelete, setConfirmDeleteOpen,
    refetch: loadActivities,
  };
}
