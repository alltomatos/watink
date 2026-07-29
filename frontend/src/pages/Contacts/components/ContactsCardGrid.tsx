import React, { useContext } from "react";
import { MessageSquare, Edit, Plus, Trash2, Loader2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Can } from "../../../components/Can";
import { AuthContext } from "../../../context/Auth/AuthContext";
import ListItemCard from "../../../components/ListItemCard";
import { getBackendUrl } from "../../../helpers/urlUtils";
import { Contact } from "../contactsTypes";
import ContactStatusBadge from "./ContactStatusBadge";

interface ContactsCardGridProps {
  contacts: Contact[];
  loading: boolean;
  onStartChat: (contactId: number) => void;
  onEdit: (contactId: number) => void;
  onMakeClient: (contact: Contact) => void;
  onDelete: (contactId: number) => void;
  selectedIds: Set<number>;
  onToggleSelected: (contactId: number) => void;
}

const ContactsCardGrid: React.FC<ContactsCardGridProps> = ({
  contacts,
  loading,
  onStartChat,
  onEdit,
  onMakeClient,
  onDelete,
  selectedIds,
  onToggleSelected,
}) => {
  const { user } = useContext(AuthContext);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
      {contacts.map((contact) => (
        <ListItemCard
          key={contact.id}
          avatar={getBackendUrl(contact.profilePicUrl)}
          title={contact.name}
          subtitle={contact.number}
          status={<ContactStatusBadge contact={contact} />}
          leading={
            <Checkbox
              checked={selectedIds.has(contact.id)}
              onCheckedChange={() => onToggleSelected(contact.id)}
              aria-label={contact.name}
            />
          }
          actions={
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onStartChat(contact.id)}
              >
                <MessageSquare className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(contact.id)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onMakeClient(contact)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Can
                user={user}
                perform="contacts-page:deleteContact"
                yes={() => (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => onDelete(contact.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              />
            </div>
          }
        />
      ))}
      {loading && (
        <div className="col-span-full flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
};

export default ContactsCardGrid;
