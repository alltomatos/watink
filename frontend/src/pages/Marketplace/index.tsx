/* @jsxImportSource react */
import React, { useContext, useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";

import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import { PageContainer, PageHeader, PageContent } from "../../components/ui/page-layout";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";

import { useMarketplace } from "./hooks/useMarketplace";
import { MarketplaceToolbar } from "./components/MarketplaceToolbar";
import { OfflineBanner, InstanceIdBanner } from "./components/MarketplaceStatusBanner";
import { PluginGrid } from "./components/PluginGrid";
import { PluginTable } from "./components/PluginTable";
import { CartProvider, useCart } from "./cart/CartContext";
import { CartDrawer } from "./cart/CartDrawer";
import type { MarketplaceEntitlements, MarketplacePlugin, ViewMode } from "./marketplaceTypes";

interface MarketplaceTabsProps {
  loading: boolean;
  view: ViewMode;
  offline: boolean;
  instanceId: string;
  entitlements: MarketplaceEntitlements | null;
  filteredPlugins: MarketplacePlugin[];
  handlePluginClick: (plugin: MarketplacePlugin) => void;
  handleCopyInstanceId: () => void;
}

// MarketplaceTabs splits the flat plugin list into "Meus Plugins" (already
// active — the common case after the first purchase, no need to drill into
// a detail page anymore) and "Catálogo" (everything buyable, cart-style).
// Takes useMarketplace()'s return as props instead of calling the hook
// itself — the parent already calls it once (for the search/view toolbar),
// and a second independent call here would double-fetch the catalog AND
// desync the search box (two separate `searchParam` states).
function MarketplaceTabs({
  loading,
  view,
  offline,
  instanceId,
  entitlements,
  filteredPlugins,
  handlePluginClick,
  handleCopyInstanceId,
}: MarketplaceTabsProps) {
  const { count, isInCart, addItem } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  const owned = filteredPlugins.filter((p) => p.installed);
  const catalog = filteredPlugins.filter((p) => !p.installed);

  return (
    <>
      <OfflineBanner offline={offline} />
      <InstanceIdBanner instanceId={instanceId} entitlements={entitlements} onCopy={handleCopyInstanceId} />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="catalog">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="mine">Meus Plugins ({owned.length})</TabsTrigger>
              <TabsTrigger value="catalog">Catálogo ({catalog.length})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="mine" className="mt-4">
            {owned.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Você ainda não ativou nenhum plugin — veja o Catálogo para começar.
              </p>
            ) : view === "grid" ? (
              <PluginGrid plugins={owned} onPluginClick={handlePluginClick} />
            ) : (
              <PluginTable plugins={owned} onPluginClick={handlePluginClick} />
            )}
          </TabsContent>

          <TabsContent value="catalog" className="mt-4">
            {view === "grid" ? (
              <PluginGrid
                plugins={catalog}
                onPluginClick={handlePluginClick}
                onAddToCart={(plugin) => {
                  addItem(plugin);
                  setCartOpen(true);
                }}
                isInCart={isInCart}
              />
            ) : (
              <PluginTable plugins={catalog} onPluginClick={handlePluginClick} />
            )}
          </TabsContent>
        </Tabs>
      )}

      <Button
        variant="outline"
        className="fixed bottom-6 right-6 shadow-lg rounded-full h-14 w-14 p-0 z-40"
        onClick={() => setCartOpen(true)}
      >
        <ShoppingCart className="h-5 w-5" />
        {count > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
            {count}
          </Badge>
        )}
      </Button>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}

const Marketplace = () => {
  const { user } = useContext(AuthContext);
  const {
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
  } = useMarketplace();

  return (
    <Can
      user={user}
      perform="view_marketplace"
      no={() => (
        <PageContainer>
          <PageContent>
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              Você não tem permissão para acessar o Marketplace.
            </div>
          </PageContent>
        </PageContainer>
      )}
      yes={() => (
        <PageContainer>
          <PageHeader
            title="Marketplace"
            description="Amplie as funcionalidades do Watink com integrações e extensões premium"
          >
            <MarketplaceToolbar
              searchParam={searchParam}
              onSearchChange={setSearchParam}
              view={view}
              onViewChange={setView}
            />
          </PageHeader>

          <PageContent>
            <CartProvider>
              <MarketplaceTabs
                loading={loading}
                view={view}
                offline={offline}
                instanceId={instanceId}
                entitlements={entitlements}
                filteredPlugins={filteredPlugins}
                handlePluginClick={handlePluginClick}
                handleCopyInstanceId={handleCopyInstanceId}
              />
            </CartProvider>
          </PageContent>
        </PageContainer>
      )}
    />
  );
};

export default Marketplace;
