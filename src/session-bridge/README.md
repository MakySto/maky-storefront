# session-bridge

Shared contract between the **storefront** surface (browse, cart) and the **checkout** surface (transactional flow). Imported via the `@/session-bridge` alias (MAKY fork; upstream ships this as the `@paper/session-bridge` package).

## Rules

- **Storefront** may import `@/session-bridge` and must not import `@/checkout/*` UI or hooks.
- **Checkout** may import `@/checkout/*` and `@/session-bridge`; it must not import catalog/PDP/cached data layers.
- No React in this folder — safe for server cart code and client checkout.

## Contents

| Module             | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `cookies.ts`       | `checkoutId-{channel}` cookie name                             |
| `checkout-url.ts`  | `buildCheckoutPath`, `buildOrderConfirmationPath`, URL helpers |
| `search-params.ts` | URL param map, `getQueryParams`, `createQueryString`           |

## MAKY variant C (routing)

MAKY keeps a single friendly market prefix (`/sk`, `/cz`, …) mapped to a Saleor channel via
`CHANNEL_MAP` (`@/lib/channel-map`). There is **no `[locale]` URL segment** (unlike upstream's
`/{locale}/{channel}/…`). Consequences for this module:

- The checkout surface lives at `/checkout` **outside** the `/{market}` prefix — `buildCheckoutPath`
  intentionally emits a channel-less path. The active checkout id (`?checkout=`) is the credential;
  the channel is recovered from `checkout.channel.slug`.
- The `checkoutId-{channel}` cookie is keyed by the **Saleor slug** (e.g. `checkoutId-sk-eur`),
  because `src/proxy.ts` rewrites `/sk/*` → internal `/sk-eur/*` so the app always receives the
  Saleor slug as `channel`.
- `buildCheckoutPath`'s `browseLocale` is **not** sourced from a URL segment here. When a locale
  needs syncing to checkout, derive it from the channel via
  `CHANNEL_MAP[REVERSE_MAP[saleorSlug]].locale`. Current call sites pass none, so no `?locale=` is
  emitted.

## Checkout v2

Active checkout: `/checkout?checkout=`. Order confirmation: `/checkout/complete?order=` (separate route).

> Adoption note (Track B): this module is adopted in **B.4.1**. Its only consumers so far are the two
> cart→checkout handoffs (`buildCheckoutPath`). The `(checkout)` route group and the dedicated
> `/checkout/complete` order-confirmation route land in **B.4.2**; `buildOrderConfirmationPath` is
> adopted as a pure builder but not yet wired.

## Hosted checkout (optional)

Set `NEXT_PUBLIC_CHECKOUT_URL=https://checkout.example.com` so `buildCheckoutUrl` returns absolute links. Optional middleware can block non-checkout routes on a checkout-only deploy.
