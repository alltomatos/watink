export interface MarketplacePlugin {
  id: string | number;
  slug: string;
  name: string;
  description?: string;
  version?: string;
  type?: string;
  category?: string;
  price?: number;
  /** Global tax rate (e.g. 8) shown alongside price for `pro` plugins — same for every plugin. */
  taxRatePercent?: number;
  /** Whether this plugin can be bought with a one-time payment (perpetual license) besides/instead of the cycles below. */
  singlePaymentEnabled?: boolean;
  /** Recurring pricing cycles registered in the Hub — empty for free plugins. */
  pricingCycles?: PricingCycleEntry[];
  iconUrl: string;
  installed: boolean;
  active: boolean;
}

export interface PricingCycleEntry {
  cycle: string;
  priceCents: number;
  periodDays: number;
}

export interface MarketplaceEntitlements {
  plan_name?: string;
  [key: string]: unknown;
}

export type ViewMode = "grid" | "list";
