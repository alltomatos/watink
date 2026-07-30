import React, { useEffect, useState } from "react";
import QRCode from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import { subscribeToSocket } from "../../services/sse-client";
import toastError from "../../errors/toastError";
import { WhatsAppSessionSocketEvent, WhatsAppSession } from "../../types/api";

interface QrcodeModalProps {
  open: boolean;
  onClose: () => void;
  whatsAppId: number | string;
}

const QrcodeModal = ({ open, onClose, whatsAppId }: QrcodeModalProps) => {
  const [qrCode, setQrCode] = useState("");

  useEffect(() => {
    if (!whatsAppId) return;
    const fetchSession = async () => {
      try {
        const { data } = await api.get<WhatsAppSession>(`/whatsapp/${whatsAppId}`);
        setQrCode(data.qrcode ?? "");
      } catch (err) {
        toastError(err);
      }
    };
    fetchSession();
  }, [whatsAppId]);

  useEffect(() => {
    if (!whatsAppId) return;

    const handleSession = (data: WhatsAppSessionSocketEvent) => {
      // whatsAppId chega como number OU string dependendo do chamador;
      // data.session.id vem sempre number do backend — normalizar os dois
      // lados antes de comparar, senão a comparação estrita nunca bate e o
      // modal nunca fecha sozinho ao conectar.
      if (data.action !== "update" || String(data.session.id) !== String(whatsAppId)) {
        return;
      }
      setQrCode(data.session.qrcode ?? "");
      if (data.session.qrcode === "") {
        onClose();
      }
    };

    return subscribeToSocket({ whatsappSession: handleSession });
  }, [whatsAppId, onClose]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{i18n.t("qrCode.message")}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center py-4">
          {qrCode
            ? <QRCode value={qrCode} size={256} />
            : <span className="text-muted-foreground text-sm">Aguardando QR Code...</span>
          }
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(QrcodeModal);
