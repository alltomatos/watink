import { Contact } from "./Ticket";

export interface WhatsAppSession {
  id: number | string;
  qrcode?: string;
  pairingCode?: string;
  status?: string;
}

export interface WhatsAppSessionSocketEvent {
  action: string;
  session: WhatsAppSession;
}

export interface SocketMessageEvent<T> {
  action: 'create' | 'update' | 'delete';
  message: T;
  ticketId?: number | string;
}

export interface SettingPayload {
  key: string;
  value: string;
}

export interface SettingSocketEvent {
  action: "update" | "delete";
  setting: SettingPayload;
}

export interface PluginsPayload {
  active: string[];
}

export interface PaginatedContacts {
  contacts: Contact[];
  count: number;
  hasMore: boolean;
}

export interface TicketCreatePayload {
  contactId: number | string;
  userId: number | string;
  status: "open" | "pending" | "closed";
}

/** Shape of a single plugin entry returned by /plugins/catalog */
export interface CatalogPlugin {
  id: string | number;
  slug: string;
  name: string;
  description: string;
  /** Rich text for the detail page (line breaks preserved, no markdown). */
  longDescription?: string;
  version: string;
  type: "free" | "pro";
  price: number;
  /** Global tax rate (e.g. 8) shown alongside price for `pro` plugins — same for every plugin, not per-item. */
  taxRatePercent?: number;
  category: string;
  iconUrl?: string;
  /** Gallery images sourced from the plugin's Hub catalog registration. */
  screenshots?: string[];
}

/** Response shape of GET /plugins/catalog */
export interface PluginCatalogResponse {
  plugins: CatalogPlugin[];
  /** Present when the manager is unreachable and returns stale cache */
  offline?: boolean;
}

/** Entitlement info bundled in the installed response */
export interface PluginEntitlements {
  plan_name?: string;
  [key: string]: string | number | boolean | undefined;
}

/** Response shape of GET /plugins/installed */
export interface PluginInstalledResponse {
  active: string[];
  entitlements?: PluginEntitlements;
}

/**
 * Error body of POST /plugins/:slug/activate when the plugin has no valid
 * license (HTTP 402). checkoutRequested tells whether the business
 * successfully asked the plugin-manager (which asks the Hub) to
 * create/reactivate the license — the Hub creates the license record
 * synchronously, but the signed token only reaches the plugin-manager on
 * the next heartbeat, so a 402 with checkoutRequested=true still means the
 * plugin isn't active yet; the client must retry /activate later (poll).
 */
export interface PluginActivateUnlicensedResponse {
  error: "plugin_unlicensed" | "plugin_tenant_cap_reached" | string;
  checkoutRequested?: boolean;
  message?: string;
}

/** Response shape of POST /plugins/:slug/checkout (Checkout Pro — Mercado Pago) */
export interface CheckoutOrderResponse {
  orderId: number;
  /** Preço já com o imposto embutido (congelado pelo Hub), em centavos. */
  amountCents: number;
  /** URL de redirect para a página de pagamento hospedada pelo Mercado Pago. */
  checkoutUrl: string;
}
