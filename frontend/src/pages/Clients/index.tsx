/* @jsxImportSource react */
import React, { useContext } from "react";
import { Search, Plus } from "lucide-react";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "../../components/Can";
import { AuthContext } from "../../context/Auth/AuthContext";
import ClientModal from "./ClientModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { ClientsTable } from "./components/ClientsTable";
import { useClients } from "./hooks/useClients";

const Clients: React.FC = () => {
  const { user } = useContext(AuthContext);
  const {
    clients,
    loading,
    searchParam,
    setSearchParam,
    modalOpen,
    selectedClient,
    confirmDeleteOpen,
    clientToDelete,
    handleOpenModal,
    handleCloseModal,
    handleDeleteClick,
    handleConfirmDelete,
    setConfirmDeleteOpen,
  } = useClients();

  return (
    <Can
      user={user}
      perform="clients:read"
      yes={() => (
        <PageContainer>
          <PageHeader title="👥 Clientes">
            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, documento ou email..."
                  value={searchParam}
                  onChange={(e) => setSearchParam(e.target.value)}
                  className="pl-9 h-10 w-64"
                />
              </div>
              <Can
                user={user}
                perform="clients:create"
                yes={() => (
                  <Button onClick={() => handleOpenModal()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Cliente
                  </Button>
                )}
              />
            </div>
          </PageHeader>

          <PageContent className="p-0">
            <div className="p-6">
              <ClientsTable
                clients={clients}
                loading={loading}
                user={user}
                onEdit={handleOpenModal}
                onDelete={handleDeleteClick}
              />
            </div>
          </PageContent>

          <ClientModal
            open={modalOpen}
            onClose={handleCloseModal}
            client={selectedClient}
          />

          <ConfirmationModal
            title="Excluir Cliente"
            open={confirmDeleteOpen}
            onClose={() => setConfirmDeleteOpen(false)}
            onConfirm={handleConfirmDelete}
          >
            {clientToDelete
              ? `Deseja realmente excluir o cliente "${clientToDelete.name}"?`
              : ""}
          </ConfirmationModal>
        </PageContainer>
      )}
      no={() => (
        <PageContainer>
          <PageContent>
            <p className="text-center text-muted-foreground py-16">
              Você não tem permissão para visualizar esta página.
            </p>
          </PageContent>
        </PageContainer>
      )}
    />
  );
};

export default Clients;