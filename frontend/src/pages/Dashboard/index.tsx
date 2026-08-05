/* @jsxImportSource react */
import React from "react";
import { Settings } from "lucide-react";

import {
  PageContainer,
  PageHeader,
  PageContent,
} from "../../components/ui/page-layout";
import { Button } from "../../components/ui/button";

import { useDashboard } from "./hooks/useDashboard";
import DashboardKpiRow from "./components/DashboardKpiRow";
import DashboardAttendanceCard from "./components/DashboardAttendanceCard";
import DashboardConnectionsPanel from "./components/DashboardConnectionsPanel";
import DashboardWidgets from "./components/DashboardWidgets";
import DashboardCustomizeModal from "./components/DashboardCustomizeModal";

const Dashboard: React.FC = () => {
  const {
    user,
    sortedWidgets,
    modalOpen,
    setModalOpen,
    stats,
    whatsApps,
    connectedCount,
    userQueueIds,
    openCount,
    pendingCount,
    closedCount,
    toggleWidget,
    moveWidget,
    handleSaveConfigs,
  } = useDashboard();

  const totalCount = openCount + pendingCount + closedCount;

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description={`Bem-vindo de volta, ${user?.name}. Aqui está o resumo das suas operações.`}
      >
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModalOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Personalizar
          </Button>
        </div>
      </PageHeader>

      <PageContent className="space-y-6 pb-20">
        <DashboardKpiRow stats={stats} />

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <DashboardAttendanceCard totalCount={totalCount} />
          <DashboardConnectionsPanel
            whatsApps={whatsApps}
            connectedCount={connectedCount}
          />
        </div>

        <DashboardWidgets
          sortedWidgets={sortedWidgets}
          userQueueIds={userQueueIds}
        />
      </PageContent>

      <DashboardCustomizeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        sortedWidgets={sortedWidgets}
        onToggle={toggleWidget}
        onMove={moveWidget}
        onSave={handleSaveConfigs}
      />
    </PageContainer>
  );
};

export default Dashboard;
