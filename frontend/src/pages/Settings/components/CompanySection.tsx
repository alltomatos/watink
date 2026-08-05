/* @jsxImportSource react */
import React from "react";
import { Building2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Separator } from "../../../components/ui/separator";

interface CompanySectionProps {
  getSettingValue: (key: string) => string;
  handleUpdateSetting: (key: string, value: string) => Promise<void>;
}

// Cadastro de Empresa: dados legais/fiscais e de contato do tenant, usados por
// relatórios/recibos (plugin futuro) e exibidos na página pública do Helpdesk
// junto da logo (já configurada em Personalização). Reaproveita a mesma
// infraestrutura key-value de Setting do resto do módulo — sem entidade nova.
const CompanySection: React.FC<CompanySectionProps> = ({
  getSettingValue,
  handleUpdateSetting,
}) => {
  const field = (key: string) => ({
    defaultValue: getSettingValue(key),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) =>
      handleUpdateSetting(key, e.target.value),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Building2 className="h-5 w-5" />
            Dados da Empresa
          </CardTitle>
          <CardDescription>
            Informações legais e de contato usadas em relatórios, recibos e na
            página pública de acompanhamento do Helpdesk.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Razão Social</Label>
              <Input placeholder="Ex: Watink Tecnologia LTDA" {...field("companyLegalName")} />
            </div>
            <div className="grid gap-2">
              <Label>Nome Fantasia</Label>
              <Input placeholder="Ex: Watink" {...field("companyTradeName")} />
            </div>
          </div>

          <div className="grid gap-2 md:w-1/2">
            <Label>CNPJ / CPF</Label>
            <Input placeholder="00.000.000/0000-00" {...field("companyDocument")} />
          </div>

          <Separator />

          <div className="grid gap-4">
            <Label className="text-sm font-semibold">Endereço</Label>
            <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
              <div className="grid gap-2">
                <Label>Logradouro</Label>
                <Input placeholder="Rua, Av..." {...field("companyAddressStreet")} />
              </div>
              <div className="grid gap-2">
                <Label>Número</Label>
                <Input placeholder="Nº" {...field("companyAddressNumber")} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Complemento</Label>
                <Input placeholder="Sala, andar..." {...field("companyAddressComplement")} />
              </div>
              <div className="grid gap-2">
                <Label>Bairro</Label>
                <Input placeholder="Bairro" {...field("companyAddressNeighborhood")} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
              <div className="grid gap-2">
                <Label>Cidade</Label>
                <Input placeholder="Cidade" {...field("companyAddressCity")} />
              </div>
              <div className="grid gap-2">
                <Label>UF</Label>
                <Input placeholder="UF" maxLength={2} {...field("companyAddressState")} />
              </div>
              <div className="grid gap-2">
                <Label>CEP</Label>
                <Input placeholder="00000-000" {...field("companyAddressZip")} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Telefone</Label>
              <Input placeholder="(00) 00000-0000" {...field("companyPhone")} />
            </div>
            <div className="grid gap-2">
              <Label>E-mail</Label>
              <Input type="email" placeholder="contato@empresa.com" {...field("companyEmail")} />
            </div>
            <div className="grid gap-2">
              <Label>Site</Label>
              <Input placeholder="https://empresa.com" {...field("companyWebsite")} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanySection;
