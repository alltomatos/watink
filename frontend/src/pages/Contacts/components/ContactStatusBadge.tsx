import React from "react";
import { Users } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Contact } from "../contactsTypes";

interface ContactStatusBadgeProps {
  contact: Contact;
}

const ContactStatusBadge: React.FC<ContactStatusBadgeProps> = ({ contact }) => {
  if (contact.isGroup || contact.number?.includes("@g.us")) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge variant="secondary">Grupo</Badge>
        {typeof contact.groupParticipantCount === "number" && (
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {contact.groupParticipantCount}
          </Badge>
        )}
      </span>
    );
  }
  if (contact.lid) {
    return (
      <Badge variant="outline" className="text-green-600 border-green-300">
        Verificado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Pendente
    </Badge>
  );
};

export default ContactStatusBadge;
