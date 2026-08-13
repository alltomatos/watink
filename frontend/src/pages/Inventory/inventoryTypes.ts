// Mirrors controllers.productListItem (business/internal/controllers/inventory.go) —
// the flattened Modo Simples read model (Product + primary SKU + preço base +
// saldo no Armazém Principal).
export interface ProductListItem {
  id: number;
  name: string;
  unit: string;
  categoryId: number | null;
  imageUrl: string | null;
  skuId: number;
  skuCode: string;
  minQuantity: number;
  priceCents: number;
  currentBalance: number;
}

export interface ProductFormData {
  name: string;
  unit: string;
  skuCode: string;
  minQuantity: string;
  priceReais: string;
  initialStock: string;
}

export const emptyProductForm: ProductFormData = {
  name: "",
  unit: "UN",
  skuCode: "",
  minQuantity: "0",
  priceReais: "",
  initialStock: "0",
};

export function productToFormData(product: ProductListItem): ProductFormData {
  return {
    name: product.name,
    unit: product.unit,
    skuCode: product.skuCode,
    minQuantity: String(product.minQuantity ?? 0),
    priceReais: product.priceCents > 0 ? (product.priceCents / 100).toFixed(2) : "",
    initialStock: "0",
  };
}

export function reaisToCents(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(normalized);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const UNIT_OPTIONS = [
  { value: "UN", label: "Unidade (UN)" },
  { value: "KG", label: "Quilograma (KG)" },
  { value: "L", label: "Litro (L)" },
];
