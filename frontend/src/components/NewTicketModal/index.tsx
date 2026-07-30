import React, { useState, useEffect, useContext, useRef } from "react";
import { Contact } from "../../pages/Contacts/contactsTypes";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import ContactModal from "../ContactModal";

interface NewTicketModalProps {
  modalOpen: boolean;
  onClose: () => void;
}

const NewTicketModal = ({ modalOpen, onClose }: NewTicketModalProps) => {
  const navigate = useNavigate();
  const [options, setOptions] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newContact, setNewContact] = useState<{ name?: string }>({});
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const { user } = useContext(AuthContext);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!modalOpen || searchParam.length < 3) {
      setOptions([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("contacts", { params: { searchParam } });
        setOptions(data.contacts);
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchParam, modalOpen]);

  const handleClose = () => {
    onClose();
    setSearchParam("");
    setSelectedContact(null);
    setOptions([]);
  };

  const handleSaveTicket = async (contactId: number | string) => {
    if (!contactId) return;
    setLoading(true);
    try {
      const { data: ticket } = await api.post("/tickets", {
        contactId: contactId,
        userId: user.id,
        status: "open",
      });
      navigate(`/tickets/${ticket.id}`);
      handleClose();
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleAddNewContactTicket = (contact: { id?: number | string; name: string; number: string; email: string }) => {
    if (contact.id !== undefined) handleSaveTicket(contact.id);
  };

  return (
    <>
      <ContactModal
        open={contactModalOpen}
        initialValues={newContact}
        onClose={() => setContactModalOpen(false)}
        onSave={handleAddNewContactTicket}
      />

      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{i18n.t("newTicketModal.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1 relative">
              <Label>{i18n.t("newTicketModal.fieldLabel")}</Label>
              <div className="relative">
                <Input
                  autoFocus
                  placeholder="Buscar contato pelo nome ou número..."
                  value={searchParam}
                  onChange={(e) => {
                    setSearchParam(e.target.value);
                    if (selectedContact) setSelectedContact(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && selectedContact) {
                      e.preventDefault();
                      handleSaveTicket(selectedContact.id);
                    }
                  }}
                />
                {loading && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {/* Autocomplete Dropdown Customizado */}
              {(options.length > 0 || (searchParam.length >= 3 && !loading)) && !selectedContact && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                  {options.map((opt) => (
                    <div
                      key={opt.id}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-accent flex justify-between"
                      onClick={() => {
                        setSelectedContact(opt);
                        setSearchParam(opt.number ? `${opt.name} - ${opt.number}` : opt.name);
                        setOptions([]);
                      }}
                    >
                      <span>{opt.name}</span>
                      <span className="text-muted-foreground text-xs">{opt.number}</span>
                    </div>
                  ))}

                  {/* Opção Add New Contact */}
                  <div
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-accent text-primary font-medium border-t"
                    onClick={() => {
                      setNewContact({ name: searchParam });
                      setContactModalOpen(true);
                      setOptions([]);
                    }}
                  >
                    {i18n.t("newTicketModal.add")} "{searchParam}"
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              {i18n.t("newTicketModal.buttons.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => { if (selectedContact?.id !== undefined) handleSaveTicket(selectedContact.id); }}
              disabled={loading || !selectedContact}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {i18n.t("newTicketModal.buttons.ok")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NewTicketModal;
