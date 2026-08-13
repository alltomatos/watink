import pluginApi from "../../../services/pluginApi";
import type { CartCheckoutResponse } from "../../../types/api";

export interface CartCheckoutItem {
  slug: string;
  cycle: string;
}

export async function createCartCardCheckout(
  items: CartCheckoutItem[],
  returnUrl: string,
): Promise<CartCheckoutResponse> {
  const { data } = await pluginApi.post<CartCheckoutResponse>("/plugins/cart/checkout", {
    items,
    returnUrl,
  });
  return data;
}

export async function createCartPixCheckout(
  items: CartCheckoutItem[],
  payerEmail: string,
): Promise<CartCheckoutResponse> {
  const { data } = await pluginApi.post<CartCheckoutResponse>("/plugins/cart/checkout/pix", {
    items,
    payerEmail,
  });
  return data;
}
