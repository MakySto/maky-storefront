# Known issues (tracked, not yet fixed)

Running log of confirmed issues that are deliberately deferred to a later, correct
fix — recorded here so they are not lost. Each entry says WHERE it must be fixed.

## must-fix-before-launch

### Saleor shipping zones/rates missing per launch market (checkout dead-ends)

- **What:** the `sk-eur` channel had **no shipping method** for SK addresses — `checkout.shippingMethods`
  came back `[]`, so the checkout v2 Shipping step showed "No shipping methods available for Slovakia"
  and could not proceed to Payment. Marek added a **"Kuriér – Slovensko" 5,90 €** rate manually
  (2026-07-08) and the flow then completed (Information → Shipping → "Continue to payment", Order
  Summary computed shipping + total).
- **Fix (B.9 / launch checklist):** verify a shipping **zone + rate** exists for **every launch market**
  (all 13 `CHANNEL_MAP` channels, or at least the go-live subset) BEFORE live — a missing rate silently
  dead-ends checkout at the Shipping step. This is Saleor merchant config, not a frontend bug.
- **Source:** discovered during the B.4.3 browser-proof, 2026-07-08.

### set-password route leaks the raw token + sets dead cookies

- **Where:** `src/app/api/auth/set-password/route.ts` (~:78–96)
- **What:** the route returns the raw Saleor **token in the JSON response**, and sets
  HttpOnly `token`/`refreshToken` cookies that **nobody reads** (the session lives in the
  auth-sdk cookies). Net effect: after a password reset the user is not actually logged in
  though the UI implies success, and a sensitive token is exposed in a response body.
- **Severity:** must-fix-before-launch (security + broken auth UX).
- **Do NOT fix in the SEO/hygiene branch.** The correct fix belongs to the **BFF auth
  foundation (Track B, Spec B §4 step 2)** — the route becomes the first internal consumer
  of the `/api/auth/login` BFF contract; the dead cookies and the token-in-body both go away
  when auth moves to server-set session cookies via `resolveSessionUser`.
- **Source:** `checkout-v2-migration-inventory.md §5` (landmine a) · O1 routing inventory.

### Unknown top-level segments render 200 index,follow (no market gate)

- **What:** `src/proxy.ts` has no market gate — any unknown first path segment falls through
  to `NextResponse.next()` and renders **HTTP 200 with `robots: index, follow`** instead of a
  404/noindex. Verified on a spare-port build (2026-07-06): `/admin`, `/products/login`,
  `/products/signup`, and single-segment legacy WordPress URLs (e.g.
  `/pilcicke-nohavice-engelbert-strauss-kwf-profi`) all return **200 index,follow**. (Deep
  legacy paths like `/…/kwf-profi/detail` already 404; `/sk-eur/*` correctly 301s to `/sk/*`.)
- **Impact:** Google indexes ghost/junk URLs. The SEO hygiene branch mitigates this with
  robots.txt Disallow (`/admin`, `/*/login$`, `/*/signup$`) + GSC Removals, but robots only
  blocks future crawling — it does **not** deindex, and GSC Removal is temporary (~6 months)
  unless the URL returns 404/noindex. So permanent removal needs a real gate.
- **Fix (separate, §10-approved task — NOT part of the hygiene branch):** add a **market gate**
  that returns **404/noindex for unknown channels** (first segment not in `FRIENDLY_SLUGS` /
  `SALEOR_SLUGS`). It **must not** break `/_next/*`, `/api/*`, `/robots.txt`, `/sitemap.xml`,
  static assets, or webhooks — routing is easy to break, so this needs its own validation.
- **Source:** O1 routing inventory §1 (no market gate) · SEO hygiene branch runtime verify 2026-07-06.

## deferred (truthfulness + design — fix in Track B / design track)

### Cart drawer vs /checkout Order Summary truthfulness inconsistency (temporary, intentional)

- **What:** the cart drawer trust signal was fixed to **"Bezpečný nákup"** (was the untruthful
  "30-day returns"), BUT `/checkout` **Order Summary still shows** `Shipping: Free`
  (`src/checkout/views/saleor-checkout/order-summary.tsx:323`) + a **"30-day returns"** trust
  badge (`:365–367`) + a **"Free shipping"** trust badge (`:373–376`), and the whole checkout is
  in **English**.
- **Why deferred:** checkout is §10-protected (checkout logic) and gets replaced wholesale in
  **Track B** (checkout v2 adoption). Editing it piecemeal now risks the §10 surface.
- **Truthfulness:** "Free shipping" is untrue (MAKY has no free shipping — FedEx, price shown in
  cart); "30-day returns" is untrue (statutory **14 days**; 30 only maybe later for registered
  users).
- **Fix:** unify in **Track B** — checkout v2 adoption + Spec B §9 truthfulness cleanup + SK i18n
  (drop "Free shipping", correct the returns wording, localize the whole Order Summary).
- **Source:** homepage-truthfulness branch (cart drawer fixed 2026-07-07); checkout left as-is.

### Hero banner is hardcoded — Marek wants an editable banner

- **What:** the homepage hero (`src/ui/components/homepage/hero-section.tsx`) is hardcoded
  text + CTA. Marek wants an **editable banner** (image + text + CTA) changeable **without a
  deploy**.
- **Fix (REDESIGN item, NOT part of the truthfulness fix):** rebuild the hero as an
  editable-banner system — **Payload CMS** (planned stack) or **Saleor metadata** as an interim
  source. Separate frontend feature on its own track.
- **Source:** Marek, 2026-07-07 (during homepage-truthfulness work).

## resolved (Track B)

### RESOLVED (B.4.3): checkout/order RSC fetch was silently broken — `toTypedDocument` duplicated fragments

- **What:** the B.4.2 server GraphQL bridge `toTypedDocument`
  (`src/checkout/lib/server/to-typed-document.ts`) sent `document.loc.source.body`. graphql-tag
  assembles that raw string by concatenating interpolated fragment sources **without de-duping**,
  so a fragment reused across a query (`Money` — checkout ×3, order ×2) appears multiple times.
  Saleor rejects it: `There can only be one fragment named "Money"`. **Every** server fetch that
  uses a fragment (`fetchCheckoutOnServer`, `fetchCheckoutUserOnServer`,
  `fetchChannelCountriesOnServer`, `fetchOrderOnServer`) therefore returned `null` — so `/checkout`
  never reached ready-state and order confirmation always rendered not-found.
- **Why it slipped through:** **B.4.2 was declared done but never rendered a real checkout.** Its
  smoke only proved SSR-no-crash + the not-found/empty paths (build/tsc pass a colourless/empty
  render); no one drove a real checkout id to ready-state, so the latent bug was invisible.
- **Fix:** `78204cf` (leading commit of the B.4.3 branch) — print the de-duplicated AST with
  graphql's `print` instead of the raw source (graphql-tag already de-dupes the parsed
  `definitions`); defensive keep-first dedupe by fragment name; `graphql@16.8.1` added as an
  explicit dep (already in-tree via graphql-tag, pinned — no duplicate copy). Unit test in
  `to-typed-document.test.ts`.
- **Proof:** `/checkout?checkout=<real sk-eur id>` now SSRs **ready-state** (item + €389,90 +
  Information step) where it previously showed "Checkout not found". **This fix is the de-facto
  completion of B.4.2's ready-state**, done as the prerequisite for B.4.3.
- **Source:** discovered during the B.4.3 browser-proof, 2026-07-08 (branch-only, prod untouched).

### RESOLVED (B.4.3): guest checkout mutations didn't persist + provider went stale after shallow nav

- **What:** on the first real guest browser run, Information data (email + shipping address) didn't
  carry into the Shipping step. Two pre-existing B.4.2 bugs: (1) the checkout-data mutations
  (email/shipping-address/billing-address/delivery-method) ran through `executeAuthenticatedGraphQL`
  — for a guest (no session) that path doesn't persist yet returns transport-ok, so the step advanced
  with nothing saved; (2) after save the client `CheckoutDataProvider` kept the stale (address-less)
  snapshot, because B.4.3's shallow `?step=` removed the incidental RSC refetch B.4.2's `router.push`
  did.
- **Fix:** `0039bdf` — the four checkout-id-keyed mutations → `executePublicGraphQL` (checkout id is
  the credential; customer-attach / set-default-address stay authenticated; complete / transaction
  untouched = B.4.4/B.8); `information-step` + `shipping-step` `await refetch()` after a successful
  save, before `onNext()` (only on a real save — bare stepper jumps stay pure `pushState`).
- **Status:** **B.4.3 ACCEPTED** (browser-proof passed end-to-end, 2 products; tip `0039bdf`,
  branch-only, prod untouched).

### RESOLVED (pre-B.4.4, `6e07357`): Payment step summary "Method" row showed "—"

- **What:** at the Payment step, the summary context row **"Method"** displayed `—` even though the
  Order Summary correctly applied the chosen shipping method and total.
- **Fix:** `6e07357` — `formatShippingMethod` matched `deliveryMethod.__typename` but the fragment
  omits `__typename` (runtime returns just `{id}`); fragment-free local fix matching
  `deliveryMethod?.id` (no `CheckoutFragment`/codegen touch). Landed as B.4.4 prep (D2).

### RESOLVED (B.8, 2026-07-19): real order → /checkout/complete render PROVEN

- The long-open B.4.3 caveat is closed: Stripe test-mode E2E created real sk-eur orders (#1, #2,
  `FULLY_CHARGED`/`isPaid`), `/checkout/complete?order=<id>` rendered the REAL order for an
  anonymous guest (public `order(id)` read works), and reloading the confirmation page produced
  zero new transactions.

## LAUNCH-TRACKING (must close before live — verify in B.9/B.10)

- **(a) sk-eur shipping config:** "Kuriér – Slovensko" was added manually in Saleor; verify
  shipping zones + rates for ALL launch markets before live — a missing rate silently dead-ends
  checkout at the Shipping step.
- **(b) RESOLVED (B.7, 2026-07-19):** checkout copy incl. payment/gateway errors is Slovak
  (hardcoded static-sk; catalog 13/13 parity intact).
- **(c) 3DS manual click-through pending:** headless E2E of the 3DS card is blocked by Stripe
  Radar's invisible hCaptcha (bot detection — must not be automated). Manually verify once with
  test card 4000 0027 6000 3184 (challenge modal → order) before live. The return/resume pipeline
  is the adopted upstream implementation.
- **(d) logged-in checkout run pending:** needs a real confirmed account; verify sign-in →
  attach → pay once before live (guest flow fully proven).
- **(e) test orders #1/#2 in Saleor:** created by the B.8/B.9 E2E (test-mode Stripe, no real
  money). Cancel/ignore them before live reporting.
