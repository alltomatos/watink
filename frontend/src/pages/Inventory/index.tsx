/* @jsxImportSource react */
import React, { useContext } from "react";
import { useNavigate } from "react-router";
import { Search, Plus, Package } from "lucide-react";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "../../components/Can";
import { AuthContext } from "../../context/Auth/AuthContext";
import MovementModal from "./MovementModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { ProductsTable } from "./components/ProductsTable";
import { useInventory } from "./hooks/useInventory";
import type { ProductListItem } from "./inventoryTypes";

const Inventory: React.FC = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const {
    products,
    loading,
    error,
    searchParam,
    setSearchParam,
    confirmDeleteOpen,
    productToDelete,
    handleDeleteClick,
    handleConfirmDelete,
    setConfirmDeleteOpen,
    movementModalOpen,
    productForMovement,
    handleOpenMovementModal,
    handleCloseMovementModal,
    handleRegisterMovement,
    reload,
  } = useInventory();

  const handleEdit = (product: ProductListItem) => {
    navigate(`/inventory/products/${product.id}/edit`);
  };

  return (
    <Can
      user={user}
      perform="inventory:read"
      yes={() => (
        <PageContainer>
          <PageHeader
            title={
              <span className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                Estoque
              </span>
            }
          >
            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou código..."
                  value={searchParam}
                  onChange={(e) => setSearchParam(e.target.value)}
                  className="pl-9 h-10 w-64"
                />
              </div>
              <Can
                user={user}
                perform="inventory:create"
                yes={() => (
                  <Button onClick={() => navigate("/inventory/products/new")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Produto
                  </Button>
                )}
              />
            </div>
          </PageHeader>

          <PageContent className="p-0">
            <div className="p-6">
              <ProductsTable
                products={products}
                loading={loading}
                error={error}
                onRetry={reload}
                user={user}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onMovement={handleOpenMovementModal}
              />
            </div>
          </PageContent>

          <MovementModal
            open={movementModalOpen}
            onClose={handleCloseMovementModal}
            product={productForMovement}
            onSubmit={handleRegisterMovement}
          />

          <ConfirmationModal
            title="Excluir Produto"
            open={confirmDeleteOpen}
            onClose={() => setConfirmDeleteOpen(false)}
            onConfirm={handleConfirmDelete}
          >
            {productToDelete
              ? `Deseja realmente excluir o produto "${productToDelete.name}"?`
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

export default Inventory;
