import React, { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";

import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { SlaConfigCard, SlaConfigValue } from "@/components/ui/sla-config-card";
import { Skeleton } from "@/components/ui/skeleton";
import notify from "@/lib/notify";
import api from "../../../services/api";

interface SlaConfigResponse {
  slaConfig: SlaConfigValue;
  staleThresholdMinutes: number;
}

const DEFAULT_SLA: SlaConfigValue = { low: 4320, medium: 1440, high: 480, urgent: 120 };
const DEFAULT_STALE_THRESHOLD = 60;

/**
 * ActivitiesSection — configuração de SLA e "atividade parada" do módulo
 * Atividades (core). Diferente de HelpdeskSection, não passa pelo hook
 * genérico useSettings/PUT /settings/:key — usa as rotas dedicadas
 * GET/PUT /activities/sla-config (activities:manage), que leem/gravam a
 * config de verdade no backend (ADR 0029).
 */
const ActivitiesSection: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slaConfig, setSlaConfig] = useState<SlaConfigValue>(DEFAULT_SLA);
  const [staleThresholdMinutes, setStaleThresholdMinutes] = useState(DEFAULT_STALE_THRESHOLD);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const { data } = await api.get<SlaConfigResponse>("/activities/sla-config");
        setSlaConfig(data.slaConfig);
        setStaleThresholdMinutes(data.staleThresholdMinutes);
      } catch (err) {
        notify.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const persist = async (nextSla: SlaConfigValue, nextStale: number) => {
    try {
      setSaving(true);
      await api.put<SlaConfigResponse>("/activities/sla-config", {
        slaConfig: nextSla,
        staleThresholdMinutes: nextStale,
      });
      notify.success("Configuração de Atividades atualizada!");
    } catch (err) {
      notify.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSlaChange = (priority: keyof SlaConfigValue, value: string) => {
    const numeric = parseInt(value, 10) || 0;
    const next = { ...slaConfig, [priority]: numeric };
    setSlaConfig(next);
    void persist(next, staleThresholdMinutes);
  };

  const handleStaleThresholdChange = (value: string) => {
    const numeric = parseInt(value, 10) || 0;
    setStaleThresholdMinutes(numeric);
    void persist(slaConfig, numeric);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SlaConfigCard
        icon={<ClipboardList className="h-5 w-5" />}
        title="Configuração de Atividades (Ordens de Serviço)"
        description="Prazos de SLA por prioridade e alerta de atividade parada"
        value={slaConfig}
        onChange={handleSlaChange}
      >
        <FormField
          htmlFor="activities-stale-threshold"
          label="Alerta de atividade parada (minutos)"
          helperText='Uma atividade "Em andamento" sem nenhuma mutação por este tempo entra como "Parada" na listagem.'
        >
          <Input
            id="activities-stale-threshold"
            type="number"
            disabled={saving}
            value={staleThresholdMinutes}
            onChange={(e) => handleStaleThresholdChange(e.target.value)}
          />
        </FormField>
      </SlaConfigCard>
    </div>
  );
};

export default ActivitiesSection;
