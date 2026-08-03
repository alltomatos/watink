import React from "react";
import { toast } from "react-toastify";
import { SettingsIcon, Copy } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { FormField } from "../../../components/ui/form-field";
import { Switch } from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Separator } from "../../../components/ui/separator";

const timezones = [
  { value: "America/Sao_Paulo", label: "Brasília (UTC-3)" },
  { value: "America/Manaus", label: "Amazonas (UTC-4)" },
  { value: "America/Noronha", label: "Fernando de Noronha (UTC-2)" },
  { value: "America/Caracas", label: "Caracas (UTC-4)" },
  { value: "America/New_York", label: "Nova York (UTC-5)" },
  { value: "Europe/London", label: "Londres (UTC+0)" },
  { value: "Europe/Paris", label: "Paris (UTC+1)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
];

interface GeneralSectionProps {
  getSettingValue: (key: string) => string;
  handleUpdateSetting: (key: string, value: string) => Promise<void>;
  handleLanguageChange: (lang: string) => Promise<void>;
}

const GeneralSection: React.FC<GeneralSectionProps> = ({
  getSettingValue,
  handleUpdateSetting,
  handleLanguageChange,
}) => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <SettingsIcon className="h-5 w-5" />
          Configurações Gerais
        </CardTitle>
        <CardDescription>Gerencie o comportamento global da plataforma</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Assinatura do Usuário</Label>
            <p className="text-sm text-muted-foreground">Adiciona a assinatura do atendente ao final de cada mensagem</p>
          </div>
          <Switch
            checked={getSettingValue("userSignature") === "enabled"}
            onCheckedChange={(checked) => handleUpdateSetting("userSignature", checked ? "enabled" : "disabled")}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Check-in Obrigatório</Label>
            <p className="text-sm text-muted-foreground">Exige que o atendente esteja ativo para receber novos tickets</p>
          </div>
          <Switch
            checked={getSettingValue("forceCheckIn") === "enabled"}
            onCheckedChange={(checked) => handleUpdateSetting("forceCheckIn", checked ? "enabled" : "disabled")}
          />
        </div>

        <Separator />

        <FormField htmlFor="system-lang" label="Idioma Global">
          <Select value={getSettingValue("language") || "pt"} onValueChange={handleLanguageChange}>
            <SelectTrigger id="system-lang">
              <SelectValue placeholder="Idioma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pt">Português (Brasil)</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <Separator />

        <FormField htmlFor="system-timezone" label="Fuso Horário (Timezone)">
          <Select
            value={getSettingValue("timezone") || "America/Sao_Paulo"}
            onValueChange={(v) => handleUpdateSetting("timezone", v)}
          >
            <SelectTrigger id="system-timezone">
              <SelectValue placeholder="Selecione o Timezone" />
            </SelectTrigger>
            <SelectContent>
              {timezones.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <Separator />

        <FormField htmlFor="api-token" label="Token de API Global">
          <div className="flex gap-2">
            <Input id="api-token" readOnly value={getSettingValue("userApiToken")} className="font-mono bg-muted" />
            <Button variant="outline" size="icon" onClick={() => {
              navigator.clipboard.writeText(getSettingValue("userApiToken"));
              toast.success("Token copiado!");
            }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </FormField>
      </CardContent>
    </Card>
  </div>
);

export default GeneralSection;
