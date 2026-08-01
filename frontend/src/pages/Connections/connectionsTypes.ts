/**
 * Types for the Connections list page (index.tsx and sub-components).
 * Connection-config-specific types live in connectionConfigTypes.ts.
 */

export interface ConnectionQueue {
  name: string;
}

export interface ConnectionSession {
  id: number;
  name: string;
  number?: string;
  status: "CONNECTED" | "DISCONNECTED" | "QRCODE" | "PAIRING" | "OPENING" | "TIMEOUT" | string;
  profilePicUrl?: string;
  type?: string;
  updatedAt?: string;
  queue?: ConnectionQueue;
  /** "none" | "single" | "group" — indicador leve; detalhe completo só na tela de configuração. */
  proxyMode?: string;
  /** Último sinal de risco de ban/throttle (whatsmeow IQ 401/403/429/463). */
  lastRiskCode?: number;
  lastRiskAction?: string;
  lastRiskMessage?: string;
  lastRiskAt?: string | null;
}

export const STATUS_LABELS: Record<string, string> = {
  CONNECTED: "Conectado",
  DISCONNECTED: "Desconectado",
  QRCODE: "Escanear QR Code",
  PAIRING: "Pareando",
  OPENING: "Iniciando...",
  TIMEOUT: "Tempo Esgotado",
  BANNED: "Banido",
};
