import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import type { MarketplacePlugin } from "../marketplaceTypes";

/** One plugin selected in the cart, with the pricing option the user picked for it. */
export interface CartEntry {
  plugin: MarketplacePlugin;
  /** "" means one-time payment (requires plugin.singlePaymentEnabled). */
  cycle: string;
}

interface CartContextValue {
  items: CartEntry[];
  count: number;
  isInCart: (slug: string) => boolean;
  addItem: (plugin: MarketplacePlugin) => void;
  removeItem: (slug: string) => void;
  setCycle: (slug: string, cycle: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// defaultCycleFor picks a sensible starting option: the first recurring
// cycle if any exist, otherwise one-time payment ("") when the plugin
// offers it. Mirrors the pre-selection logic already used in
// PluginDetail.tsx's single-plugin checkout dialog.
function defaultCycleFor(plugin: MarketplacePlugin): string {
  return plugin.pricingCycles?.[0]?.cycle ?? "";
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<Record<string, CartEntry>>({});

  const addItem = useCallback((plugin: MarketplacePlugin) => {
    setEntries((prev) => ({
      ...prev,
      [plugin.slug]: { plugin, cycle: defaultCycleFor(plugin) },
    }));
  }, []);

  const removeItem = useCallback((slug: string) => {
    setEntries((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
  }, []);

  const setCycle = useCallback((slug: string, cycle: string) => {
    setEntries((prev) => (prev[slug] ? { ...prev, [slug]: { ...prev[slug], cycle } } : prev));
  }, []);

  const clear = useCallback(() => setEntries({}), []);

  const items = useMemo(() => Object.values(entries), [entries]);
  const isInCart = useCallback((slug: string) => Boolean(entries[slug]), [entries]);

  const value = useMemo(
    () => ({ items, count: items.length, isInCart, addItem, removeItem, setCycle, clear }),
    [items, isInCart, addItem, removeItem, setCycle, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
