import React from "react";
import { Edit, Trash2, ArrowRightLeft, Package } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { Can } from "../../../components/Can";
import { getBackendUrl } from "../../../helpers/urlUtils";
import type { User } from "../../../types/domain";
import type { ProductListItem } from "../inventoryTypes";
import { formatCents } from "../inventoryTypes";

function ProductThumbnail({ product }: { product: ProductListItem }) {
  return (
    <div className="h-9 w-9 shrink-0 rounded-md border border-border bg-muted flex items-center justify-center overflow-hidden">
      {product.imageUrl ? (
        <img
          src={getBackendUrl(product.imageUrl)}
          alt={product.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <Package className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

interface ProductsTableProps {
  products: ProductListItem[];
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  user: User | undefined;
  onEdit: (product: ProductListItem) => void;
  onDelete: (product: ProductListItem) => void;
  onMovement: (product: ProductListItem) => void;
}

function StockBadge({ product }: { product: ProductListItem }) {
  const isLow = product.currentBalance <= product.minQuantity && product.minQuantity > 0;
  return (
    <StatusChip
      status={isLow ? "warning" : "success"}
      dot
      label={`${product.currentBalance} ${product.unit}`}
    />
  );
}

export function ProductsTable({
  products,
  loading,
  error,
  onRetry,
  user,
  onEdit,
  onDelete,
  onMovement,
}: ProductsTableProps) {
  const columns: DataTableColumn<ProductListItem>[] = [
    {
      key: "name",
      header: "Produto",
      cell: (p) => (
        <div className="flex items-center gap-3">
          <ProductThumbnail product={p} />
          <span className="font-medium">{p.name}</span>
        </div>
      ),
    },
    { key: "skuCode", header: "SKU", cell: (p) => <span className="text-muted-foreground">{p.skuCode}</span> },
    { key: "price", header: "Preço", cell: (p) => (p.priceCents > 0 ? formatCents(p.priceCents) : "—") },
    { key: "stock", header: "Estoque", cell: (p) => <StockBadge product={p} /> },
    {
      key: "actions",
      header: "Ações",
      className: "text-right w-[140px]",
      cell: (product) => (
        <div className="flex items-center justify-end gap-1">
          <Can
            user={user}
            perform="inventory:manage"
            yes={() => (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Movimentar estoque"
                onClick={() => onMovement(product)}
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            )}
          />
          <Can
            user={user}
            perform="inventory:update"
            yes={() => (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(product)}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
          />
          <Can
            user={user}
            perform="inventory:delete"
            yes={() => (
              <Button variant="destructive-ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(product)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={products}
      getRowKey={(p) => p.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyTitle="Nenhum produto cadastrado"
      emptyDescription="Cadastre o primeiro produto para começar a controlar o estoque."
    />
  );
}
