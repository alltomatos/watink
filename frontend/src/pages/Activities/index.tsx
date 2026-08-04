/* @jsxImportSource react */
import React, { useContext } from "react";
import { Search, Plus, ClipboardList } from "lucide-react";

import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Can } from "../../components/Can";
import { AuthContext } from "../../context/Auth/AuthContext";
import ConfirmationModal from "../../components/ConfirmationModal";
import { ACTIVITY_PRIORITY_LABELS, ACTIVITY_STATUS_LABELS } from "../MyActivities/activityTypes";
import { ActivitiesTable } from "./components/ActivitiesTable";
import ActivityFormDialog from "./components/ActivityFormDialog";
import { useActivities } from "./hooks/useActivities";

// Tela de gestão de Atividades — lista do tenant inteiro (GET /activities),
// distinta de "Minhas Atividades" (visão do executor, filtro por
// assignee). Atribuição N:N e montador de checklist ficam em issue seguinte.
const Activities: React.FC = () => {
  const { user } = useContext(AuthContext);
  const {
    activities, loading, error,
    searchParam, setSearchParam, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter,
    formOpen, selectedActivity, confirmDeleteOpen, activityToDelete,
    handleOpenForm, handleCloseForm, handleDeleteClick, handleConfirmDelete, setConfirmDeleteOpen,
    refetch,
  } = useActivities();

  return (
    <Can
      user={user}
      perform="activities:manage"
      yes={() => (
        <PageContainer>
          <PageHeader
            title={
              <span className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                Atividades
              </span>
            }
            description="Gestão de ordens de serviço do tenant"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {Object.entries(ACTIVITY_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter || "all"} onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as prioridades</SelectItem>
                  {Object.entries(ACTIVITY_PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título..."
                  value={searchParam}
                  onChange={(e) => setSearchParam(e.target.value)}
                  className="pl-9 h-10 w-64"
                />
              </div>

              <Button onClick={() => handleOpenForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Atividade
              </Button>
            </div>
          </PageHeader>

          <PageContent className="p-0">
            <div className="p-6">
              <ActivitiesTable
                activities={activities}
                loading={loading}
                error={error}
                onRetry={refetch}
                user={user}
                onEdit={handleOpenForm}
                onDelete={handleDeleteClick}
              />
            </div>
          </PageContent>

          <ActivityFormDialog
            open={formOpen}
            activity={selectedActivity}
            onClose={handleCloseForm}
          />

          <ConfirmationModal
            title="Excluir Atividade"
            open={confirmDeleteOpen}
            onClose={() => setConfirmDeleteOpen(false)}
            onConfirm={handleConfirmDelete}
          >
            {activityToDelete
              ? `Deseja realmente excluir a atividade "${activityToDelete.title}"?`
              : ""}
          </ConfirmationModal>
        </PageContainer>
      )}
      no={() => (
        <PageContainer>
          <PageContent>
            <p className="text-center text-muted-foreground py-16">
              Você não tem permissão para visualizar esta página.
            </p>
          </PageContent>
        </PageContainer>
      )}
    />
  );
};

export default Activities;
