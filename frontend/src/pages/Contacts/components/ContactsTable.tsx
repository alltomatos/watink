import React from "react";
import { Loader2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Avatar } from "../../../components/ui/avatar";
import { i18n } from "../../../translate/i18n";
import { getBackendUrl } from "../../../helpers/urlUtils";
import { Contact } from "../contactsTypes";
import ContactStatusBadge from "./ContactStatusBadge";
import ContactActionsMenu from "./ContactActionsMenu";

interface ContactsTableProps {
  contacts: Contact[];
  loading: boolean;
  onStartChat: (contactId: number) => void;
  onEdit: (contactId: number) => void;
  onMakeClient: (contact: Contact) => void;
  onDelete: (contactId: number) => void;
}

const ContactsTable: React.FC<ContactsTableProps> = ({
  contacts,
  loading,
  onStartChat,
  onEdit,
  onMakeClient,
  onDelete,
}) => {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]"></TableHead>
            <TableHead>{i18n.t("contacts.table.name")}</TableHead>
            <TableHead>{i18n.t("contacts.table.number")}</TableHead>
            <TableHead>{i18n.t("contacts.table.email")}</TableHead>
            <TableHead className="text-right">{i18n.t("contacts.table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              </TableCell>
            </TableRow>
          ) : contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                {i18n.t("contacts.table.empty")}
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((contact) => (
              <TableRow key={contact.id} className="group">
                <TableCell>
                  <Avatar
                    src={getBackendUrl(contact.profilePicUrl)}
                    name={contact.name}
                    size="sm"
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {contact.name}
                    <ContactStatusBadge contact={contact} />
                  </div>
                </TableCell>
                <TableCell>{contact.number}</TableCell>
                <TableCell>{contact.email}</TableCell>
                <TableCell className="text-right">
                  <ContactActionsMenu
                    contact={contact}
                    onStartChat={onStartChat}
                    onEdit={onEdit}
                    onMakeClient={onMakeClient}
                    onDelete={onDelete}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ContactsTable;
