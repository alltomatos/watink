/* @jsxImportSource react */
import React from "react";
import { MapPin } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";

interface AddressLookupSettingsProps {
  getSettingValue: (key: string) => string;
  handleUpdateSetting: (key: string, value: string) => Promise<void>;
}

const AddressLookupSettings: React.FC<AddressLookupSettingsProps> = ({
  getSettingValue,
  handleUpdateSetting,
}) => {
  const provider = getSettingValue("addressLookupProvider") || "viacep";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <MapPin className="h-5 w-5" />
            Integração de Endereço (CEP)
          </CardTitle>
          <CardDescription>
            Provedor usado para autocompletar endereços de Clientes a partir do
            CEP.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="address-lookup-provider">
              Provedor de Busca de CEP
            </Label>
            <Select
              value={provider}
              onValueChange={(v) =>
                handleUpdateSetting("addressLookupProvider", v)
              }
            >
              <SelectTrigger id="address-lookup-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viacep">ViaCEP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address-lookup-base-url">URL Base da API</Label>
            <Input
              id="address-lookup-base-url"
              placeholder="https://viacep.com.br/ws"
              defaultValue={
                getSettingValue("addressLookupBaseUrl") ||
                "https://viacep.com.br/ws"
              }
              onBlur={(e) =>
                handleUpdateSetting("addressLookupBaseUrl", e.target.value)
              }
            />
            <p className="text-xs text-muted-foreground">
              Usado pelo backend para autocompletar endereços de Clientes a
              partir do CEP (nunca chamado diretamente pelo frontend).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddressLookupSettings;
