import React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { useVersionDashboard } from "./hooks/useVersionDashboard";
import DashboardHeader from "./components/DashboardHeader";
import SystemStatsGrid from "./components/SystemStatsGrid";
import ProcessCard from "./components/ProcessCard";
import RabbitMQCard from "./components/RabbitMQCard";
import TenantConsumptionTable from "./components/TenantConsumptionTable";
import UpdateDialog from "./components/UpdateDialog";

export default function VersionDashboard() {
  const {
    isSuperAdmin,
    stats,
    loading,
    updating,
    openUpdateModal,
    setOpenUpdateModal,
    error,
    queueAlerts,
    frontendVersion,
    frontendUpdatedAt,
    availableVersion,
    changelog,
    releaseMeta,
    updateStatus,
    hasUpdateAvailable,
    blockedByCompatibility,
    handleUpdate,
  } = useVersionDashboard();

  if (!isSuperAdmin) {
    return (
      <div className="container mt-6">
        <p className="text-destructive">Acesso restrito ao superadmin.</p>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="container mt-6 flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mt-6 space-y-6 pb-8">
      <DashboardHeader
        hasUpdateAvailable={hasUpdateAvailable}
        availableVersion={availableVersion}
        updating={updating}
        updateStatus={updateStatus}
        onUpdateClick={() => setOpenUpdateModal(true)}
      />

      {error && <p className="text-sm text-destructive">Erro: {error}</p>}

      <SystemStatsGrid stats={stats} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ProcessCard stats={stats} />
        <RabbitMQCard stats={stats} queueAlerts={queueAlerts} />
      </div>

      <TenantConsumptionTable stats={stats} />

      {updateStatus === "ok" && (
        <p className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--status-success)" }}>
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Atualização concluída com sucesso. Sistema 100% atualizado.
        </p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Watink Business v{frontendVersion} • Build ID: {stats?.timestamp}
        {frontendUpdatedAt
          ? ` • Updated: ${new Date(frontendUpdatedAt).toLocaleString()}`
          : ""}
      </p>

      <UpdateDialog
        open={openUpdateModal}
        onOpenChange={setOpenUpdateModal}
        availableVersion={availableVersion}
        frontendVersion={frontendVersion}
        releaseMeta={releaseMeta}
        changelog={changelog}
        blockedByCompatibility={blockedByCompatibility}
        onConfirm={handleUpdate}
      />
    </div>
  );
}
