import React from "react";
import { useParams } from "react-router";
import { cn } from "@/lib/utils";
import { i18n } from "../../translate/i18n";

import TicketsManager from "@/components/TicketsManager/";
import Ticket from "@/components/Ticket/";
import DetailsPanel from "./components/DetailsPanel";
import { useTickets } from "./hooks/useTickets";

/* ─── Tickets Page (orquestrador) ───────────────────────────────────── */
const Tickets: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { hasOpenTicket, detailTicket, detailLoading, showDetails, setShowDetails } =
    useTickets(ticketId);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Coluna 1: Lista de Tickets */}
      <div
        className={cn(
          "flex-col border-r border-border md:flex md:w-[290px] shrink-0",
          hasOpenTicket ? "hidden md:flex" : "flex w-full"
        )}
      >
        <TicketsManager />
      </div>

      {/* Coluna 2: Chat */}
      <div
        className={cn(
          "flex-col bg-background min-w-0 min-h-0 overflow-hidden",
          hasOpenTicket ? "flex flex-1" : "hidden md:flex md:flex-1"
        )}
      >
        {ticketId ? (
          <Ticket
            onToggleDetails={() => setShowDetails(!showDetails)}
            showDetails={showDetails}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {i18n.t("chat.noTicketMessage")}
          </div>
        )}
      </div>

      {/* Coluna 3: Detalhes */}
      {showDetails && (
        <div className="hidden w-[280px] shrink-0 border-l border-border lg:flex flex-col">
          <DetailsPanel
            ticket={detailTicket}
            loading={detailLoading && !!ticketId}
            onClose={() => setShowDetails(false)}
          />
        </div>
      )}
    </div>
  );
};

export default Tickets;
