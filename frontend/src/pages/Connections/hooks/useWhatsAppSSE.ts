import { useEffect } from "react";
import { subscribeToSocket } from "../../../services/sse-client";
import type { WhatsApp } from "../connectionConfigTypes";

interface UseWhatsAppSocketOptions {
  whatsappId: string | undefined;
  setWhatsapp: React.Dispatch<React.SetStateAction<WhatsApp | null>>;
  setShowQrCode: (v: boolean) => void;
  setShowPairingInput: (v: boolean) => void;
  setConnecting: (v: boolean) => void;
  setRestarting: (v: boolean) => void;
  setPairingCode: (v: string) => void;
  setPairingLoading: (v: boolean) => void;
  setPhoneNumber: (v: string) => void;
  fetchWhatsapp: () => Promise<void>;
}

export const useWhatsAppSocket = ({
  whatsappId,
  setWhatsapp,
  setShowQrCode,
  setShowPairingInput,
  setConnecting,
  setRestarting,
  setPairingCode,
  setPairingLoading,
  setPhoneNumber,
  fetchWhatsapp,
}: UseWhatsAppSocketOptions): void => {
  useEffect(() => {
    const handleSession = (data: { action: string; session: WhatsApp & { id: number } }) => {
      if (data.action === "update" && data.session.id === parseInt(whatsappId ?? "0")) {
        setWhatsapp((prev) => prev ? { ...prev, ...data.session } : (data.session as WhatsApp));

        if (data.session.status === "QRCODE") {
          setShowQrCode(true);
          setShowPairingInput(false);
          setConnecting(false);
          if (!data.session.qrcode) void fetchWhatsapp();
        }

        if (data.session.pairingCode) {
          setPairingCode(data.session.pairingCode);
          setPairingLoading(false);
        }

        if (["CONNECTED", "QRCODE", "PAIRING", "DISCONNECTED", "TIMEOUT"].includes(data.session.status)) {
          setConnecting(false);
          setRestarting(false);
        }

        if (data.session.status === "CONNECTED") {
          setShowPairingInput(false);
          setShowQrCode(false);
          setPairingCode("");
          setPhoneNumber("");
          setPairingLoading(false);
          void fetchWhatsapp();
        }

        if (data.session.status === "DISCONNECTED" || data.session.status === "TIMEOUT") {
          setShowQrCode(false);
          setShowPairingInput(false);
          setPairingLoading(false);
        }
      }
    };

    const handleWhatsapp = (data: { action: string; whatsapp: WhatsApp & { id: number } }) => {
      if (data.action === "update" && data.whatsapp.id === parseInt(whatsappId ?? "0")) {
        setWhatsapp((prev) => prev ? { ...prev, ...data.whatsapp } : (data.whatsapp as WhatsApp));
      }
    };

    // Sinal ao vivo de risco de ban/throttle (whatsmeow IQ 401/403/429/463).
    // O valor persistido (lastRiskCode/lastRiskAt) só chega no fetch seguinte,
    // então refazemos o fetch para o banner reagir sem esperar outro evento.
    const handleSessionRisk = (data: { sessionId: number }) => {
      if (data.sessionId === parseInt(whatsappId ?? "0")) {
        void fetchWhatsapp();
      }
    };

    return subscribeToSocket({
      whatsappSession: handleSession,
      whatsapp: handleWhatsapp,
      whatsappSessionRisk: handleSessionRisk,
    });
  }, [
    whatsappId,
    fetchWhatsapp,
    setWhatsapp,
    setShowQrCode,
    setShowPairingInput,
    setConnecting,
    setRestarting,
    setPairingCode,
    setPairingLoading,
    setPhoneNumber,
  ]);
};
