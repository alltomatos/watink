import { useState, useEffect, useCallback, useContext, useRef } from "react";
import { toast } from "react-toastify";

import api from "../../../services/api";
import { AuthContext } from "../../../context/Auth/AuthContext";
import { SystemStats, ReleaseMeta, QueueAlert } from "../types";
import { queueAlert, compareVersions } from "../utils";

export interface UseVersionDashboardReturn {
  isSuperAdmin: boolean;
  stats: SystemStats | null;
  loading: boolean;
  updating: boolean;
  openUpdateModal: boolean;
  setOpenUpdateModal: (open: boolean) => void;
  error: string | null;
  queueAlerts: Record<string, QueueAlert>;
  frontendVersion: string;
  frontendUpdatedAt: string | null;
  availableVersion: string;
  changelog: string[];
  releaseMeta: ReleaseMeta;
  updateStatus: "idle" | "updating" | "ok";
  hasUpdateAvailable: boolean;
  blockedByCompatibility: boolean;
  handleUpdate: () => Promise<void>;
}

export function useVersionDashboard(): UseVersionDashboardReturn {
  const { user } = useContext(AuthContext);
  const isSuperAdmin = (user as unknown as { alcance?: string })?.alcance === "plataforma";

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [openUpdateModal, setOpenUpdateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueAlerts, setQueueAlerts] = useState<Record<string, QueueAlert>>({});
  const [frontendVersion, setFrontendVersion] = useState("-");
  const [frontendUpdatedAt, setFrontendUpdatedAt] = useState<string | null>(null);
  const [availableVersion, setAvailableVersion] = useState("-");
  const [changelog, setChangelog] = useState<string[]>([]);
  const [releaseMeta, setReleaseMeta] = useState<ReleaseMeta>({
    breaking: false,
    minCompatibleFrom: "",
    migrationNotes: "",
  });
  const [updateStatus, setUpdateStatus] = useState<"idle" | "updating" | "ok">(
    () => (localStorage.getItem("watink_update_ok") === "1" ? "ok" : "idle")
  );
  const prevQueueMessagesRef = useRef<Record<string, number>>({});

  const hasUpdateAvailable =
    availableVersion !== "-" &&
    compareVersions(availableVersion, frontendVersion) > 0;

  const blockedByCompatibility =
    !!releaseMeta?.breaking &&
    !!releaseMeta?.minCompatibleFrom &&
    compareVersions(frontendVersion, releaseMeta.minCompatibleFrom) < 0;

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get<SystemStats>("/system/stats");
      const nextAlerts: Record<string, QueueAlert> = {};
      (data?.rabbitmq?.queues || []).forEach((q) => {
        const prev = prevQueueMessagesRef.current[q.name] || 0;
        nextAlerts[q.name] = queueAlert(q, prev);
        prevQueueMessagesRef.current[q.name] = q.messages || 0;
      });
      setQueueAlerts(nextAlerts);

      const pending = localStorage.getItem("watink_update_pending") === "1";
      if (pending && (data?.uptime || 999999) < 180) {
        setUpdateStatus("ok");
        localStorage.removeItem("watink_update_pending");
        localStorage.setItem("watink_update_ok", "1");
        toast.success("Atualização concluída com sucesso");
      }

      setStats(data);
      setError(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(
        err?.response?.data?.error || err?.message || "Falha ao carregar estatísticas"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    setUpdateStatus("updating");
    localStorage.setItem("watink_update_pending", "1");
    localStorage.setItem("watink_update_ok", "0");
    setOpenUpdateModal(false);
    try {
      await api.post("/system/update", {
        version: availableVersion !== "-" ? availableVersion : "latest",
      });
      toast.info("Processo de atualização iniciado. O sistema entrará em manutenção.");
      const checkInterval = setInterval(async () => {
        try {
          const { data } = await api.get<{ enabled: boolean }>("/system/maintenance");
          if (data.enabled) {
            clearInterval(checkInterval);
            window.location.reload();
          }
        } catch {
          // servidor reiniciando
        }
      }, 2000);
    } catch {
      toast.error("Erro ao iniciar atualização");
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 5000);

    fetch(`/version.json?ts=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((v: { version?: string; lastUpdated?: string }) => {
        if (v?.version) setFrontendVersion(v.version);
        if (v?.lastUpdated) setFrontendUpdatedAt(v.lastUpdated);
      })
      .catch(() => {});

    api
      .get<{
        version?: string;
        breaking?: boolean;
        min_compatible_from?: string;
        migration_notes?: string;
        changelog?: string[];
      }>("/system/latest-release")
      .then(({ data }) => {
        const version = String(data?.version || "")
          .trim()
          .replace(/^v/i, "");
        if (version) setAvailableVersion(version);
        setReleaseMeta({
          breaking: !!data?.breaking,
          minCompatibleFrom: String(data?.min_compatible_from || ""),
          migrationNotes: String(data?.migration_notes || ""),
        });
        setChangelog(
          Array.isArray(data?.changelog) ? data.changelog.filter(Boolean) : []
        );
      })
      .catch(() => {
        setAvailableVersion("-");
        setReleaseMeta({ breaking: false, minCompatibleFrom: "", migrationNotes: "" });
      });

    return () => clearInterval(id);
  }, [fetchStats]);

  return {
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
  };
}
