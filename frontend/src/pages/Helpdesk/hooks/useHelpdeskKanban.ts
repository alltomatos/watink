import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import api from "../../../services/api";
import { subscribeToSocket } from "../../../services/sse-client";

export interface KanbanProtocol {
  id: number;
  protocolNumber: string;
  subject: string;
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  contact?: { name?: string; profilePicUrl?: string };
}

export interface KanbanColumn {
  status: string;
  label: string;
  color: string;
  bgColor: string;
  protocols: KanbanProtocol[];
}

interface SocketEventData {
  action: "create" | "update";
  protocol: KanbanProtocol;
  previousStatus?: string;
  newStatus?: string;
}

interface UseHelpdeskKanbanOptions {
  tvMode?: boolean;
}

export interface UseHelpdeskKanbanReturn {
  columns: KanbanColumn[];
  loading: boolean;
  recentlyAdded: Set<number>;
  loadKanbanData: () => Promise<void>;
  handleCardClick: (protocol: KanbanProtocol) => void;
  handleTvMode: () => void;
}

export function useHelpdeskKanban({
  tvMode = false,
}: UseHelpdeskKanbanOptions): UseHelpdeskKanbanReturn {
  const navigate = useNavigate();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<number>>(new Set());

  const loadKanbanData = useCallback(async () => {
    try {
      const { data } = await api.get("/protocols/kanban");
      setColumns(data.columns);
    } catch {
      toast.error("Erro ao carregar Kanban");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleProtocolEvent = useCallback((data: SocketEventData) => {
    const { action, protocol, previousStatus, newStatus } = data;

    if (action === "create") {
      setColumns((prev) =>
        prev.map((col) => {
          if (col.status === protocol.status) {
            return { ...col, protocols: [protocol, ...col.protocols] };
          }
          return col;
        })
      );
      setRecentlyAdded((prev) => new Set(prev).add(protocol.id));
      setTimeout(() => {
        setRecentlyAdded((prev) => {
          const next = new Set(prev);
          next.delete(protocol.id);
          return next;
        });
      }, 2000);
    } else if (action === "update") {
      if (previousStatus !== newStatus) {
        setColumns((prev) =>
          prev.map((col) => {
            if (col.status === previousStatus) {
              return {
                ...col,
                protocols: col.protocols.filter((p) => p.id !== protocol.id),
              };
            }
            if (col.status === newStatus) {
              return { ...col, protocols: [protocol, ...col.protocols] };
            }
            return col;
          })
        );
      } else {
        setColumns((prev) =>
          prev.map((col) => ({
            ...col,
            protocols: col.protocols.map((p) =>
              p.id === protocol.id ? protocol : p
            ),
          }))
        );
      }
    }
  }, []);

  useEffect(() => {
    loadKanbanData();

    return subscribeToSocket(
      { protocol: handleProtocolEvent },
      (socket) => socket.emit("joinHelpdeskKanban")
    );
  }, [loadKanbanData, handleProtocolEvent]);

  const handleCardClick = useCallback(
    (protocol: KanbanProtocol) => {
      if (!tvMode) {
        navigate(`/helpdesk/${protocol.id}`);
      }
    },
    [navigate, tvMode]
  );

  const handleTvMode = useCallback(() => {
    navigate("/helpdesk/tv");
  }, [navigate]);

  return {
    columns,
    loading,
    recentlyAdded,
    loadKanbanData,
    handleCardClick,
    handleTvMode,
  };
}
