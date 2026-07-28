# Product experience v2 — handoff

**Written 2026-07-28 at the end of the v1 session. Self-contained: everything a fresh
thread needs is here or linked from here.**

Read first, in this order: `CLAUDE.md` (§8 PDP, §10 restrictions, §11 validation,
§13 build/deploy safety), then this file. `docs/design/pdp-purchase-panel-spec.md` is
the older approved spec — its quantity/compatibility decisions still stand, but its
trust-row copy and "13 locales" are stale (see §6).

---

## 1. Where things stand

Production `maky.store` runs **`471c704`**, BUILD_ID **`OzpQ9e-0oQq4Ow8njyhuG`**,
PM2 `maky-storefront`, cwd `/opt/storefront` (detached HEAD).
Branch: **`feat/product-experience-v1`** — local == origin, worktree clean.
Rollback artifact: `/opt/storefront/.next.prev-backup` (the `9a02b27` build), listed
in `.git/info/exclude`.

Shipped this session, in order:

| commit    | what                                                                                 |
| --------- | ------------------------------------------------------------------------------------ |
| `cf3d89a` | functional quantity — `CheckoutAddLine` takes `$quantity`, QuantityStepper primitive |
| `9a02b27` | PDP: L1 hero, full-width specs, attribute units, SKU, manufacturer, VAT label        |
| `4fee281` | PLP: 4-column grid, rebuilt card, honest pagination, Slovak `/sk/products` header    |
| `3e6e302` | card buy-row overflowed the card; compact stepper, centred meta                      |
| `471c704` | availability read from the VARIANT; brand line; StarRating                           |

**The TAZAR migration is closed.** CFM finished on 2026-07-28: 453 products live,
slugs flipped to the SKU-last form. Old slugs no longer resolve in Saleor; the ten
legacy URLs still 308 from the static map in `src/lib/product-redirects.ts`, and
`previousProductSlug` is now dormant by design — leave it, it costs nothing and
documents the migration.

Last live acceptance: **0 failures** (10/10 redirects, 10/10 PDPs incl. gallery order,
canonical, JSON-LD, regression smoke). 241 tests, typecheck and lint clean.

---

## 2. The work queue (Marek's list, 2026-07-28)

### 2.1 Cart drawer is painted over — REAL BUG, do this first

The sticky category toolbar and the site header render **on top of** the open cart
drawer. Cause is exact and is a token-versus-raw-utility mismatch:

```
brand.css scale:  --z-header 100 · --z-dropdown 200 · --z-drawer 300 · --z-modal 400 · --z-toast 500

src/ui/components/plp/filter-bar.tsx:100   zIndex: var(--z-dropdown)  = 200
src/ui/components/ui/sheet.tsx:22,53       Tailwind z-50              =  50   ← drawer BELOW toolbar
src/ui/components/header/site-header.tsx:7 Tailwind z-40              =  40
```

The drawer should be `--z-drawer` (300) and the header `--z-header` (100). Fix in
`sheet.tsx` (overlay **and** content) and `site-header.tsx`. Check every other raw
`z-*` utility in the tree while you are there — this is the same class of defect as
the `scrollbar-hide` utility that was used but never defined. Grep:
`grep -rn 'z-\[\|z-[0-9]' src/ui src/app --include=*.tsx`.

Verify with the drawer open over a category page, at desktop and mobile.

### 2.2 "Kód produktu" → "SKU"

Card and PDP both use the `product.sku` i18n key, currently "Kód produktu". Change
the **value** to `SKU` in all 12 locale files (the key name stays). Files:
`src/i18n/messages/*.json`. Card: `src/ui/components/plp/product-card.tsx`;
PDP: `src/ui/components/pdp/variant-section-dynamic.tsx`.

### 2.3 Availability onto its own line, under the SKU

Today SKU and `AvailabilityBadge` share a flex row on the card. Marek wants
availability **below** the SKU. Same block in `product-card.tsx`.

### 2.4 Category and brand must be clickable

- **Category** is easy: the route `/{market}/categories/{slug}` exists and
  `product.category.slug` is already on the card. Wrap in `Link` via
  `marketHref(channel, "/categories/" + slug)`.
- **Brand is NOT easy and needs a decision before coding.** There is no brand route
  and no brand filter: `src/ui/components/plp/filter-utils.ts` filters on colour,
  size and price only, and there is no `/znacky` segment under
  `src/app/[channel]/(main)/`. Options: (a) link to `/sk/products?brand=<slug>` and
  add a brand facet to the existing filter pipeline; (b) create a real
  `/{market}/znacky/{slug}` listing route. (a) is smaller and reuses the toolbar;
  (b) is better for SEO. **Ask Marek before building either.**

### 2.5 Grid — Marek said "niekoľko vylepšení", unspecified

Ask him to point at specifics from the screenshots before changing anything.

---

## 3. Composite SKUs are now live — unhandled

The bundle SKUs the earlier review predicted have arrived. 6 of 100 sampled products:

```
PZ-GP019|PZ-GP020            GP/Peruzzo nosič na 2 bicykle
PZ-GP019|PZ-GP020|PZ-GP021   GP/Peruzzo nosič na 3 bicykle
M0000381|M0000276            Menabo Marius
A7604|A7604|A7604            Amos BIKE TURER – sada 3 (same part ×3)
M201307|M201307|M201307      Sada 3 ks T-adaptérov
```

They currently render raw, pipes and all, and at four columns the longest ones eat
the card's SKU line. Note `A7604|A7604|A7604` — a bundle of the SAME part repeated,
so "first segment only" would silently hide that it is a set of three.

Nothing is broken, but it looks wrong. Decide with Marek: first segment plus a count
("A7604 ×3"), a "Obsah setu" expandable list, or leave raw. Do not guess.

---

## 4. Known gaps deliberately NOT built

- **CompatibilityBox at the CTA** — CLAUDE.md §8 requires it, but every TAZAR product
  is fitment-universal with no compatibility data. Building it means either asserting
  vehicle fitment that cannot be substantiated, or shipping a "Vybrať vozidlo" button
  that does nothing. Data decision, not a layout one.
- **`vehicle-selector-trigger.tsx` is a dead button** — no `onClick`, no state, no
  filtering. The most prominent control in the header does nothing.
- **Reviews** — `Product.rating` exists in the schema and is `null` across the whole
  catalogue. `StarRating` already renders nothing until something populates it.
- **EAN** — no Saleor GTIN/EAN field, no `cfm:attribute:ean`, variant metadata carries
  only `cfm_availability_mode`. There is nothing to display.
- **Related products** — needs a rule for what "related" means. Not decided.
- **`en-CA` is missing 211 i18n keys** including all of `checkout.*`, and `/ca` is
  live (HTTP 200). A separate session is on it. `scripts/i18n/check-locale-matrix.mjs`
  does NOT catch this — it validates which locales exist, not key parity. Use the
  CLAUDE.md §11 inline script.
- **Sitemap has no product URLs** at all. Pre-existing.

---

## 5. Facts that will cost you hours if you assume otherwise

**MAKY.STORE IS A VAT PAYER.** Saleor computes it (net 812,20 / gross 999,00 /
tax 186,80 = 23 %) and the storefront renders `gross`, so displayed prices already
include VAT and both PDP and card say "Cena s DPH". Any older prompt saying
"non-VAT payer, never write DPH" is obsolete and now legally wrong.

**Availability lives on the VARIANT**, not the product:
`metafield(key: "cfm_availability_mode")`. Verified live — 100/100 sampled variants
carry it, 0/100 products do. Reading it from the product renders nothing and fails
**silently**, because an absent metafield is indistinguishable from "not published
yet". That exact bug shipped and was caught only by looking at a screenshot.

**Never derive availability from `quantityAvailable`.** It is a synthetic Saleor cap
(50 for every variant, `trackInventory=false`, no stocks). Safe as a stepper ceiling
and for a hard zero; never as "Skladom" or "posledné kusy".

**Attribute units** are in `src/lib/product-attributes.ts`, keyed on
`externalReference` (`cfm:attribute:weight`) — never on the display name (translatable)
or slug (editable). `Attribute.unit` is null on all 13 numerics and
`MeasurementUnitsEnum` has **no speed unit**, so km/h can never be native.
`max_tire_width` and `max_wheelbase` are deliberately unitless: no catalogue values
exist and mm/cm/inch are all plausible. An invented unit is a claim about the product.

**Numbers go through `Intl`** (`formatNumber` in `src/config/locale.ts`). Slovak wants
a decimal comma and a non-breaking space before the unit: `25,2 kg`, `232 × 92 × 45 cm`.

**12 locales, not 13.** `en-GB` was removed 2026-07-20.

**Saleor `products` is a Relay cursor connection with no offset.** Numbered pagination
cannot be done honestly without storing every cursor. `totalCount` is available and
cheap. Current pagination is prev/next and renders nothing when everything fits on
one page.

**Tailwind v4, CSS-first, no `tailwind.config.js`.** An undefined utility or
`--color-*` emits NOTHING and the build still passes. `next build` passing certifies
nothing about styling — look at the page.

---

## 6. Corrections to `pdp-purchase-panel-spec.md`

That spec is still the authority on the quantity decision (Option A, isolated commit —
done) and the compatibility-box states. Two parts are superseded:

- It says the trust row should read "30 dní na vrátenie · Záruka 2 roky". The return
  window is **14 days guest / 30 days registered**, so no single number may appear
  next to the buy button. The shipped trust block links to the returns page instead.
- It says 13 locales. It is 12.

---

## 7. How to work on this box

Full recipe in the `feedback-storefront-deploy-recipe` and `feedback-vps-visual-review`
memory files. Short version:

```bash
# worktree — /opt is root-owned, so worktrees go under /home/ubuntu
git worktree add --detach /home/ubuntu/wt-<name> <sha>
cp -al /opt/storefront/node_modules /home/ubuntu/wt-<name>/node_modules   # deps unchanged → no install
cp -p /opt/storefront/.env /home/ubuntu/wt-<name>/.env
cp -r /opt/storefront/.husky/_ /home/ubuntu/wt-<name>/.husky/_            # else commits fail
```

Build and run on a spare port, then **screenshot and look at it**:

```bash
/home/ubuntu/.cache/ms-playwright/chromium-1228/chrome-linux/chrome \
  --headless --no-sandbox --disable-gpu --window-size=1600,1350 \
  --screenshot=out.png http://127.0.0.1:3033/sk/categories/nosice-bicyklov-na-tazne-zariadenie
```

Then `Read` the PNG. Warm the URL with `curl` first or you capture the skeleton. The
cookie banner is fixed to the bottom of the viewport — use a tall window or the buy
row is hidden behind it.

Deploy (~41 s downtime, measured):

```bash
cp -al .next .next.prev-backup && pm2 stop maky-storefront \
  && git checkout <sha> && rm -rf .next && pnpm build && pm2 start maky-storefront
```

Roll back by restoring `.next.prev-backup` and checking out the previous SHA.

**Never `pkill -f` with a broad pattern here** — `next-server` matches the
PM2-managed production process, and a `-f` pattern also matches the killing shell's
own command line. Kill the preview by port-derived PID:
`ss -lptnH 'sport = :3033'`, compare against the PM2 pid, then `kill`.

**Never `next build` in `/opt/storefront` while PM2 is serving it** (CLAUDE.md §13).

Acceptance script from this session:
`/tmp/claude-1000/-opt-storefront/<session>/scratchpad/accept.mjs` — ephemeral. It
checks the 10 legacy redirects, the 10 root URLs, canonical, JSON-LD, gallery order
against live Saleor, and a regression smoke list. Worth re-creating if it is gone.

---

## 8. After the slug flip — one thing to watch

One product (`stresny-box-northline-tirol-black-on-black-tef-npb2115ccr`) served a
cached "Produkt nenájdený" on production after CFM flipped the slugs: a `"use cache"`
negative captured in the window where neither slug resolved. Not a code bug — the
redeploy cleared it. Expect the same pattern after any future bulk slug change, and
reach for `/api/revalidate` or a redeploy rather than debugging the page.
