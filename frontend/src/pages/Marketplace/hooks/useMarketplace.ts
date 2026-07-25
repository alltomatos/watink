import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import pluginApi from "../../../services/pluginApi";
import type { MarketplacePlugin, MarketplaceEntitlements, ViewMode } from "../marketplaceTypes";

interface UseMarketplaceReturn {
  plugins: MarketplacePlugin[];
  loading: boolean;
  searchParam: string;
  setSearchParam: (v: string) => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  offline: boolean;
  instanceId: string;
  entitlements: MarketplaceEntitlements | null;
  filteredPlugins: MarketplacePlugin[];
  handlePluginClick: (plugin: MarketplacePlugin) => void;
  handleCopyInstanceId: () => void;
}

export function useMarketplace(): UseMarketplaceReturn {
  const navigate = useNavigate();

  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [offline, setOffline] = useState(false);
  const [instanceId, setInstanceId] = useState("");
  const [entitlements, setEntitlements] = useState<MarketplaceEntitlements | null>(null);

  useEffect(() => {
    loadPlugins();
    loadInstanceId();
  }, []);

  const loadInstanceId = async () => {
    try {
      const { data } = await pluginApi.get("/plugins/instance");
      setInstanceId(data.instanceId);
    } catch {
      console.error("Erro ao carregar Instance ID");
    }
  };

  const loadPlugins = async () => {
    try {
      setLoading(true);
      const { data: catalogRes } = await pluginApi.get("/plugins/catalog");
      setOffline(Boolean(catalogRes?.offline));
      const { data: installedRes } = await pluginApi.get("/plugins/installed");
      setEntitlements(installedRes?.entitlements || null);
      const activeSlugs = new Set<string>(
        Array.isArray(installedRes?.active) ? installedRes.active : []
      );
      const all: MarketplacePlugin[] = Array.isArray(catalogRes?.plugins)
        ? catalogRes.plugins
        : [];
      const normalized: MarketplacePlugin[] = all.map((p) => ({
        // slug é a chave estável do catálogo -- p.id nunca é preenchido pelo
        // plugin-manager (o Hub não expõe id no /catalog público).
        id: p.slug,
        slug: p.slug,
        name: p.name,
        description: p.description,
        version: p.version,
        type: p.type,
        category: p.category,
        price: p.price,
        taxRatePercent: p.taxRatePercent,
        iconUrl: p.iconUrl || `/public/plugins/${p.slug}.png`,
        installed: activeSlugs.has(p.slug),
        active: activeSlugs.has(p.slug),
      }));
      setPlugins(normalized);
    } catch {
      toast.error("Erro ao carregar plugins");
    } finally {
      setLoading(false);
    }
  };

  const handlePluginClick = (plugin: MarketplacePlugin) => {
    navigate(`/admin/settings/marketplace/${plugin.slug}`);
  };

  const handleCopyInstanceId = () => {
    if (!instanceId) return;
    navigator.clipboard.writeText(instanceId);
    toast.success("ID da instância copiado!");
  };

  const filteredPlugins = plugins.filter(
    (p) =>
      p.name.toLowerCase().includes(searchParam.toLowerCase()) ||
      (p.description?.toLowerCase() ?? "").includes(searchParam.toLowerCase())
  );

  return {
    plugins,
    loading,
    searchParam,
    setSearchParam,
    view,
    setView,
    offline,
    instanceId,
    entitlements,
    filteredPlugins,
    handlePluginClick,
    handleCopyInstanceId,
  };
}
