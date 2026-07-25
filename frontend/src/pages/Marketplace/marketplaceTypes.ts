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
  iconUrl: string;
  installed: boolean;
  active: boolean;
}

export interface MarketplaceEntitlements {
  plan_name?: string;
  [key: string]: unknown;
}

export type ViewMode = "grid" | "list";
