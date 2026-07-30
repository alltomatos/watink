import React, { useState, useEffect, useReducer, useContext } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";

import api from "../../../services/api";
import { subscribeToSocket } from "../../../services/sse-client";
import { i18n } from "../../../translate/i18n";
import toastError from "../../../errors/toastError";
import { AuthContext } from "../../../context/Auth/AuthContext";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { Contact, ContactsView, UseContactsReturn } from "../contactsTypes";
import { contactsReducer } from "./contactsReducer";

export type { UseContactsReturn };

export function useContacts(): UseContactsReturn {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, dispatch] = useReducer(contactsReducer, []);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [selectedInitialContact, setSelectedInitialContact] = useState<Contact | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [view, setView] = useLocalStorage<ContactsView>("contactsView", "table");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
    setSelectedIds(new Set());
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/contacts/", {
          params: { searchParam, pageNumber },
        });
        dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
        setHasMore(data.hasMore);
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const handleContact = (data: { action: string; contact?: Contact; contactId?: string }) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTS", payload: data.contact! });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACT", payload: Number(data.contactId) });
      }
    };
    return subscribeToSocket({ contact: handleContact });
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchParam(e.target.value.toLowerCase());
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + clientHeight) < 100) {
      setPageNumber((prev) => prev + 1);
    }
  };

  const handleOpenContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
  };

  const handleEditContact = (contactId: number) => {
    setSelectedContactId(contactId);
    setContactModalOpen(true);
  };

  const handleOpenClientModal = (contact: Contact) => {
    setSelectedInitialContact(contact);
    setClientModalOpen(true);
  };

  const handleCloseClientModal = () => {
    setClientModalOpen(false);
    setSelectedInitialContact(null);
  };

  const handleRequestDelete = (contactId: number) => {
    setSelectedContactId(contactId);
    setConfirmOpen(true);
  };

  const handleSaveTicket = async (contactId: number) => {
    if (!contactId) return;
    setLoading(true);
    try {
      const { data: ticket } = await api.post("/tickets", {
        contactId,
        userId: user?.id,
        status: "open",
      });
      navigate(`/tickets/${ticket.id}`);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!contactId) return;
    try {
      await api.delete(`/contacts/${contactId}`);
      toast.success(i18n.t("contacts.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setSelectedContactId(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const handleImportContacts = async () => {
    try {
      await api.post("/contacts/import");
      toast.success(i18n.t("contacts.toasts.importSuccess"));
      setSearchParam("");
      setPageNumber(1);
    } catch (err) {
      toastError(err);
    }
  };

  const toggleSelected = (contactId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const isAllSelected = contacts.length > 0 && selectedIds.size === contacts.length;

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (prev.size === contacts.length) return new Set();
      return new Set(contacts.map((c) => c.id));
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDeleteContacts = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await api.post("/contacts/bulk-delete", { ids });
      ids.forEach((id) => dispatch({ type: "DELETE_CONTACT", payload: id }));
      toast.success(i18n.t("contacts.toasts.bulkDeleted", { count: ids.length }));
    } catch (err) {
      toastError(err);
    } finally {
      clearSelection();
    }
  };

  const handleDeleteAllContacts = async () => {
    try {
      await api.delete("/contacts/all");
      dispatch({ type: "RESET" });
      toast.success(i18n.t("contacts.toasts.allDeleted"));
    } catch (err) {
      toastError(err);
    } finally {
      clearSelection();
      setSearchParam("");
      setPageNumber(1);
    }
  };

  return {
    contacts,
    loading,
    hasMore,
    searchParam,
    view,
    selectedContactId,
    contactModalOpen,
    clientModalOpen,
    selectedInitialContact,
    confirmOpen,
    importConfirmOpen,
    setView,
    setConfirmOpen,
    setImportConfirmOpen,
    handleSearch,
    handleScroll,
    handleOpenContactModal,
    handleCloseContactModal,
    handleOpenClientModal,
    handleCloseClientModal,
    handleEditContact,
    handleSaveTicket,
    handleDeleteContact,
    handleImportContacts,
    handleRequestDelete,
    selectedIds,
    isAllSelected,
    bulkDeleteConfirmOpen,
    deleteAllConfirmOpen,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
    setBulkDeleteConfirmOpen,
    setDeleteAllConfirmOpen,
    handleBulkDeleteContacts,
    handleDeleteAllContacts,
  };
}
