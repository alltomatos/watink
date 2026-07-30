import React from "react";
import { useNavigate, useParams } from "react-router";
import { parseISO, format, isSameDay } from "date-fns";
import { Users, Building2, Radio } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import TagChip from "../TagChip";
import MarkdownWrapper from "../MarkdownWrapper";
import { getBackendUrl } from "../../helpers/urlUtils";
import { getContactDisplayName } from "../../utils/clientDisplayName";

interface Queue {
  color?: string;
}

interface WhatsApp {
  name?: string;
  status?: string;
}

interface Contact {
  id?: number;
  name: string;
  profilePicUrl?: string | null;
  isGroup?: boolean;
  number?: string;
  client?: { id: number; socialName?: string | null } | null;
}

interface Tag {
  id: number;
  name: string;
  color?: string;
}

interface Ticket {
  id: number;
  status: "open" | "closed" | "pending";
  updatedAt: string;
  lastMessage?: string;
  unreadMessages: number;
  isGroup?: boolean;
  isCommunity?: boolean;
  isSubGroup?: boolean;
  isNewsletter?: boolean;
  whatsappId?: number;
  contact: Contact;
  queue?: Queue;
  whatsapp?: WhatsApp;
  tags?: Tag[];
}

interface TicketListItemProps {
  ticket: Ticket;
}

const TicketListItem: React.FC<TicketListItemProps> = ({ ticket }) => {
  const navigate = useNavigate();
  const { ticketId } = useParams<{ ticketId: string }>();

  const handleSelectTicket = (id: number) => {
    navigate(`/tickets/${id}`);
  };

  const isSelected = ticketId !== undefined && +ticketId === ticket.id;

  // Tipo de conversa para badge no avatar
  const ticketType: "community" | "group" | "newsletter" | "individual" =
    ticket.isCommunity || ticket.isSubGroup
      ? "community"
      : ticket.isNewsletter
      ? "newsletter"
      : ticket.isGroup || ticket.contact?.isGroup
      ? "group"
      : "individual";

  const updatedAt = ticket.updatedAt ? parseISO(ticket.updatedAt) : new Date();
  const isValidDate = !isNaN(updatedAt.getTime());
  const timeLabel = isValidDate
    ? isSameDay(updatedAt, new Date())
      ? format(updatedAt, "HH:mm")
      : format(updatedAt, "dd/MM")
    : "";

  return (
    <div
      onClick={() => handleSelectTicket(ticket.id)}
      className={cn(
        "relative flex cursor-pointer gap-3 px-4 py-2.5",
        "border-b border-black/[0.04]",
        "transition-colors duration-150",
        isSelected
          ? "bg-primary/[0.08]"
          : "bg-transparent hover:bg-muted/40"
      )}
    >
      {/* Indicador de fila — borda esquerda colorida */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{
          backgroundColor: isSelected
            ? "var(--color-info)"
            : ticket.queue?.color ?? "transparent",
        }}
      />

      {/* Avatar circular + badge de tipo */}
      <div className="relative shrink-0">
        <Avatar
          src={
            ticket.contact?.profilePicUrl
              ? getBackendUrl(ticket.contact?.profilePicUrl)
              : null
          }
          name={getContactDisplayName(ticket.contact)}
          size="md"
          isGroup={ticket.isGroup || ticket.contact?.isGroup}
          aria-label={getContactDisplayName(ticket.contact)}
        />
        {ticketType !== "individual" && (
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-background",
            ticketType === "community" && "bg-violet-500",
            ticketType === "newsletter" && "bg-sky-500",
            ticketType === "group" && "bg-emerald-500",
          )}>
            {ticketType === "community" && <Building2 className="h-2.5 w-2.5 text-white" />}
            {ticketType === "newsletter" && <Radio className="h-2.5 w-2.5 text-white" />}
            {ticketType === "group" && <Users className="h-2.5 w-2.5 text-white" />}
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        {/* Linha 1 — nome + horário */}
        <div className="flex items-baseline justify-between">
          <span className="truncate text-[0.8125rem] font-semibold leading-tight text-foreground">
            {getContactDisplayName(ticket.contact)}
          </span>
          <span className="ml-2 shrink-0 text-[0.6875rem] text-muted-foreground">
            {timeLabel}
          </span>
        </div>

        {/* Linha 2 — prévia + badge não lidas */}
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[0.75rem] leading-4 text-muted-foreground pointer-events-none select-none">
            {ticket.lastMessage ? (
              <MarkdownWrapper>{ticket.lastMessage}</MarkdownWrapper>
            ) : (
              "Sem mensagens"
            )}
          </span>

          {ticket.unreadMessages > 0 && (
            <Badge
              className={cn(
                "ml-auto min-w-[18px] shrink-0 justify-center",
                "rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold",
                "border-transparent bg-primary text-primary-foreground",
                "hover:bg-primary"
              )}
            >
              {ticket.unreadMessages}
            </Badge>
          )}
        </div>

        {/* Linha 3 — badge da conexão + tags */}
        {(ticket.whatsapp?.name || (ticket.tags && ticket.tags.length > 0)) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {ticket.whatsapp?.name && (
              <span className="self-start rounded px-1.5 py-px text-[0.625rem] font-semibold bg-muted text-muted-foreground">
                {ticket.whatsapp.name}
              </span>
            )}
            {ticket.tags?.map((tag) => (
              <TagChip key={tag.id} tag={tag} size="small" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketListItem;
