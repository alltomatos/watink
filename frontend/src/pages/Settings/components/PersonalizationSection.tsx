import React, { useRef } from "react";
import { Palette, CloudUpload, Trash2, Layout } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Separator } from "../../../components/ui/separator";
import ImagePreview from "./ImagePreview";

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
              defaultValue={getSettingValue("systemTitle") || "Watink"}
              onBlur={(e) => handleUpdateSetting("systemTitle", e.target.value)}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Logotipo Principal (Escala Horizontal)</Label>
                <Switch
                  checked={getSettingValue("systemLogoEnabled") !== "false"}
                  onCheckedChange={(checked) => handleUpdateSetting("systemLogoEnabled", checked ? "true" : "false")}
                  title="Habilitar logotipo"
                />
              </div>
              <div className="border border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-3 bg-muted/10">
                <ImagePreview value={getSettingValue("systemLogo")} alt="systemLogo" />
                <input type="file" accept="image/*" ref={logoInputRef} className="hidden" onChange={(e) => handleImageUpload("systemLogo", e.target.files?.[0])} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>
                    <CloudUpload className="mr-2 h-4 w-4" /> Alterar Logo
                  </Button>
                  <Button size="sm" variant="destructive-ghost" onClick={() => handleUpdateSetting("systemLogo", "")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Favicon (Ícone do Navegador)</Label>
              <div className="border border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-3 bg-muted/10">
                <ImagePreview value={getSettingValue("systemFavicon")} alt="systemFavicon" />
                <input type="file" accept="image/x-icon,image/png,image/jpeg" ref={faviconInputRef} className="hidden" onChange={(e) => handleImageUpload("systemFavicon", e.target.files?.[0])} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => faviconInputRef.current?.click()}>
                    <CloudUpload className="mr-2 h-4 w-4" /> Alterar Favicon
                  </Button>
                  <Button size="sm" variant="destructive-ghost" onClick={() => handleUpdateSetting("systemFavicon", "")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Logotipo Mobile</Label>
              <div className="border border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-3 bg-muted/10">
                <ImagePreview value={getSettingValue("mobileLogo")} alt="mobileLogo" />
                <input type="file" accept="image/*" ref={mobileLogoInputRef} className="hidden" onChange={(e) => handleImageUpload("mobileLogo", e.target.files?.[0])} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => mobileLogoInputRef.current?.click()}>
                    <CloudUpload className="mr-2 h-4 w-4" /> Alterar Mobile
                  </Button>
                  <Button size="sm" variant="destructive-ghost" onClick={() => handleUpdateSetting("mobileLogo", "")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Tema Visual</Label>
              <Select value={getSettingValue("theme") || "whaticket"} onValueChange={(v) => handleUpdateSetting("theme", v)}>
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
              <Select value={getSettingValue("login_layout") || "centered"} onValueChange={(v) => handleUpdateSetting("login_layout", v)}>
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
                <ImagePreview value={getSettingValue("login_backgroundImage")} alt="login_backgroundImage" />
                <input type="file" accept="image/*" ref={loginBackgroundInputRef} className="hidden" onChange={(e) => handleImageUpload("login_backgroundImage", e.target.files?.[0])} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => loginBackgroundInputRef.current?.click()}>
                    <CloudUpload className="mr-2 h-4 w-4" /> Alterar Fundo
                  </Button>
                  <Button size="sm" variant="destructive-ghost" onClick={() => handleUpdateSetting("login_backgroundImage", "")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalizationSection;
