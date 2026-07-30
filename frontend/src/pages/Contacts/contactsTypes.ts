import type React from "react";

export interface Contact {
  id: number;
  name: string;
  number: string;
  email: string;
  profilePicUrl?: string;
  isGroup?: boolean;
  lid?: string;
}

export type ContactsAction =
  | { type: "LOAD_CONTACTS"; payload: Contact[] }
  | { type: "UPDATE_CONTACTS"; payload: Contact }
  | { type: "DELETE_CONTACT"; payload: number }
  | { type: "RESET" };

export type ContactsView = "table" | "card";

export interface UseContactsReturn {
  contacts: Contact[];
  loading: boolean;
  hasMore: boolean;
  searchParam: string;
  view: ContactsView;
  selectedContactId: number | null;
  contactModalOpen: boolean;
  clientModalOpen: boolean;
  selectedInitialContact: Contact | null;
  confirmOpen: boolean;
  importConfirmOpen: boolean;
  setView: (v: ContactsView) => void;
  setConfirmOpen: (v: boolean) => void;
  setImportConfirmOpen: (v: boolean) => void;
  handleSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleOpenContactModal: () => void;
  handleCloseContactModal: () => void;
  handleOpenClientModal: (contact: Contact) => void;
  handleCloseClientModal: () => void;
  handleEditContact: (contactId: number) => void;
  handleSaveTicket: (contactId: number) => Promise<void>;
  handleDeleteContact: (contactId: number) => Promise<void>;
  handleImportContacts: () => Promise<void>;
  handleRequestDelete: (contactId: number) => void;

  // Seleção em massa (bulk-delete / limpar base)
  selectedIds: Set<number>;
  isAllSelected: boolean;
  bulkDeleteConfirmOpen: boolean;
  deleteAllConfirmOpen: boolean;
  toggleSelected: (contactId: number) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  setBulkDeleteConfirmOpen: (v: boolean) => void;
  setDeleteAllConfirmOpen: (v: boolean) => void;
  handleBulkDeleteContacts: () => Promise<void>;
  handleDeleteAllContacts: () => Promise<void>;
}
