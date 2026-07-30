import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import { i18n } from "../../../translate/i18n";
import { useWhatsAppsQuery } from "../../../hooks/useWhatsAppsQuery";
import { subscribeToSocket } from "../../../services/sse-client";

import type { ConnectionSession } from "../connectionsTypes";

export interface UseConnectionsReturn {
  whatsApps: ConnectionSession[];
  reloadWhatsApps: () => void;
  whatsAppModalOpen: boolean;
  webchatModalOpen: boolean;
  confirmModalOpen: boolean;
  selectedWhatsApp: ConnectionSession | null;
  handleStartSession: (id: number) => Promise<void>;
  handleRequestNewQrCode: (id: number) => Promise<void>;
  handleDisconnectSession: (id: number) => Promise<void>;
  handleDeleteWhatsApp: () => Promise<void>;
  handleEditWhatsApp: (whatsApp: ConnectionSession) => void;
  handleOpenNewWhatsApp: () => void;
  handleOpenNewWebchat: () => void;
  handleCloseWhatsAppModal: () => void;
  handleCloseWebchatModal: () => void;
  handleOpenConfirm: (whatsApp: ConnectionSession) => void;
  handleCloseConfirm: () => void;
  navigate: ReturnType<typeof useNavigate>;
}

export const useConnections = (): UseConnectionsReturn => {
  const navigate = useNavigate();
  const { data: whatsApps = [], refetch: reloadWhatsApps } = useWhatsAppsQuery();

  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [webchatModalOpen, setWebchatModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState<ConnectionSession | null>(null);

  useEffect(() => {
    const refetch = () => { reloadWhatsApps(); };
    return subscribeToSocket({ whatsappSession: refetch, whatsapp: refetch });
  }, [reloadWhatsApps]);

  const handleStartSession = async (id: number) => {
    try {
      await api.post(`/whatsappsession/${id}`);
    } catch (err) {
      toastError(err);
    }
  };

  const handleRequestNewQrCode = async (id: number) => {
    try {
      await api.put(`/whatsappsession/${id}`);
    } catch (err) {
      toastError(err);
    }
  };

  const handleDisconnectSession = async (id: number) => {
    try {
      await api.delete(`/whatsappsession/${id}`);
      await reloadWhatsApps();
      toast.success(i18n.t("connections.toasts.disconnected"));
    } catch (err) {
      toastError(err);
    }
  };

  const handleDeleteWhatsApp = async () => {
    if (!selectedWhatsApp) return;
    try {
      if (
        selectedWhatsApp.status !== "DISCONNECTED" &&
        selectedWhatsApp.status !== "TIMEOUT"
      ) {
        try {
          await api.delete(`/whatsappsession/${selectedWhatsApp.id}`);
        } catch (err) {
          console.warn("Could not stop session before deleting:", err);
        }
      }
      await api.delete(`/whatsapp/${selectedWhatsApp.id}`);
      await reloadWhatsApps();
      toast.warn(i18n.t("connections.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setConfirmModalOpen(false);
    setSelectedWhatsApp(null);
  };

  const handleEditWhatsApp = (whatsApp: ConnectionSession) => {
    setSelectedWhatsApp(whatsApp);
    if (whatsApp.type === "webchat") {
      setWebchatModalOpen(true);
    } else {
      setWhatsAppModalOpen(true);
    }
  };

  const handleOpenNewWhatsApp = () => {
    setSelectedWhatsApp(null);
    setWhatsAppModalOpen(true);
  };

  const handleOpenNewWebchat = () => {
    setSelectedWhatsApp(null);
    setWebchatModalOpen(true);
  };

  const handleCloseWhatsAppModal = () => {
    setWhatsAppModalOpen(false);
    setSelectedWhatsApp(null);
  };

  const handleCloseWebchatModal = () => {
    setWebchatModalOpen(false);
    setSelectedWhatsApp(null);
  };

  const handleOpenConfirm = (whatsApp: ConnectionSession) => {
    setSelectedWhatsApp(whatsApp);
    setConfirmModalOpen(true);
  };

  const handleCloseConfirm = () => {
    setConfirmModalOpen(false);
    setSelectedWhatsApp(null);
  };

  return {
    whatsApps: whatsApps as ConnectionSession[],
    reloadWhatsApps,
    whatsAppModalOpen,
    webchatModalOpen,
    confirmModalOpen,
    selectedWhatsApp,
    handleStartSession,
    handleRequestNewQrCode,
    handleDisconnectSession,
    handleDeleteWhatsApp,
    handleEditWhatsApp,
    handleOpenNewWhatsApp,
    handleOpenNewWebchat,
    handleCloseWhatsAppModal,
    handleCloseWebchatModal,
    handleOpenConfirm,
    handleCloseConfirm,
    navigate,
  };
};
