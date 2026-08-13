import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import api from "../../../services/api";
import type { ProductListItem } from "../inventoryTypes";

interface UseInventoryReturn {
  products: ProductListItem[];
  loading: boolean;
  error: boolean;
  searchParam: string;
  setSearchParam: (value: string) => void;
  confirmDeleteOpen: boolean;
  productToDelete: ProductListItem | null;
  handleDeleteClick: (product: ProductListItem) => void;
  handleConfirmDelete: () => Promise<void>;
  setConfirmDeleteOpen: (open: boolean) => void;
  movementModalOpen: boolean;
  productForMovement: ProductListItem | null;
  handleOpenMovementModal: (product: ProductListItem) => void;
  handleCloseMovementModal: () => void;
  handleRegisterMovement: (type: "in" | "out", quantity: number) => Promise<boolean>;
  reload: () => void;
}

export function useInventory(): UseInventoryReturn {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductListItem | null>(null);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [productForMovement, setProductForMovement] = useState<ProductListItem | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const { data } = await api.get<{ products: ProductListItem[] }>("/inventory/products");
      setProducts(data.products ?? []);
    } catch {
      setError(true);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = searchParam.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchParam.toLowerCase()) ||
          p.skuCode.toLowerCase().includes(searchParam.toLowerCase())
      )
    : products;

  const handleDeleteClick = (product: ProductListItem) => {
    setProductToDelete(product);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/inventory/products/${productToDelete?.id}`);
      toast.success("Produto removido com sucesso");
      loadProducts();
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Erro ao remover produto";
      toast.error(message);
    }
    setConfirmDeleteOpen(false);
    setProductToDelete(null);
  };

  const handleOpenMovementModal = (product: ProductListItem) => {
    setProductForMovement(product);
    setMovementModalOpen(true);
  };

  const handleCloseMovementModal = () => {
    setProductForMovement(null);
    setMovementModalOpen(false);
  };

  const handleRegisterMovement = async (type: "in" | "out", quantity: number): Promise<boolean> => {
    if (!productForMovement || quantity <= 0) return false;
    try {
      await api.post(`/inventory/movements/${type}`, {
        skuId: productForMovement.skuId,
        quantity,
        originType: "MANUAL",
      });
      toast.success(type === "in" ? "Entrada registrada" : "Saída registrada");
      handleCloseMovementModal();
      loadProducts();
      return true;
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Erro ao registrar movimentação";
      toast.error(message);
      return false;
    }
  };

  return {
    products: filteredProducts,
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
    reload: loadProducts,
  };
}
