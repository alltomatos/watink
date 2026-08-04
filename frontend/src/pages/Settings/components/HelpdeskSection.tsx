import React from "react";
import { Headphones, Plus, XCircle } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { SlaConfigCard } from "../../../components/ui/sla-config-card";
import { SlaConfig } from "../hooks/useSettings";

interface HelpdeskSectionProps {
  getSettingValue: (key: string) => string;
  handleUpdateSetting: (key: string, value: string) => Promise<void>;
  slaConfig: SlaConfig;
  handleUpdateSla: (priority: string, value: string) => Promise<void>;
  newCategory: string;
  setNewCategory: (v: string) => void;
  helpdeskCategories: string[];
  handleAddCategory: () => Promise<void>;
  handleRemoveCategory: (cat: string) => Promise<void>;
}

const HelpdeskSection: React.FC<HelpdeskSectionProps> = ({
  getSettingValue,
  handleUpdateSetting,
  slaConfig,
  handleUpdateSla,
  newCategory,
  setNewCategory,
  helpdeskCategories,
  handleAddCategory,
  handleRemoveCategory,
}) => (
  <div className="space-y-6">
    <SlaConfigCard
      icon={<Headphones className="h-5 w-5" />}
      title="Configuração de Atendimento (Helpdesk)"
      description="Configure acordos de nível de serviço (SLA) e triagem de chamados"
      value={slaConfig}
      onChange={handleUpdateSla}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Habilitar Helpdesk SLA</Label>
          <p className="text-sm text-muted-foreground">Exige temporizador de SLA ativo nas conversas dos colaboradores</p>
        </div>
        <Switch
          checked={getSettingValue("helpdesk_sla_enabled") === "true"}
          onCheckedChange={(checked) => handleUpdateSetting("helpdesk_sla_enabled", checked ? "true" : "false")}
        />
      </div>
    </SlaConfigCard>

    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Categorias ITIL da Triagem</CardTitle>
        <CardDescription>Gerencie as categorias padrão solicitadas aos usuários para abertura de novos incidentes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Ex: Falha de Conexão, Redefinição de Senha"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
          />
          <Button type="button" onClick={handleAddCategory}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {helpdeskCategories.map((cat) => (
            <Badge key={cat} variant="secondary" className="pl-3 pr-1 py-1 gap-2 text-sm items-center fill-current">
              {cat}
              <button
                type="button"
                className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                onClick={() => handleRemoveCategory(cat)}
              >
                <XCircle size={14} className="text-muted-foreground hover:text-destructive" />
              </button>
            </Badge>
          ))}
          {helpdeskCategories.length === 0 && (
            <div className="text-xs text-muted-foreground italic">Nenhuma categoria definida.</div>
          )}
        </div>
      </CardContent>
    </Card>
  </div>
);

export default HelpdeskSection;
