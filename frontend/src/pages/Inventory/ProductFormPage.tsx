/* @jsxImportSource react */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import { ArrowLeft, Camera, Package } from "lucide-react";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { getBackendUrl } from "../../helpers/urlUtils";
import type { ProductListItem, ProductFormData } from "./inventoryTypes";
import { emptyProductForm, productToFormData, reaisToCents, UNIT_OPTIONS } from "./inventoryTypes";

const ProductFormPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(productId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<ProductFormData>(emptyProductForm);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    try {
      setLoading(true);
      const { data } = await api.get<{ products: ProductListItem[] }>("/inventory/products");
      const product = (data.products ?? []).find((p) => String(p.id) === productId);
      if (!product) {
        toast.error("Produto não encontrado");
        navigate("/inventory");
        return;
      }
      setFormData(productToFormData(product));
      setImageUrl(product.imageUrl);
    } catch (err) {
      toastError(err);
      navigate("/inventory");
    } finally {
      setLoading(false);
    }
  }, [productId, navigate]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const handleChange = (field: keyof ProductFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = formData.name.trim() !== "" && formData.skuCode.trim() !== "";

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !productId) return;
    const file = e.target.files[0];
    const uploadData = new FormData();
    uploadData.append("image", file);
    setUploadingImage(true);
    try {
      const { data } = await api.post<{ imageUrl: string }>(
        `/inventory/products/${productId}/image`,
        uploadData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setImageUrl(data.imageUrl);
      toast.success("Imagem atualizada");
    } catch (err) {
      toastError(err);
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const priceCents = reaisToCents(formData.priceReais);
      if (isEdit) {
        await api.put(`/inventory/products/${productId}`, {
          name: formData.name,
          unit: formData.unit,
          skuCode: formData.skuCode,
          minQuantity: parseFloat(formData.minQuantity) || 0,
          priceCents,
        });
        toast.success("Produto atualizado com sucesso");
        navigate("/inventory");
      } else {
        const { data } = await api.post<{ product: { id: number } }>("/inventory/products", {
          name: formData.name,
          unit: formData.unit,
          skuCode: formData.skuCode,
          priceCents,
          initialStock: parseFloat(formData.initialStock) || 0,
        });
        toast.success("Produto criado com sucesso");
        // Redireciona para a edição do produto recém-criado — é ali que o
        // upload de imagem fica disponível (precisa do id do Product).
        navigate(`/inventory/products/${data.product.id}/edit`);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader title={isEdit ? "Editar Produto" : "Novo Produto"}>
        <Button variant="outline" onClick={() => navigate("/inventory")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </PageHeader>

      <PageContent>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <Card className="mx-auto max-w-2xl p-6 space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                <div className="h-24 w-24 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={getBackendUrl(imageUrl)}
                      alt={formData.name || "Produto"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                {isEdit && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  >
                    <Camera className="text-white h-6 w-6" />
                  </button>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleUploadImage}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {isEdit ? (
                  <>Clique na imagem para enviar uma foto do produto.</>
                ) : (
                  <>Salve o produto primeiro para poder enviar uma foto.</>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Nome <span className="text-destructive">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Ex: Refrigerante Lata 350ml"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Código (SKU) <span className="text-destructive">*</span>
                </label>
                <Input
                  value={formData.skuCode}
                  onChange={(e) => handleChange("skuCode", e.target.value)}
                  placeholder="Ex: REF-350"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Unidade</label>
                <Select value={formData.unit} onValueChange={(v) => handleChange("unit", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Preço (R$)</label>
                <Input
                  inputMode="decimal"
                  value={formData.priceReais}
                  onChange={(e) => handleChange("priceReais", e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Estoque mínimo</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.minQuantity}
                  onChange={(e) => handleChange("minQuantity", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Alerta quando o saldo ficar igual ou abaixo.</p>
              </div>
            </div>

            {!isEdit && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Estoque inicial</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.initialStock}
                  onChange={(e) => handleChange("initialStock", e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Quantidade já disponível hoje — gera uma entrada de estoque automática.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate("/inventory")}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || !isValid}>
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </Card>
        )}
      </PageContent>
    </PageContainer>
  );
};

export default ProductFormPage;
