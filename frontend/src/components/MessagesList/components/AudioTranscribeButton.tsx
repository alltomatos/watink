import React, { useState } from "react";
import { Captions, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../../services/api";
import { Message } from "../types";

interface Props {
  message: Message;
  onTranscribed: (text: string) => void;
}

interface TranscribeResponse {
  success: boolean;
  transcription?: string;
  error?: string;
}

/**
 * Button rendered below an audio bubble. Transcription is always ON DEMAND —
 * clicking is the only trigger, nothing runs automatically on receipt. The
 * backend (POST /messages/:id/transcribe) only persists the text and emits an
 * appMessage update — it never sends anything back to WhatsApp.
 */
const AudioTranscribeButton: React.FC<Props> = ({ message, onTranscribed }) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data } = await api.post<TranscribeResponse>(
        `/message/${message.id}/transcribe`
      );
      if (data.success && data.transcription) {
        onTranscribed(data.transcription);
      } else {
        toast.error(data.error ?? "Não foi possível transcrever o áudio");
      }
    } catch (err) {
      const apiError =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error;
      toast.error(apiError ?? "Não foi possível transcrever o áudio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="mt-1 flex items-center gap-1.5 text-xs text-[var(--action-primary)] hover:underline disabled:opacity-60 disabled:no-underline"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Captions className="h-3.5 w-3.5" />
      )}
      {loading ? "Transcrevendo…" : "Transcrever áudio"}
    </button>
  );
};

export default AudioTranscribeButton;
