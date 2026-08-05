import React, { useRef, useState } from "react";
import { Palette, CloudUpload, Trash2, Layout, Eye, Check, X } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Separator } from "../../../components/ui/separator";
import ImagePreview from "./ImagePreview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../components/ui/dialog";

interface PersonalizationSectionProps {
  getSettingValue: (key: string) => string;
  handleUpdateSetting: (key: string, value: string) => Promise<void>;
  handleImageUpload: (key: string, file: File | undefined) => Promise<void>;
}

const PersonalizationSection: React.FC<PersonalizationSectionProps> = ({
  getSettingValue,
  handleUpdateSetting,
  handleImageUpload,
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const mobileLogoInputRef = useRef<HTMLInputElement>(null);
  const loginBackgroundInputRef = useRef<HTMLInputElement>(null);

  // Estado local para mudanças não salvas
  const [localChanges, setLocalChanges] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const hasChanges = Object.keys(localChanges).length > 0;

  const getDisplayValue = (key: string): string => {
    return localChanges[key] !== undefined ? localChanges[key] : getSettingValue(key);
  };

  const handleLocalChange = (key: string, value: string) => {
    setLocalChanges((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleReset = () => {
    setLocalChanges({});
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      for (const [key, value] of Object.entries(localChanges)) {
        await handleUpdateSetting(key, value);
      }
      setLocalChanges({});
      setPreviewOpen(false);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Palette className="h-5 w-5" />
            Identidade Visual
          </CardTitle>
          <CardDescription>Personalize o nome e as imagens do seu sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label>Nome do Sistema (Título)</Label>
            <Input
              placeholder="Ex: Watink Atendimento"
              value={getDisplayValue("systemTitle") || "Watink"}
              onChange={(e) => handleLocalChange("systemTitle", e.target.value)}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Logotipo Principal (Escala Horizontal)</Label>
                <Switch
                  checked={getDisplayValue("systemLogoEnabled") !== "false"}
                  onCheckedChange={(checked) => handleLocalChange("systemLogoEnabled", checked ? "true" : "false")}
                  title="Habilitar logotipo"
                />
              </div>
              <div className="border border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-3 bg-muted/10">
                <ImagePreview value={getDisplayValue("systemLogo")} alt="systemLogo" />
                <input type="file" accept="image/*" ref={logoInputRef} className="hidden" onChange={(e) => handleImageUpload("systemLogo", e.target.files?.[0])} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>
                    <CloudUpload className="mr-2 h-4 w-4" /> Alterar Logo
                  </Button>
                  <Button size="sm" variant="destructive-ghost" onClick={() => handleLocalChange("systemLogo", "")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Favicon (Ícone do Navegador)</Label>
              <div className="border border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-3 bg-muted/10">
                <ImagePreview value={getDisplayValue("systemFavicon")} alt="systemFavicon" />
                <input type="file" accept="image/x-icon,image/png,image/jpeg" ref={faviconInputRef} className="hidden" onChange={(e) => handleImageUpload("systemFavicon", e.target.files?.[0])} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => faviconInputRef.current?.click()}>
                    <CloudUpload className="mr-2 h-4 w-4" /> Alterar Favicon
                  </Button>
                  <Button size="sm" variant="destructive-ghost" onClick={() => handleLocalChange("systemFavicon", "")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Logotipo Mobile</Label>
              <div className="border border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-3 bg-muted/10">
                <ImagePreview value={getDisplayValue("mobileLogo")} alt="mobileLogo" />
                <input type="file" accept="image/*" ref={mobileLogoInputRef} className="hidden" onChange={(e) => handleImageUpload("mobileLogo", e.target.files?.[0])} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => mobileLogoInputRef.current?.click()}>
                    <CloudUpload className="mr-2 h-4 w-4" /> Alterar Mobile
                  </Button>
                  <Button size="sm" variant="destructive-ghost" onClick={() => handleLocalChange("mobileLogo", "")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Tema Visual</Label>
              <Select value={getDisplayValue("theme") || "whaticket"} onValueChange={(v) => handleLocalChange("theme", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tema principal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whaticket">Padrão Whajet / Whaticket</SelectItem>
                  <SelectItem value="whatsapp">Branding WhatsApp (Green)</SelectItem>
                  <SelectItem value="dark">Escuro Noturno (Dark)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Layout className="h-5 w-5" />
            Customização da Tela de Login
          </CardTitle>
          <CardDescription>Configure o design e a visualização da tela inicial</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Posição do Formulário</Label>
              <Select value={getDisplayValue("login_layout") || "centered"} onValueChange={(v) => handleLocalChange("login_layout", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Layout da página" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="split_left">Formulário à Esquerda</SelectItem>
                  <SelectItem value="split_right">Formulário à Direita</SelectItem>
                  <SelectItem value="centered">Centralizado (Background Completo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Imagem de Fundo (Login)</Label>
              <div className="border border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-3 bg-muted/10">
                <ImagePreview value={getDisplayValue("login_backgroundImage")} alt="login_backgroundImage" />
                <input type="file" accept="image/*" ref={loginBackgroundInputRef} className="hidden" onChange={(e) => handleImageUpload("login_backgroundImage", e.target.files?.[0])} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => loginBackgroundInputRef.current?.click()}>
                    <CloudUpload className="mr-2 h-4 w-4" /> Alterar Fundo
                  </Button>
                  <Button size="sm" variant="destructive-ghost" onClick={() => handleLocalChange("login_backgroundImage", "")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botões de ação flutuantes quando houver mudanças */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 flex gap-3 z-50">
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Descartar
          </Button>
          <Button
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button
            onClick={handleApply}
            disabled={applying}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            {applying ? "Aplicando..." : "Aplicar"}
          </Button>
        </div>
      )}

      {/* Modal de Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview das Alterações</DialogTitle>
            <DialogDescription>
              Revise as alterações antes de aplicar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {localChanges.systemTitle && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <Label className="text-xs font-semibold">Nome do Sistema</Label>
                <p className="text-sm">{localChanges.systemTitle}</p>
              </div>
            )}

            {localChanges.systemLogoEnabled && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <Label className="text-xs font-semibold">Logotipo Principal</Label>
                <p className="text-sm">
                  {localChanges.systemLogoEnabled === "true" ? "Habilitado" : "Desabilitado"}
                </p>
              </div>
            )}

            {localChanges.systemLogo !== undefined && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <Label className="text-xs font-semibold">Logo Principal</Label>
                <p className="text-sm text-muted-foreground">
                  {localChanges.systemLogo ? "Alterado" : "Removido"}
                </p>
              </div>
            )}

            {localChanges.systemFavicon !== undefined && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <Label className="text-xs font-semibold">Favicon</Label>
                <p className="text-sm text-muted-foreground">
                  {localChanges.systemFavicon ? "Alterado" : "Removido"}
                </p>
              </div>
            )}

            {localChanges.mobileLogo !== undefined && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <Label className="text-xs font-semibold">Logo Mobile</Label>
                <p className="text-sm text-muted-foreground">
                  {localChanges.mobileLogo ? "Alterado" : "Removido"}
                </p>
              </div>
            )}

            {localChanges.theme && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <Label className="text-xs font-semibold">Tema Visual</Label>
                <p className="text-sm">
                  {localChanges.theme === "whaticket"
                    ? "Padrão Whajet / Whaticket"
                    : localChanges.theme === "whatsapp"
                      ? "Branding WhatsApp (Green)"
                      : "Escuro Noturno (Dark)"}
                </p>
              </div>
            )}

            {localChanges.login_layout && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <Label className="text-xs font-semibold">Posição do Formulário de Login</Label>
                <p className="text-sm">
                  {localChanges.login_layout === "split_left"
                    ? "Formulário à Esquerda"
                    : localChanges.login_layout === "split_right"
                      ? "Formulário à Direita"
                      : "Centralizado (Background Completo)"}
                </p>
              </div>
            )}

            {localChanges.login_backgroundImage !== undefined && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <Label className="text-xs font-semibold">Imagem de Fundo (Login)</Label>
                <p className="text-sm text-muted-foreground">
                  {localChanges.login_backgroundImage ? "Alterada" : "Removida"}
                </p>
              </div>
            )}

            <div className="text-xs text-muted-foreground p-3 border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
              ⚠️ Clique em "Aplicar" para confirmar e salvar as alterações permanentemente.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
            >
              Voltar
            </Button>
            <Button
              onClick={handleApply}
              disabled={applying}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              {applying ? "Aplicando..." : "Aplicar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonalizationSection;
