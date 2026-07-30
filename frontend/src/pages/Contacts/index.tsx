/* @jsxImportSource react */
import React from "react";
import { Search, Plus, Download, List, LayoutGrid, Trash2 } from "lucide-react";

import { PageLayout, PageHeader, PageContent } from "../../components/ui/page-layout";
import ContactModal from "../../components/ContactModal";
import ConfirmationModal from "../../components/ConfirmationModal/";
import ClientModal from "../Clients/ClientModal";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { i18n } from "../../translate/i18n";

import { useContacts } from "./hooks/useContacts";
import ContactsTable from "./components/ContactsTable";
import ContactsCardGrid from "./components/ContactsCardGrid";
import ContactsBulkActionsBar from "./components/ContactsBulkActionsBar";

const Contacts: React.FC = () => {
  const {
    contacts,
    loading,
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
  } = useContacts();

  return (
    <PageLayout>
      <ContactModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        contactId={selectedContactId ?? undefined}
      />

      {clientModalOpen && (
        <ClientModal
          open={clientModalOpen}
          onClose={handleCloseClientModal}
          initialContact={selectedInitialContact ? { id: String(selectedInitialContact.id), name: selectedInitialContact.name, number: selectedInitialContact.number, email: selectedInitialContact.email } : undefined}
        />
      )}

      <ConfirmationModal
        title={i18n.t("contacts.confirmationModal.deleteTitle")}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleDeleteContact(selectedContactId!)}
      >
        {i18n.t("contacts.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <ConfirmationModal
        title={i18n.t("contacts.confirmationModal.importTitlte")}
        open={importConfirmOpen}
        onClose={() => setImportConfirmOpen(false)}
        onConfirm={handleImportContacts}
      >
        {i18n.t("contacts.confirmationModal.importMessage")}
      </ConfirmationModal>

      <ConfirmationModal
        title={i18n.t("contacts.confirmationModal.bulkDeleteTitle")}
        open={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDeleteContacts}
      >
        {i18n.t("contacts.confirmationModal.bulkDeleteMessage", { count: selectedIds.size })}
      </ConfirmationModal>

      <ConfirmationModal
        title={i18n.t("contacts.confirmationModal.deleteAllTitle")}
        open={deleteAllConfirmOpen}
        onClose={() => setDeleteAllConfirmOpen(false)}
        onConfirm={handleDeleteAllContacts}
      >
        {i18n.t("contacts.confirmationModal.deleteAllMessage")}
      </ConfirmationModal>

      <PageHeader
        title={i18n.t("contacts.title") as string}
        description={`${contacts.length} contatos encontrados`}
      >
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-sm hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={i18n.t("contacts.searchPlaceholder") as string}
              value={searchParam}
              onChange={handleSearch}
              className="pl-9 h-10"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setImportConfirmOpen(true)}
            className="hidden sm:flex"
          >
            <Download className="mr-2 h-4 w-4" />
            {i18n.t("contacts.buttons.import")}
          </Button>

          <Button size="sm" onClick={handleOpenContactModal}>
            <Plus className="mr-2 h-4 w-4" />
            {i18n.t("contacts.buttons.add")}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:flex text-destructive hover:text-destructive"
            onClick={() => setDeleteAllConfirmOpen(true)}
            disabled={contacts.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {i18n.t("contacts.buttons.deleteAll")}
          </Button>

          <div className="flex items-center border rounded-md p-1 bg-muted/50">
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-sm"
              onClick={() => setView("table")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "card" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-sm"
              onClick={() => setView("card")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PageHeader>

      <PageContent onScroll={handleScroll}>
        <ContactsBulkActionsBar
          selectedCount={selectedIds.size}
          onDeleteSelected={() => setBulkDeleteConfirmOpen(true)}
          onDeselectAll={clearSelection}
        />
        {view === "table" ? (
          <ContactsTable
            contacts={contacts}
            loading={loading}
            onStartChat={handleSaveTicket}
            onEdit={handleEditContact}
            onMakeClient={handleOpenClientModal}
            onDelete={handleRequestDelete}
            selectedIds={selectedIds}
            isAllSelected={isAllSelected}
            onToggleSelected={toggleSelected}
            onToggleSelectAll={toggleSelectAll}
          />
        ) : (
          <ContactsCardGrid
            contacts={contacts}
            loading={loading}
            onStartChat={handleSaveTicket}
            onEdit={handleEditContact}
            onMakeClient={handleOpenClientModal}
            onDelete={handleRequestDelete}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
          />
        )}
      </PageContent>
    </PageLayout>
  );
};

export default Contacts;


