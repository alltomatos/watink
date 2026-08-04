/* @jsxImportSource react */
import React, { useState } from "react";
import { ClipboardList } from "lucide-react";

import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import notify from "@/lib/notify";

import api from "../../services/api";
import ActivityExecution from "./ActivityExecution";
import { Activity } from "./activityTypes";
import { useMyActivities, ActivityTab } from "./hooks/useMyActivities";
import ActivityKpiCards from "./components/ActivityKpiCards";
import ActivityFilters from "./components/ActivityFilters";
import ActivityCard from "./components/ActivityCard";

const TABS: { key: ActivityTab; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "overdue", label: "Atrasadas" },
  { key: "inProgress", label: "Em andamento" },
  { key: "done", label: "Concluídas" },
];

const MyActivities: React.FC = () => {
  const {
    loading, errorKind, kpis, tab, setTab,
    search, setSearch, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter,
    filtered, refetch,
  } = useMyActivities();

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [executionOpen, setExecutionOpen] = useState(false);

  const handleOpenExecution = async (activity: Activity) => {
    // Início explícito: marca in_progress/startedAt na primeira abertura —
    // idempotente no backend, base do KPI de tempo médio e do alerta de
    // "atividade parada" (docs/agents/activities.md §Melhorias de UX).
    try {
      await api.put(`/activities/${activity.id}/start`);
    } catch (err) {
      notify.error(err);
      return;
    }
    setSelectedActivity(activity);
    setExecutionOpen(true);
  };

  const handleCloseExecution = () => {
    setExecutionOpen(false);
    setSelectedActivity(null);
    refetch();
  };

  return (
    <PageContainer>
      <PageHeader title="Minhas Atividades" />
      <PageContent className="flex flex-col gap-4">
        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
            </div>
          </div>
        ) : errorKind ? (
          <ErrorState
            title={errorKind === "forbidden" ? "Você não tem permissão para ver atividades" : undefined}
            onRetry={errorKind === "generic" ? refetch : undefined}
          />
        ) : (
          <>
            <ActivityKpiCards kpis={kpis} />

            <ActivityFilters
              search={search}
              onSearchChange={setSearch}
              status={statusFilter}
              onStatusChange={setStatusFilter}
              priority={priorityFilter}
              onPriorityChange={setPriorityFilter}
            />

            <Tabs value={tab} onValueChange={(v) => setTab(v as ActivityTab)}>
              <TabsList>
                {TABS.map(({ key, label }) => (
                  <TabsTrigger key={key} value={key} className="gap-1.5">
                    {label}
                    <Badge variant="secondary">{kpis.tabCounts[key]}</Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {filtered.length === 0 ? (
              <EmptyState
                icon={<ClipboardList />}
                title="Nenhuma atividade atribuída no momento."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onExecute={handleOpenExecution}
                    onOccurrenceRegistered={refetch}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </PageContent>

      {selectedActivity && (
        <ActivityExecution
          open={executionOpen}
          activityId={String(selectedActivity.id)}
          onClose={handleCloseExecution}
        />
      )}
    </PageContainer>
  );
};

export default MyActivities;
