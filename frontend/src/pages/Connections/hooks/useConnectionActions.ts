import { useState, useContext, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import { i18n } from "../../../translate/i18n";
import { WhatsAppsContext } from "../../../context/WhatsApp/WhatsAppsContext";

import type { WhatsApp, ConfirmationAction } from "../connectionConfigTypes";

export interface UseConnectionActionsReturn {
  keepAliveSaving: boolean;
  connecting: boolean;
  setConnecting: Dispatch<SetStateAction<boolean>>;
  restarting: boolean;
  setRestarting: Dispatch<SetStateAction<boolean>>;
  pairingModalOpen: boolean;
  setPairingModalOpen: (v: boolean) => void;
  whatsappModalOpen: boolean;
  setWhatsAppModalOpen: (v: boolean) => void;
  confirmationOpen: boolean;
  setConfirmationOpen: (v: boolean) => void;
  confirmationAction: ConfirmationAction;
  setConfirmationAction: (v: ConfirmationAction) => void;
  phoneNumber: string;
  setPhoneNumber: (v: string) => void;
  pairingCode: string;
  setPairingCode: Dispatch<SetStateAction<string>>;
  pairingLoading: boolean;
  setPairingLoading: Dispatch<SetStateAction<boolean>>;
  showPairingInput: boolean;
  setShowPairingInput: (v: boolean) => void;
  showQrCode: boolean;
  setShowQrCode: Dispatch<SetStateAction<boolean>>;
  inputPairingModalOpen: boolean;
  setInputPairingModalOpen: (v: boolean) => void;
  handleStartSessionQr: () => Promise<void>;
  handleRestart: () => Promise<void>;
  handleRequestPairingCode: () => Promise<void>;
  handleDisconnect: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleToggleKeepAlive: (next: boolean) => Promise<void>;
  handleCancelPairing: () => void;
}

interface UseConnectionActionsOptions {
  whatsappId: string | undefined;
  isConnected: boolean;
  isBusy: boolean;
  setWhatsapp: Dispatch<SetStateAction<WhatsApp | null>>;
  fetchWhatsapp: () => Promise<void>;
}

export const useConnectionActions = ({
  whatsappId,
  isConnected,
  isBusy,
  setWhatsapp,
  fetchWhatsapp,
}: UseConnectionActionsOptions): UseConnectionActionsReturn => {
  const navigate = useNavigate();
  const { reloadWhatsApps } = useContext(WhatsAppsContext);

  const [keepAliveSaving, setKeepAliveSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsAppModalOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<ConfirmationAction>(null);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const [showPairingInput, setShowPairingInput] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [inputPairingModalOpen, setInputPairingModalOpen] = useState(false);

  const handleStartSessionQr = async () => {
    if (isConnected || isBusy || connecting) return;
    try {
      setConnecting(true);
      setShowPairingInput(false);
      setShowQrCode(true);
      await api.post(`/whatsappsession/${whatsappId}`, { usePairingCode: false });
      await fetchWhatsapp();
    } catch (err: unknown) {
      toastError(err);
      setConnecting(false);
    }
  };

  const handleRestart = async () => {
    if (restarting) return;
    try {
      setRestarting(true);
      await api.put(`/whatsappsession/${whatsappId}`);
    } catch (err: unknown) {
      toastError(err);
      setRestarting(false);
    }
  };

  const handleRequestPairingCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toastError({ response: { data: { message: "Número de telefone inválido" } } } as never);
      return;
    }
    setPairingLoading(true);
    setPairingCode("");
    setShowPairingInput(true);
    setInputPairingModalOpen(false);
    try {
      await api.post(`/whatsappsession/${whatsappId}`, {
        usePairingCode: true,
        phoneNumber: phoneNumber.replace(/\D/g, ""),
      });
    } catch (err: unknown) {
      toastError(err);
      setPairingLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.delete(`/whatsappsession/${whatsappId}`);
      await fetchWhatsapp();
    } catch (err: unknown) {
      toastError(err);
    }
    setConfirmationOpen(false);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/whatsapp/${whatsappId}`);
      await reloadWhatsApps();
      navigate("/connections");
    } catch (err: unknown) {
      toastError(err);
    }
    setConfirmationOpen(false);
  };

  const handleToggleKeepAlive = async (next: boolean) => {
    setKeepAliveSaving(true);
    setWhatsapp((prev) => prev ? { ...prev, keepAlive: next } : prev);
    try {
      await api.put(`/whatsapp/${whatsappId}/keepalive`, { keepAlive: next });
      toast.success(i18n.t("connections.toasts.keepAliveUpdated") as string);
    } catch (err: unknown) {
      setWhatsapp((prev) => prev ? { ...prev, keepAlive: !next } : prev);
      toastError(err);
    } finally {
      setKeepAliveSaving(false);
    }
  };

  const handleCancelPairing = () => {
    setShowPairingInput(false);
    setPairingCode("");
    setPhoneNumber("");
    setPairingLoading(false);
  };

  return {
    keepAliveSaving,
    connecting,
    setConnecting,
    restarting,
    setRestarting,
    pairingModalOpen,
    setPairingModalOpen,
    whatsappModalOpen,
    setWhatsAppModalOpen,
    confirmationOpen,
    setConfirmationOpen,
    confirmationAction,
    setConfirmationAction,
    phoneNumber,
    setPhoneNumber,
    pairingCode,
    setPairingCode,
    pairingLoading,
    setPairingLoading,
    showPairingInput,
    setShowPairingInput,
    showQrCode,
    setShowQrCode,
    inputPairingModalOpen,
    setInputPairingModalOpen,
    handleStartSessionQr,
    handleRestart,
    handleRequestPairingCode,
    handleDisconnect,
    handleDelete,
    handleToggleKeepAlive,
    handleCancelPairing,
  };
};
