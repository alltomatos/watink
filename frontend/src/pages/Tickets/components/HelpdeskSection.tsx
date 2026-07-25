import React, { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import pluginApi from "../../../services/pluginApi";
import ProtocolModal from "../../Helpdesk/ProtocolModal";

interface HelpdeskSectionProps {
  contactId: number;
  contactName: string;
  ticketId?: number;
}

const HelpdeskSection: React.FC<HelpdeskSectionProps> = ({ contactId, contactName, ticketId }) => {
  const [helpdeskActive, setHelpdeskActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const fetchPlugins = async () => {
      try {
        const { data } = await pluginApi.get("/plugins/installed");
        setHelpdeskActive((data.active || []).includes("helpdesk"));
      } catch {
        setHelpdeskActive(false);
      }
    };
    fetchPlugins();
  }, []);

  if (!helpdeskActive) return null;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Ticket className="w-3 h-3" />
          Helpdesk
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs w-fit"
          onClick={() => setModalOpen(true)}
        >
          <Ticket className="w-3.5 h-3.5" />
          Abrir Protocolo
        </Button>
      </div>

      <ProtocolModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialContactId={contactId}
        initialContactName={contactName}
        initialTicketId={ticketId}
      />
    </>
  );
};

export default HelpdeskSection;
