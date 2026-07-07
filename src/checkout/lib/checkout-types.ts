import type { CheckoutQuery, CountryCode, UserQuery } from "@/checkout/graphql";

/** Checkout object returned by the server-side checkout query. */
export type ServerCheckout = NonNullable<CheckoutQuery["checkout"]>;

/** Load state resolved by the RSC checkout-session-loader. */
export type CheckoutLoadState = "none" | "not_found" | "empty" | "error" | "ready";

/** Customer profile from `me` — shared by RSC fetch and client context. */
export type CheckoutUser = NonNullable<UserQuery["user"]>;

/** Result of `fetchCheckoutOnServer` — distinct from the client checkout context state. */
export type CheckoutFetchResult = { ok: false } | { ok: true; checkout: ServerCheckout | null };

/** Country codes a channel ships to (for address forms). */
export type ShippingCountries = CountryCode[];
