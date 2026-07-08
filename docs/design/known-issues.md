# Known issues (tracked, not yet fixed)

Running log of confirmed issues that are deliberately deferred to a later, correct
fix — recorded here so they are not lost. Each entry says WHERE it must be fixed.

## must-fix-before-launch

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
