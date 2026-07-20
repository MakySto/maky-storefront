# MAKY.STORE — Frontend Design System Rules

This file is the persistent contract for design and frontend work on the MAKY.STORE
Next.js storefront. It encodes decisions that are NOT inferable from code. Read it
before any design/UI task.

> Companion reference: `docs/design/storefront-analysis-20260621.md` is the read-only
> audit of the current token/component/i18n state. Read it before token or component work.

## 1. Project context

MAKY.STORE is a Slovak (sk-SK first) e-commerce storefront built on Saleor + a
Paper/Next.js fork. The first launch scope is Auto-Moto accessories:

- Strešné nosiče (roof racks)
- Strešné boxy (roof boxes)
- Nosiče bicyklov (bike carriers)
- Nosiče lyží (ski carriers)
- Snehové reťaze (snow chains)
- Autochladničky (car fridges)
- Strešné stany (roof tents)
- Poradňa (advice / blog)

Do NOT surface other future categories (workwear, work shoes, hand tools, marketplace
categories) until explicitly requested.
Do NOT promote towbars or electrical kits on the homepage until the business model and
installation partner are confirmed.

## 2. Source of truth (read this first)

- Existing **code** is canonical for the current implementation and the existing
  **OKLCH design tokens**. Never invent a parallel token system (e.g. a new hex system).
  The single canonical token file is `src/styles/brand.css` (Tailwind v4, CSS-first,
  no `tailwind.config.js`).
- **This file (CLAUDE.md) + `docs/design/`** is canonical for design decisions and
  business/messaging rules.
- For **new or significantly changed UI**, a Figma frame OR a written spec is the design
  _intent_. Implement in code, then review.
- The **implemented, validated code** is the final truth.

Practical rule: before changing or "redesigning" any existing component, FIRST read its
real implementation in code. Do not rebuild it from scratch in Figma. Figma mirrors and
documents the current system and is a sketch space for changes.

**Figma is a one-way mirror, not a write target (from design analysis 2026-06-21):**
There is NO MCP tool that writes Figma variables, and the account is Pro tier (no
Enterprise Variables REST API). Mirror tokens code→Figma by generating a versioned
`design/tokens.json` from `brand.css` and importing it via the Tokens Studio plugin at
milestone cadence. The conversion is OKLCH→sRGB (lossy) and one-way — Figma never
becomes the source.

## 3. Design-change workflow

For any non-trivial UI change:

1. Read the existing code (component, tokens, props, where it is used).
2. Take design intent from a Figma frame or a written spec.
3. Propose an implementation plan and wait for approval.
4. Implement in a small, single-purpose branch.
5. Run validation (see §11).
6. Capture desktop + mobile screenshots and summarize differences vs. intent.
7. Update `docs/design/` or Figma documentation if relevant.

Prefer small branches and small commits. For significant edits, show the plan/diff
before applying.

## 4. Color semantics (anchored to existing OKLCH tokens)

Use the existing OKLCH tokens as the canonical primitive source. Define a **semantic
layer** on top of them; components must reference semantic tokens, not hardcoded
primitive colors.

Current design semantics:

- **Brown** = MAKY brand — logo, footer, brand navigation, "Všetky kategórie".
- **Amber** = promotions, discounts, benefits, seasonal highlights.
- **Green/teal** = purchase CTA, continue action, confirmed compatibility, positive status.
- **Graphite / dark neutral** = normal price + main text.
- **Red-orange** = sale price and destructive/error attention.
- **Green** = in stock, compatible, positive status.

Hard rules:

- The primary purchase action (add-to-cart / buy) must be a **full, high-contrast**
  button using the purchase-CTA semantic token. It must read as the clear primary action
  on the page.
- Do **NOT** use brown as the primary add-to-cart color.
- One primary-action color per page; everything else gets lower visual weight.
- No hardcoded hex/oklch in components — always go through semantic tokens.

The exact value of the purchase-CTA token can evolve; the rule is the semantic usage,
not a fixed color value.

### 4.1 Token reality & naming (from design analysis 2026-06-21)

The semantic layer mostly **already exists** in `src/styles/brand.css` (`@theme inline`
aliases + `:root` semantics). Treat token work as **extend/normalize**, not "build a new
layer". Concretely:

- **Real names differ from generic vocabulary.** `cta` exists as **`action`**
  (`--action-primary/secondary/ghost`); status `error` exists as **`danger`**
  (`--color-status-danger*`). Use the real names; add thin aliases if a generic name is
  required.
- **`promo` is the only genuinely missing color category** — add it (mirror the
  `price`/`status` pattern: base/-bg/-border + on-promo).
- **NEVER rename an existing token.** Tailwind v4 generates utilities from token _names_;
  renaming silently kills every existing `bg-action-primary` / `text-danger` usage with
  **no build error** and no type-check (class strings are hand-rolled `cn()` objects, no
  `cva`). Only ADD aliases.

### 4.2 The shadcn → semantic bridge (known context — undefined-token wall)

~70 component files — every shadcn UI primitive (`Button`, `Badge`, `Input`,
`Checkbox`, `Sheet`, `Accordion`, `Carousel`, `DropdownMenu`) plus much of `account/*`,
`pdp/*`, `cart/*` — use a shadcn token vocabulary (`bg-primary`, `text-muted-foreground`,
`bg-card`, `bg-background`, `bg-destructive`, `border-input`, `ring-ring`) that is **not
defined** in `brand.css`. Under Tailwind v4 an undefined `--color-*` emits **no rule**, so
those utilities render **colorless** (this is the "ghost add-to-cart button":
`bg-primary` with no `--color-primary` → `background-color: rgba(0,0,0,0)`).

The fix is a **token change, not a component change**: one additive `@theme inline` block
mapping the shadcn names onto existing semantics (`--color-primary: var(--action-primary)`,
`--color-destructive: var(--color-status-danger)`, `--color-background: var(--surface-primary)`,
`--color-muted-foreground: var(--text-tertiary)`, `--color-input: var(--border-default)`,
`--color-ring: var(--focus-ring)`, …). This **Step-0 bridge un-breaks all ~70 files at
once and must land before any component redesign.** Separately, the defined-but-unused
`status-*` tokens should replace raw `bg-green-50`/`bg-red-50` literals during
per-component work. Full bridge in `docs/design/storefront-analysis-20260621.md` §6.4.

### 4.3 Component sequence (dependency order)

Redesign in dependency-topological order, NOT starting at ProductCard (it composes the
broken primitives): **token bridge → Badge → Button → new `Price` primitive →
ProductCard → fan out**. Vehicle-selector / CompatibilityBox comes after primitives,
built against a **mocked** fitment data shape (real fitment data is a parallel track).

## 5. Header rules

Keep: logo, large search, account, wishlist/favorites, cart, and "Vybrať vozidlo" as a
prominent CTA.

Do NOT include: a Compare feature, a contact/help box, or a standalone currency dropdown
(currency is tied to channel/route — it is not independently switchable).

Country/language selection may be less prominent (footer or account/settings is
acceptable). Do NOT implement hard IP-based redirects for language/country. A dismissible
"suggest local version" banner is acceptable later.

## 6. Homepage rules

Focus on the current Auto-Moto launch scope.

- Do NOT show free-shipping claims anywhere.
- Do NOT render empty product sections with English placeholders. Hide empty sections or
  use Slovak localized empty states.
- Hero copy must speak to customer benefits, not internal/founder metrics (no
  "13 markets / 4 suppliers" framing).

Consumer-facing homepage brands (for now): Thule, Nordrive, Menabo, Yakima, Peruzzo,
Pro-USER, Spinder, Green Valley, SnowDrive, DAC.
Do NOT show Cruz, HAK-SYSTEM, GALIA, ORIS or JAEGER on the homepage until explicitly
approved.

## 7. Product card rules

Cards must be more informative than generic cards. Where data exists, show: brand,
product type/category, availability, price (using price tokens), a short benefit, and
compatibility status.

Compatibility badge states:

- "Overená kompatibilita" — when fit with the selected vehicle is confirmed.
- "Vyberte vozidlo" — when no vehicle is selected and the product is vehicle-specific.
- "Univerzálny produkt" — for universal products.

For roof-rack bundles, communicate the complete set:
"Kompletná zostava: tyče + pätky + kit".

## 8. Product detail (PDP) rules

Compatibility must be visible **near the purchase CTA**, not buried in the description.

States:

- Vehicle selected + compatible → "Overená kompatibilita" with the selected vehicle
  (e.g. brand / model / generation / year).
- No vehicle selected → "Overiť kompatibilitu s vaším vozidlom" + a button to select
  the vehicle.
- Vehicle selected + incompatible → a clear warning + a link to compatible products.
- Universal product → universal-product status.

The selected vehicle must persist across the visit (set once, reused on listing + PDP).
Highlight manuals/PDFs on the product page where available (not on the homepage).

## 9. Shipping / returns / warranty — storefront messaging

Shipping:

- Shipping is via FedEx.
- Shipping price depends on product size, weight and destination; communicate
  "cenu uvidíte v košíku".
- Do NOT claim free shipping unless explicitly implemented for specific products or
  campaigns.

Returns:

- "30 dní na vrátenie" may be communicated.
- Do NOT hardcode return-shipping-cost wording into badges/trust-lines until the policy
  per shipping class is confirmed. For oversized goods use cautious wording and link to
  a detailed returns page.

Warranty:

- Standard warranty is 2 years unless a product-specific warranty is confirmed.

Legal footer: show the operating entity's details (currently the sole-trader details,
to be swapped to MAKY.STORE s.r.o. once active).

## 10. Technical restrictions

Do NOT change the following without explicit approval:

- Saleor integration / GraphQL query structure
- checkout logic
- cart logic
- CFM integration
- channel / routing / i18n locale logic
- environment / secrets
- deployment configuration

Do NOT copy XStore code or assets. XStore is a layout/UX reference only.
Do NOT add new dependencies solely for styling without approval.

## 11. Validation requirements

For UI changes:

- run lint
- run typecheck
- run build
- capture desktop + mobile screenshots where possible
- summarize visual differences vs. the design intent
- list changed files

Use small branches and small commits. Follow the project's established commit-hook
convention.

Additional gates (from design analysis 2026-06-21):

- **i18n 12-locale parity check (en-GB/gb-gbp market removed 2026-07-20)** whenever copy changes — all message files must stay
  structurally parallel — the invariant is that **all 12 files are identical** (missing 0 / extra 0),
  NOT a fixed count (it drifts as keys are added/removed; ~219 as of 2026-06-30). next-intl is NOT type-augmented, so missing
  keys fail silently at runtime, not at build. Parity script:
  ```bash
  node -e 'const fs=require("fs");function flat(o,p=""){let r=[];for(const k of Object.keys(o)){const key=p?p+"."+k:k;o[k]&&typeof o[k]=="object"&&!Array.isArray(o[k])?r=r.concat(flat(o[k],key)):r.push(key)}return r}const d="src/i18n/messages/",L=["cs-CZ","de-AT","de-DE","en-CA","en-US","es-ES","fr-FR","hu-HU","it-IT","pl-PL","ro-RO","sk-SK"],ref=new Set(flat(JSON.parse(fs.readFileSync(d+"en-US.json"))));for(const l of L){const k=new Set(flat(JSON.parse(fs.readFileSync(d+l+".json"))));console.log(l,"missing",[...ref].filter(x=>!k.has(x)),"extra",[...k].filter(x=>!ref.has(x)))}'
  ```
- **Manual light-only visual check.** Dark mode is NOT wired — there is no `.dark` block
  (`color-scheme: light` is hardcoded), so any `dark:` variant in components is dead.
  Do not rely on or add `dark:` variants until dark mode is intentionally introduced.
- **`next build` passing does NOT certify token correctness.** Tailwind v4 silently emits
  nothing for an undefined `--color-*`; a colorless utility passes the build. Visually
  verify that touched components actually paint (see §4.2).

## 12. Token system — current state (from design analysis 2026-06-21)

Ground truth captured by `docs/design/storefront-analysis-20260621.md`:

- **Canonical source:** `src/styles/brand.css` (463 lines). Tailwind v4 CSS-first; layers
  are `@theme` primitives (OKLCH, ~51 tokens: copper/forest/sand/gray + red/amber/blue),
  `@theme inline` semantic aliases, `:root` semantic tokens (var()-chained to primitives),
  `@layer base`.
- **Already complete semantic categories:** surface, text, border, price, status
  (success/warning/danger/info), action (=cta), plus component/z-index/control/disabled/
  focus/motion tokens.
- **Gaps:** `promo` (missing), `brand` (only via primitives), `error` alias (use `danger`),
  `overlay`/scrim (hardcoded). The shadcn vocabulary is undefined (§4.2).
- **Two distinct issues — do not conflate:** (a) shadcn tokens are _used-but-undefined_
  → broken, fix via the bridge; (b) `status-*` tokens are _defined-but-unused_ → fine,
  migrate raw palette literals to them.
- **Stale/misleading:** `src/styles/README.md` describes a hex `--background`/`.dark`
  system that does not exist in `brand.css`; `src/app/api/og/route.tsx` ships those stale
  hex values (Satori can't read CSS vars). Reconcile before declaring "code canonical".

## 13. Build / deploy safety (ops)

Production `maky.store` is served by **PM2** process `maky-storefront` (`npm start` =
`next start -p 3000`, cwd `/opt/storefront`), proxied by nginx
(`/etc/nginx/conf.d/storefront.conf` → `proxy_pass 127.0.0.1:3000`). It serves the
on-disk `.next` build. (`maky-smtp-app` is a separate PM2 process — never touch it.)

- **NEVER run `next build` / `npm run build` in `/opt/storefront` while the PM2
  `maky-storefront` process is running.** `next build` replaces the hashed CSS/JS chunks
  on disk; the live `next start` keeps serving HTML (and re-writes ISR cache under
  `.next/server/app/*.html`) referencing the **old, now-deleted** chunk hashes → global
  404/500 on `/_next/static/*.css` → unstyled site. This caused a CSS-down incident on
  2026-06-21.
- **Safe build/deploy procedure:** `pm2 stop maky-storefront` → `rm -rf .next` →
  `npm run build` → verify on a spare port (`next start -p 3032`: page actually styled,
  CSS 200, no stale-chunk 404) → `pm2 start maky-storefront` → verify `:3000` **and**
  `https://maky.store/sk`.
- **Rollback:** `git checkout feat/phase0-setup` → `rm -rf .next` → `npm run build` →
  `pm2 restart maky-storefront` restores the last known-good (pre-token-bridge) state.
- For local validation that only needs a build artifact, build in a **separate
  clone/worktree**, never the live deploy dir.
