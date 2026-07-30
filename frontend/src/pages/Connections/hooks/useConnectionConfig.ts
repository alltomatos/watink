import { useParams } from "react-router";

import { useWhatsAppSocket } from "./useWhatsAppSSE";
import { useConnectionFetch } from "./useConnectionFetch";
import { useConnectionActions } from "./useConnectionActions";

import type { UseConnectionConfigReturn } from "../connectionConfigTypes";

export type { UseConnectionConfigReturn };

export const useConnectionConfig = (): UseConnectionConfigReturn => {
  const { whatsappId } = useParams<{ whatsappId: string }>();

  const {
    whatsapp,
    setWhatsapp,
    loading,
    stats,
    fetchWhatsapp,
  } = useConnectionFetch(whatsappId);

  const status: string = whatsapp?.status ?? "DISCONNECTED";
  const isConnected = status === "CONNECTED";
  const isBusy = status === "OPENING" || status === "PAIRING";

  const actions = useConnectionActions({
    whatsappId,
    isConnected,
    isBusy,
    setWhatsapp,
    fetchWhatsapp,
  });

  useWhatsAppSocket({
    whatsappId,
    setWhatsapp,
    setShowQrCode: actions.setShowQrCode,
    setShowPairingInput: actions.setShowPairingInput,
    setConnecting: actions.setConnecting,
    setRestarting: actions.setRestarting,
    setPairingCode: actions.setPairingCode,
    setPairingLoading: actions.setPairingLoading,
    setPhoneNumber: actions.setPhoneNumber,
    fetchWhatsapp,
  });

  return {
    whatsappId,
    whatsapp,
    loading,
    stats,
    keepAliveSaving: actions.keepAliveSaving,
    status,
    isConnected,
    isBusy,
    connecting: actions.connecting,
    restarting: actions.restarting,
    pairingModalOpen: actions.pairingModalOpen,
    setPairingModalOpen: actions.setPairingModalOpen,
    whatsappModalOpen: actions.whatsappModalOpen,
    setWhatsAppModalOpen: actions.setWhatsAppModalOpen,
    confirmationOpen: actions.confirmationOpen,
    setConfirmationOpen: actions.setConfirmationOpen,
    confirmationAction: actions.confirmationAction,
    setConfirmationAction: actions.setConfirmationAction,
    phoneNumber: actions.phoneNumber,
    setPhoneNumber: actions.setPhoneNumber,
    pairingCode: actions.pairingCode,
    pairingLoading: actions.pairingLoading,
    showPairingInput: actions.showPairingInput,
    setShowPairingInput: actions.setShowPairingInput,
    showQrCode: actions.showQrCode,
    inputPairingModalOpen: actions.inputPairingModalOpen,
    setInputPairingModalOpen: actions.setInputPairingModalOpen,
    fetchWhatsapp,
    handleStartSessionQr: actions.handleStartSessionQr,
    handleRestart: actions.handleRestart,
    handleRequestPairingCode: actions.handleRequestPairingCode,
    handleDisconnect: actions.handleDisconnect,
    handleDelete: actions.handleDelete,
    handleToggleKeepAlive: actions.handleToggleKeepAlive,
    handleCancelPairing: actions.handleCancelPairing,
  };
};
