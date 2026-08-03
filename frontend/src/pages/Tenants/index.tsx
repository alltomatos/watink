/* @jsxImportSource react */
import React from "react";
import { Building2, Plus } from "lucide-react";

import TenantModal from "../../components/TenantModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { PageContainer, PageHeader, PageContent } from "../../components/ui/page-layout";
import { Button } from "../../components/ui/button";

import { useTenants } from "./hooks/useTenants";
import TenantsTable from "./components/TenantsTable";
import { Tenant } from "./tenantsTypes";

const Tenants: React.FC = () => {
  const {
    tenants,
    loading,
    tenantModalOpen,
    selectedTenantId,
    confirmModalOpen,
    deletingTenant,
    handleOpenTenantModal,
    handleCloseTenantModal,
    handleEditTenant,
    handleDeleteTenant,
    setConfirmModalOpen,
    setDeletingTenant,
  } = useTenants();

  const handleRequestDelete = (tenant: Tenant) => {
    setDeletingTenant(tenant);
    setConfirmModalOpen(true);
  };

  return (
    <PageContainer>
      <ConfirmationModal
        title={deletingTenant ? `Excluir "${deletingTenant.name}"?` : "Excluir tenant?"}
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={() => deletingTenant && handleDeleteTenant(deletingTenant.id)}
      >
        Todos os dados relacionados serão perdidos. Esta ação não pode ser desfeita.
      </ConfirmationModal>

      <TenantModal
        open={tenantModalOpen}
        onClose={handleCloseTenantModal}
        tenantId={selectedTenantId ?? undefined}
      />

      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Tenants
          </span>
        }
        description="Gerencie os tenants cadastrados na plataforma"
      >
        <Button onClick={handleOpenTenantModal}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Tenant
        </Button>
      </PageHeader>

      <PageContent>
        <TenantsTable
          tenants={tenants}
          loading={loading}
          onEdit={handleEditTenant}
          onDelete={handleRequestDelete}
        />
      </PageContent>
    </PageContainer>
  );
};

export default Tenants;
