import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "react-toastify";

import { subscribeToSocket } from "../../services/sse-client";
import MessageInput from "../MessageInput/";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import TicketActionButtons from "../TicketActionButtons";
import MessagesList from "../MessagesList";
import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import toastError from "../../errors/toastError";

interface Contact {
  id?: number;
  name: string;
  profilePicUrl?: string | null;
  isGroup?: boolean;
  number?: string;
}

interface WhatsApp {
  name?: string;
  status?: string;
}

interface TicketUser {
  id: number;
  name: string;
}

interface TicketData {
  id: number;
  status: "open" | "closed" | "pending";
  isGroup?: boolean;
  whatsappId?: number;
  contact: Contact;
  user?: TicketUser | null;
  whatsapp?: WhatsApp;
}

interface TicketProps {
  onToggleDetails?: () => void;
  showDetails?: boolean;
}

const Ticket: React.FC<TicketProps> = ({ onToggleDetails, showDetails }) => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<Contact>({} as Contact);
  const [ticket, setTicket] = useState<TicketData>({} as TicketData);

  const fetchTicket = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/tickets/${ticketId}`);
      setContact(data.contact);
      setTicket(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchTicket, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    const handleTicket = (data: { action: string; ticket?: TicketData; ticketId?: number }) => {
      const incomingId = data.ticket?.id ?? data.ticketId;
      if (incomingId && Number(incomingId) !== Number(ticketId)) return;
      if (data.action === "update" && data.ticket) {
        setTicket((prev) => ({
          ...prev,
          ...data.ticket,
          status: data.ticket!.status ?? prev.status,
          contact: data.ticket!.contact ?? prev.contact,
        }));
      }
      if (data.action === "delete") {
        toast.success("Ticket deleted sucessfully.");
        navigate("/tickets");
      }
    };

    const handleContact = (data: { action: string; contact?: Contact }) => {
      if (data.action === "update" && data.contact) {
        setContact((prev) => {
          if (prev.id === data.contact!.id) {
            return { ...prev, ...data.contact };
          }
          return prev;
        });
      }
    };

    return subscribeToSocket(
      { ticket: handleTicket, contact: handleContact },
      (socket) => socket.emit("joinChat", ticketId)
    );
  }, [ticketId, navigate]);

  /* Clicking the contact name/avatar in the header opens Coluna 3 if hidden */
  const handleContactClick = () => {
    if (!showDetails && onToggleDetails) {
      onToggleDetails();
    }
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <TicketHeader loading={loading}>
        <div className="max-w-[80%] basis-[80%] md:max-w-[50%] md:basis-[50%]">
          <TicketInfo
            contact={contact}
            ticket={ticket}
            onClick={handleContactClick}
          />
        </div>
        <div className="flex max-w-full basis-full mb-[5px] md:max-w-[50%] md:basis-[50%] md:mb-0">
          <TicketActionButtons
            ticket={ticket}
            onToggleDetails={onToggleDetails}
            showDetails={showDetails}
            onAccepted={fetchTicket}
          />
        </div>
      </TicketHeader>

      <ReplyMessageProvider>
        <MessagesList ticketId={ticketId ?? ""} isGroup={ticket.isGroup} />
        <MessageInput
          ticketStatus={ticket.status}
          whatsappStatus={ticket.whatsapp?.status}
        />
      </ReplyMessageProvider>
    </div>
  );
};

export default Ticket;
