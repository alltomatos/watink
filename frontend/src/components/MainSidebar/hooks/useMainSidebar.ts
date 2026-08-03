import { useEffect, useState } from "react";
import api from "../../../services/api";
import pluginApi from "../../../services/pluginApi";

interface MainSidebarState {
  activePlugins: string[];
  systemLogo: string;
  systemTitle: string;
  logoEnabled: boolean;
}

// Reconsulta periódica dos plugins ativos (heartbeat) — cobre o caso de a
// checagem inicial ter falhado por um erro transitório (plugin-manager
// acordando, blip de rede) sem exigir que o usuário visite Configurações >
// Marketplace ou dê refresh manual para "destravar" o dia. 5min: barato o
// bastante para não pesar, curto o bastante para o menu corrigir sozinho
// bem antes de virar um incômodo perceptível.
const PLUGINS_HEARTBEAT_MS = 5 * 60 * 1000;

// fetchPlugins falhando fica em silêncio por padrão (erro de rede pontual
// não deve virar toast a cada 5min) — mas SEM retry nenhum, uma falha na
// checagem única de montagem deixava activePlugins vazio pelo resto da
// sessão inteira (só um refresh de página tentava de novo). 3 tentativas
// com backoff curto cobrem o caso comum (blip transitório); o heartbeat
// acima cobre o resto.
async function fetchActivePlugins(attempt = 1): Promise<string[]> {
  try {
    const { data } = await pluginApi.get("/plugins/installed");
    return data.active || [];
  } catch (err) {
    if (attempt >= 3) throw err;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    return fetchActivePlugins(attempt + 1);
  }
}

export function useMainSidebar(): MainSidebarState {
  const [activePlugins, setActivePlugins] = useState<string[]>([]);
  const [systemLogo, setSystemLogo] = useState("");
  const [systemTitle, setSystemTitle] = useState("Watink");
  const [logoEnabled, setLogoEnabled] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get("/settings");
        const settings = Array.isArray(data) ? data : [];
        const logo = settings.find((s: { key: string; value: string }) => s.key === "systemLogo");
        const title = settings.find((s: { key: string; value: string }) => s.key === "systemTitle");
        const enabled = settings.find((s: { key: string; value: string }) => s.key === "systemLogoEnabled");

        if (logo?.value) setSystemLogo(logo.value);
        if (title?.value) setSystemTitle(title.value);
        if (enabled) setLogoEnabled(enabled.value === "true");
      } catch {
        // silence — settings fetch is non-critical
      }
    };

    const fetchPlugins = async () => {
      try {
        setActivePlugins(await fetchActivePlugins());
      } catch {
        // silent — 3 tentativas já esgotadas; o heartbeat abaixo tenta de novo
      }
    };

    fetchSettings();
    fetchPlugins();

    const heartbeat = setInterval(fetchPlugins, PLUGINS_HEARTBEAT_MS);
    return () => clearInterval(heartbeat);
  }, []);

  return { activePlugins, systemLogo, systemTitle, logoEnabled };
}
