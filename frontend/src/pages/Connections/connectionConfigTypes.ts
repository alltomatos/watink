import type React from "react";

export interface Stats {
  messagesToday: number;
  tickets: number;
  latencyMs: number;
}

/** Resumo do proxy em uso por uma conexão — nunca inclui credencial. */
export interface ConnectionProxySummary {
  mode: "single" | "group";
  id: number;
  label?: string;
  name?: string;
  endpoint?: string;
  status?: string;
  healthy?: boolean;
  rotationStrategy?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  /** Quando mode="group": o pick sticky atualmente em uso pela conexão. */
  current?: { id: number; endpoint: string; city?: string; country?: string; countryCode?: string };
}

export interface WhatsApp {
  id: number;
  name: string;
  number?: string;
  status: string;
  qrcode?: string;
  pairingCode?: string;
  profilePicUrl?: string;
  keepAlive?: boolean;
  isDefault?: boolean;
  lastConnectedAt?: string | null;
  firstConnection?: string | null;
  createdAt?: string;
  proxyMode?: string;
  proxyId?: number | null;
  proxyGroupId?: number | null;
  proxy?: ConnectionProxySummary;
  /** Último sinal de risco de ban/throttle (whatsmeow IQ 401/403/429/463). */
  lastRiskCode?: number;
  lastRiskAction?: string;
  lastRiskMessage?: string;
  lastRiskAt?: string | null;
}

export type ConfirmationAction = "disconnect" | "delete" | null;

export interface ActionCardProps {
  icon: React.ReactNode;
  label: string;
  tone: "default" | "destructive";
  disabled?: boolean;
  onClick: () => void;
}

export interface DetailItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export interface UseConnectionConfigReturn {
  whatsappId: string | undefined;
  whatsapp: WhatsApp | null;
  loading: boolean;
  stats: Stats | null;
  keepAliveSaving: boolean;
  status: string;
  isConnected: boolean;
  isBusy: boolean;
  connecting: boolean;
  restarting: boolean;
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
  pairingLoading: boolean;
  showPairingInput: boolean;
  setShowPairingInput: (v: boolean) => void;
  showQrCode: boolean;
  inputPairingModalOpen: boolean;
  setInputPairingModalOpen: (v: boolean) => void;
  fetchWhatsapp: () => Promise<void>;
  handleStartSessionQr: () => Promise<void>;
  handleRestart: () => Promise<void>;
  handleRequestPairingCode: () => Promise<void>;
  handleDisconnect: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleToggleKeepAlive: (next: boolean) => Promise<void>;
  handleCancelPairing: () => void;
}
