# PDP Purchase Panel — design-intent spec

**Status:** design intent (written spec = our design source per CLAUDE.md §2). Implementation
branch: **`feat/pdp-purchase-panel`** (off `feat/token-bridge`). Implement in small commits,
validate, report before commit.
**Date:** 2026-06-21 · companion to `docs/design/storefront-analysis-20260621.md`.

## Decisions (locked 2026-06-21)

1. **Quantity wiring = APPROVED (Option A).** The stepper must be **functional, not cosmetic**.
   Sending `$quantity` to the existing `checkoutLinesAdd` is **additive use of an API that already
   supports quantity** — it changes no cart/checkout flow or structure, which is what §10 protects, so
   it is within §10's spirit, not an exception. A stepper that always adds 1 (Option B) is a UX lie
   (customer thinks 3, gets 1) and was never shippable → Option A or no stepper. **Condition:** land
   it as its **own isolated commit** (mutation + `pnpm generate` + action), **verified before** any
   visual layout is stacked on it, so a cart regression can be reverted alone.
2. **This spec is committed** docs-only (`docs: add PDP purchase panel redesign spec`).
3. **Figma is not a blocker.** Build from this spec → verify on the real PDP → document the states in
   Figma afterward (page 08 + the panel). Code canonical, Figma mirror.

Two sharp caveats baked into the layout/validation below:

- **(a) `quantityAvailable` is Saleor-capped** (≈50 by config, NOT true stock) → use it as a stepper
  cap and for `0 → Vypredané`, but **show no false low-stock urgency** ("ostáva N") for a possibly
  high-stock product. Default to plain "Skladom / Vypredané".
- **(b) Verify line-merge**, not just "2 = 2": add 2, then add 2 of the same variant → expect 4 (or
  correct merge), no duplicate/broken lines.

## Goal

Turn the bare purchase block (title · price · one full-width button · trust line) into a
**decision-complete panel**: the customer instantly sees price, fit, availability, delivery,
and adds a chosen quantity without hesitation. Conversion, not decoration. The compatibility
box is the home of the product's moat (fitment) — built here as UI states, wired in Step B.

## Scope

**In:** the PDP right-hand purchase column + mobile sticky bar — i.e. `src/ui/components/pdp/add-to-cart.tsx`, `sticky-bar.tsx`, the "Doprava a vrátenie" copy in `product-attributes.tsx`, a thin pass on `variant-section-dynamic.tsx` to feed stock/quantity, and **new** sub-components (QuantityStepper primitive, CompatibilityBox, StockRow, DeliveryRow). i18n keys for the new/changed copy (13 locales).

**Out:** Saleor/checkout/CFM, the cart drawer & cart page, routing, the **variant-selection subsystem**, ProductCard, PLP, homepage. No new dependencies. Keep hand-rolled `cn()` (no `cva`).

## Grounding (verified in code, 2026-06-21)

- **Column assembly** — [products/[slug]/page.tsx:179](<src/app/[channel]/(main)/products/[slug]/page.tsx#L179>): right column is a `flex flex-col gap-3` using CSS `order-*`: `order-1` category+badges & `order-3` form (both from `VariantSectionDynamic`), `order-2` h1, `order-4` accordions (`ProductAttributes`). The purchase rows live **inside `AddToCart`** (currently: price → full-width button → trust).
- **One form wraps everything** — [variant-section-dynamic.tsx:135](src/ui/components/pdp/variant-section-dynamic.tsx#L135) `<form action={addToCart}>` contains the variant selectors, `AddToCart`, and `StickyBar`. ⇒ a single `name="quantity"` field is submitted by **both** the main and sticky CTAs.
- **Stock data exists** — `variant.quantityAvailable` ([VariantDetailsFragment.graphql:5], used at [variant-section-dynamic.tsx:40-48](src/ui/components/pdp/variant-section-dynamic.tsx#L40)). Real availability + a quantity cap are possible. `product.lowStock` ("Posledné kusy") i18n key already exists.
- **Quantity is hardcoded to 1** — `src/graphql/CheckoutAddLine.graphql`: `lines: [{ quantity: 1, variantId: $productVariantId }]`; the `addToCart` action passes only `id` + `productVariantId`. **See "Decision: quantity wiring".**
- **Fitment i18n already present** (`fitment` namespace): `selectVehicle, changeVehicle, fits, doesNotFit, verifyFit, checkFitment, fitsVehicle, noVehicleSelected, brand, model, generation, …` — reuse; only a few new keys needed.
- **Free-shipping strings** — remove/rewrite **in scope:** `add-to-cart.tsx:114` (`product.freeDeliveryOver` "Doprava zadarmo nad €100") and `product-attributes.tsx:119` (`product.freeShippingText`). **Other branches:** `cart-drawer.tsx` (free-shipping progress bar — cart, §10) and `why-maky.tsx` / `trust.freeShipping*` (homepage — Step G).

## Desktop layout — right column, top → bottom

1. **Category + title** — keep (`order-1` badges row, `order-2` h1).
2. **Price** — keep prominent (graphite, price tokens). Struck `compareAtPrice` + sale price when a compare-at exists; otherwise current only. (Local renderer now; swap to the shared `Price` primitive in Step C.)
3. **Compatibility box** — directly under price, above the buy row (fit is the #1 question). **Visual states only this branch** (see below). Never blocks add-to-cart.
4. **Availability row** — derive from real `quantityAvailable`, but it is **Saleor-capped** (a config max ≈50, NOT true stock): `0` → "Vypredané" (disabled CTA, muted/danger); `> 0` → "Skladom" (stock-in/green). **Do NOT show "Posledné kusy / ostáva N" merely because `quantityAvailable` is low** — for a high-stock product that's false-urgency (the same class of false claim we remove elsewhere); show low-stock only if you can be sure it's genuinely low, not the API cap. No variant selected yet → neutral fallback "Dostupnosť overíme pri objednávke". **Never fabricate "Skladom".**
5. **Delivery row** — "Doručenie cez FedEx · cenu dopravy uvidíte v košíku". No invented days; show a real estimate only if data exists (none today).
6. **Buy row** — quantity stepper **+** add-to-cart side by side (NOT one giant full-width button):
   - **Quantity:** `[ − ] 1 [ + ]`, ~96–120px, min 1, integer, capped at `quantityAvailable` when known. **New reusable primitive** (`QuantityStepper`) — cart reuses it later. Renders a `name="quantity"` value into the form.
   - **Add-to-cart:** green `--cta`, strong, full row-height, sized to the **remaining** width — clearly primary, not absurdly wide. Loading state while adding; disabled when out of stock / no selection.
7. **Trust row** — compact, truthful: "Bezpečný nákup · 30 dní na vrátenie · Záruka 2 roky". **Remove "Doprava zadarmo nad €100" entirely.**
8. **Existing accordions** (Popis / Detaily produktu / Doprava a vrátenie) — keep; rewrite the **Doprava a vrátenie** copy to FedEx + 30-day-return + 2-year-warranty wording (no free-shipping claim).

## Compatibility box — visual states (this branch: UI only, safe fallback copy)

Render all four behind a simple `status` prop (default `no-vehicle`). Data wiring is Step B. **Never block add-to-cart on the compatibility state.**

| State                    | Copy                                                                                                                                                  | Tokens                                  | i18n                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| **No vehicle** (default) | "Overte kompatibilitu s vaším vozidlom" + sub "Vyberte značku, model a rok — zobrazíme, či je produkt vhodný pre vaše auto." + **[ Vybrať vozidlo ]** | neutral/info                            | reuse `fitment.checkFitment`/`selectVehicle`; **new** sub-line                       |
| **Compatible**           | ✓ "Overená kompatibilita" + "Vhodné pre: {Značka} {Model} {Generácia} ({roky})" + **[ Zmeniť vozidlo ]**                                              | success (forest)                        | reuse `fitment.fitsVehicle`, `changeVehicle`; **new** header "Overená kompatibilita" |
| **Incompatible**         | "Tento produkt nie je vhodný pre vybrané vozidlo" + **[ Zobraziť vhodné produkty ] [ Zmeniť vozidlo ]**                                               | danger/muted — cautionary, not alarming | reuse `fitment.doesNotFit`, `changeVehicle`; **new** "Zobraziť vhodné produkty"      |
| **Universal**            | "Univerzálny produkt — vhodný pre väčšinu vozidiel"                                                                                                   | info / neutral                          | **new**                                                                              |

## Quantity stepper primitive (new)

`src/ui/components/ui/quantity-stepper.tsx` — `{ value, onChange, min=1, max?, name?, disabled? }`. `[−] n [+]`, integer, clamped `[min, max]`, ~96–120px, control-height token (44px EAA), keyboard accessible, `aria-label`s. Emits a hidden/controlled `name="quantity"` value for the form. Reused by the cart later (don't over-fit to PDP).

## Quantity wiring — APPROVED (Option A), isolated commit

The minimal change (approved):

- `CheckoutAddLine.graphql`: add `$quantity: Int!` → `lines: [{ quantity: $quantity, variantId: $productVariantId }]`, then `pnpm generate`.
- `addToCart` action: read `formData.get("quantity")` (integer, clamped to `[1, quantityAvailable]` when known) and pass it.

**Why it's in §10's spirit, not an exception:** §10 protects cart/checkout _integrity_; passing a
quantity the mutation already accepts changes no flow or structure — additive use of the existing API.
**Hard condition:** ship it as its **own isolated commit** (mutation + generated types + action),
**verified before** the visual layout is built on top (qty 2 → 2 in cart; re-add merges correctly),
so a cart regression can be reverted alone. No other cart/checkout internals change.

## Mobile

Redesign the sticky bottom bar: price + quantity (shared form field) + green CTA + a one-line fit/stock hint. i18n the currently-hardcoded "Adding…/Add to bag" ([sticky-bar.tsx:51](src/ui/components/pdp/sticky-bar.tsx#L51)). Must not cover key content.

## Tokens / primitives

- Buy button green = `--cta` (live post-bridge). Stock/trust greens = `--stock-*` / `--color-status-*`. **Never brown for buy.**
- Quantity stepper = new primitive (cart reuses it).
- Price: local renderer here; shared `Price` primitive extracted in Step C and swapped in then.

## i18n (13-locale tax)

Reuse the `fitment` namespace where possible. **New/changed keys** (add to all 13, keep 223→N parity; run the parity script from CLAUDE.md §11): compatibility header "Overená kompatibilita", universal line, "Zobraziť vhodné produkty", no-vehicle sub-line; stock states (reuse `lowStock`, add "Skladom"/"Vypredané"/neutral fallback if missing); delivery FedEx line; quantity aria-labels; trust line; rewritten `product.freeShippingText`. Stop using `product.freeDeliveryOver` in the panel (key may remain defined). Keep copy off non-copy branches.

## Validation (per CLAUDE.md §11 + §13)

- `typecheck` + `lint` + `next build`.
- **Build safety (§13):** never `next build` in `/opt/storefront` while PM2 serves it — build in an isolated worktree, or `pm2 stop → rm -rf .next → build → spare-port verify → pm2 start`.
- **i18n parity** check (13 locales) after copy changes.
- **Light-mode visual check** on a roof-rack PDP (e.g. Thule): buy row not full-width, quantity works, all 4 compatibility states render via the prop, **no free-shipping string anywhere**, mobile sticky usable, add-to-cart green.
- **Cart correctness (the risky part):** qty 2 → cart shows **2**; then add 2 of the same variant again → **4** (or the correct line-merge), no duplicate/broken lines. Same merge path as today's qty-1, but verify.
- Report before commit; commit only on approval.

---

## Roadmap — branches after this one

- **B — Vehicle selection + fitment contract** (the moat's plumbing; wires the compatibility box). Vehicle-selection **state + persistence for the visit via cookie or URL param (NOT localStorage — SSR app)**, read by PDP now / PLP later (set once, reused). "Vybrať vozidlo" trigger opens a minimal cascading make→model→generation/year selector over a **small mock dataset**. Typed contract behind a mock: `VehicleSelection` + `FitmentResult` + `getFitment(productId, vehicle)`. **Real CFM fitment (parallel track) replaces only `getFitment`** — box, states, contract untouched.
- **C — `Price` primitive.** Extract the duplicated `Intl.NumberFormat` + compare/sale layout once; adopt in PDP, PLP, cart, sticky bar.
- **D — Button primitive.** Standardize sizes/states (hover/disabled/loading, icon slots, optional `fullWidth`). Renders correctly post-bridge; this is one clean polish pass (touches almost everything).
- **E — ProductCard.** On Price + Badge + Button: brand, type, availability, price, compatibility badge (reads Step-B vehicle state), "Kompletná zostava: tyče + pätky + kit", sale/new badges, and a **graceful image fallback** — PLP currently shows broken/placeholder images, so the card must degrade to a clean placeholder with the product name regardless of why an image is missing.
- **F — PLP vehicle integration.** Filter/badge the listing by the selected vehicle (uses Step-B state).
- **G — Homepage cleanup.** Remove free-shipping claims, the "13 markets / 4 suppliers" hero line, English empty-state placeholders; hide empty featured; fix the brand strip; remove "Ťažné zariadenia" from hero/categories until the install model is confirmed.

## Figma's role (per CLAUDE.md §2)

Code is canonical; Figma is a one-way **mirror + sketch/documentation** space, **not** the source and **not** an MCP write target (Pro tier; no variable-write tool). For this work:

- **Build from this spec** (faster, code-canonical) — no Figma frame required to start.
- **Optional pre-sketch:** if you want to eyeball the buy-row proportions or the compatibility box first, sketch in Figma and share a **node-specific URL** — Claude can _read_ it (`get_design_context`/`get_screenshot`/`get_metadata`) to align the build.
- **Document after:** once built, capture the compatibility box's 4 states (your page 08) + the panel in Figma as the visual mirror.
- **Tokens → Figma** stays the manual `tokens.json` + Tokens Studio import at milestone cadence (not per-branch).
- Claude **cannot** screenshot the live site headlessly (no connected browser); live visual checks use the spare-port build, or the Chrome extension if connected.

## Implementation phasing (within the branch)

- **A — Technical prep (functional quantity).** Branch off `feat/token-bridge`. Edit
  `CheckoutAddLine.graphql` (`$quantity`), `pnpm generate`, action reads `quantity`, QuantityStepper
  bound to the form field. **Verify qty 2 → 2 and re-add → merges (caveat b) in the cart before moving
  on.** Own isolated commit (most reversible). This is the riskiest part (cart logic) → verify alone.
- **B — New purchase-panel layout.** Shrink CTA; quantity + CTA on one row; price up top; stock above
  the buy row; delivery row; trust row; remove the free-shipping claim. CTA green via `--cta`.
- **C — CompatibilityBox (visual only).** Default "Overiť kompatibilitu s vaším vozidlom"; `status`
  prop for all 4 states; never blocks add-to-cart; vehicle state wired in the next branch (Step B).
- **D — Mobile sticky.** Price + quantity + CTA + short stock/fit hint; 44px touch targets; don't cover content.
- **E — Validation.** typecheck/lint/build; i18n 13-locale parity if copy changed; PDP desktop + mobile;
  cart-correctness checks (caveat b); report before commit.

## Guard-rails — do NOT touch in this branch

Badge · Button refactor · ProductCard · PLP · homepage · real fitment backend · checkout redesign ·
Saleor integration beyond the minimal quantity mutation · CFM · routing/channel logic. **No production
deploy until the branch is visually approved.** Commit only on approval.

## 5-day outlook

- **Day 1 — PDP Purchase Panel** (this branch): functional quantity, better buy block, truthful delivery, compatibility placeholder.
- **Day 2 — Button + Price primitive:** extract the repeatable pieces _after_ seeing them in the real PDP.
- **Day 3 — ProductCard:** brand/type/availability/price/badge/compatibility + graceful image fallback.
- **Day 4 — PLP / category:** vehicle filter, listing, broken-image fallback, better presentation.
- **Day 5 — Homepage cleanup:** hero text, brands, drop towbars/free-shipping claims, featured, newsletter.

## Appendix — kickoff prompt for the new thread

Paste this as the first message in tomorrow's fresh thread (it tells Claude to load this spec + CLAUDE.md):

```text
We are starting the PDP Purchase Panel implementation in a fresh thread.

First read for full context: docs/design/pdp-purchase-panel-spec.md (this spec) and CLAUDE.md
(esp. §8 PDP rules, §10 restrictions, §11 validation, §13 build/deploy safety).

Base branch: feat/token-bridge. Create: feat/pdp-purchase-panel.

APPROVED DECISIONS
- Quantity wiring = APPROVED and must be FUNCTIONAL, not cosmetic. You may make the minimal change to
  CheckoutAddLine.graphql (add $quantity: Int!, use it instead of hardcoded 1), the generated GraphQL
  types (pnpm generate), and the addToCart server action (read quantity from the form). Land this as
  its OWN isolated commit and verify it before building the layout on top.
- Figma is not a blocker: build from the spec, verify on the real PDP, document in Figma after.

SCOPE (only this): PDP purchase area · QuantityStepper primitive · stock/availability row · delivery
row · CompatibilityBox visual structure (4 states, placeholder, no real fitment) · mobile sticky
add-to-cart · remove false free-shipping copy from PDP · necessary i18n keys across all 13 locales.

DO NOT TOUCH: Badge · Button refactor · ProductCard · PLP · homepage · real fitment backend · checkout
· Saleor beyond the minimal quantity mutation · CFM · routing/channel logic. No production deploy until
the branch is visually approved. Do not commit until approved.

IMPLEMENTATION (phase A → E):
- A Technical prep: GraphQL $quantity + pnpm generate + action reads quantity + QuantityStepper bound
  to the form field. Verify qty 2 → 2 in cart AND re-add merges (→4), before layout. Own commit.
- B Layout: shrink CTA; quantity + CTA side-by-side; price up top; stock above the buy row; delivery
  row; trust row; remove the free-shipping claim. CTA green via --cta.
- C CompatibilityBox: default "Overiť kompatibilitu s vaším vozidlom"; status prop for all 4 states;
  never blocks add-to-cart.
- D Mobile sticky: price + quantity + CTA + short stock/fit hint; 44px touch targets; don't cover content.
- E Validation.

RULES:
- Stepper min 1; if quantityAvailable is known, cap at it; if 0 → prevent add / show unavailable; if
  unknown → safe fallback (e.g. max 99). quantityAvailable is Saleor-capped (~50) — do NOT show false
  low-stock ("ostáva N"); default to plain Skladom / Vypredané.
- Delivery copy truthful: "Doručenie cez FedEx · cenu dopravy uvidíte v košíku". No invented days.
- Keep "30 dní na vrátenie" + "Záruka 2 roky" as cautious trust messages.

VALIDATION: pnpm generate (after GraphQL) · typecheck · lint · next build · i18n 13-locale parity if
copy changes · verify qty 2 added as 2 AND line-merge · PDP desktop + mobile · build per §13 (never
next build in /opt/storefront while PM2 maky-storefront serves it: pm2 stop → build → spare-port verify
→ pm2 start, or build in a separate worktree) · report before commit · do not deploy to prod · do not
commit until approved.
```
