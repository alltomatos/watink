import React from "react";
import { parseISO, format } from "date-fns";
import { Clock, Check, CheckCheck, AlertCircle } from "lucide-react";
import { isDateValid } from "../utils/messageHelpers";
import { Message } from "../types";

interface AckProps {
  message: Message;
  isGroup?: boolean;
}

export const MessageAck: React.FC<AckProps & { onRetry?: () => void }> = ({ message, isGroup, onRetry }) => {
  if (!message.fromMe) return null;
  // In groups, per-recipient delivered/read is ambiguous, so the sent/delivered/
  // read ticks are hidden — but a hard send failure (ack 5) must still surface.
  if (isGroup && message.ack !== 5) return null;
  if (message.ack === 0)
    return <Clock className="inline h-[18px] w-[18px] align-middle ml-1" />;
  if (message.ack === 1)
    return <Check className="inline h-[18px] w-[18px] align-middle ml-1" />;
  if (message.ack === 2)
    return (
      <CheckCheck className="inline h-[18px] w-[18px] align-middle ml-1" />
    );
  if (message.ack === 3 || message.ack === 4)
    return (
      <CheckCheck className="inline h-[18px] w-[18px] align-middle ml-1 text-[var(--action-primary)]" />
    );
  if (message.ack === 5)
    return (
      <span
        title="Erro ao enviar — clique para tentar novamente"
        onClick={onRetry}
        className="inline-flex cursor-pointer hover:opacity-70"
      >
        <AlertCircle className="inline h-[18px] w-[18px] align-middle ml-1 text-[hsl(var(--message-error-text))]" />
      </span>
    );
  return null;
};

interface TimestampProps {
  message: Message;
  isGroup?: boolean;
  onRetry?: () => void;
}

const MessageMetadata: React.FC<TimestampProps> = ({ message, isGroup, onRetry }) => {
  if (!isDateValid(message.createdAt)) return null;
  return (
    <span className="text-[11px] absolute bottom-0 right-1.5 text-[hsl(var(--message-timestamp-text))]">
      {format(parseISO(message.createdAt), "HH:mm")}
      <MessageAck message={message} isGroup={isGroup} onRetry={onRetry} />
    </span>
  );
};

export default MessageMetadata;
