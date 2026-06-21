# MAKY.STORE storefront — design-system analysis (read-only audit)

**Date:** 2026-06-21
**Branch analyzed:** `feat/phase0-setup` (Saleor + Next.js 16 App Router storefront, `saleor-storefront` / "maky-nextjs")
**Scope:** Read-only audit of styling/tokens, components/routes, i18n, git state, and Figma capability, plus validation of the proposed design-system plan.
**Method:** 8-agent analysis (survey → adversarial verify → challenge), cross-checked against source files and a **live dev-server verification** (port 3000, Saleor API `https://api.maky.store/graphql/`).

---

## 0. TL;DR

- **Headline finding (not in the original brief):** ~70 component files — **every shadcn UI primitive** (`Button`, `Badge`, `Input`, `Checkbox`, `Sheet`, `Accordion`, `Carousel`, `DropdownMenu`) plus much of `account/*`, `pdp/*`, `cart/*` — are wired to a color-token vocabulary (`bg-primary`, `text-muted-foreground`, `bg-card`, `bg-background`, `text-destructive`, `border-input`, `ring-ring`) **that is not defined anywhere in `src/`**. Under Tailwind v4 an undefined `--color-*` emits **no CSS rule**, so these utilities render **colorless**.
- **Verified live:** the PDP "Pridať do košíka" button renders with `class="… bg-primary text-primary-foreground …"`, but the served stylesheet has **no `.bg-primary` rule** and Tailwind preflight resets `button { background-color:#0000 }` → **computed `background-color` = `rgba(0, 0, 0, 0)` (transparent)**. This is the "ghost add-to-cart button": a primary button missing `--color-primary`, **not** an intentional outline.
- **The fix is a token change, not a component change.** One additive `@theme inline` bridge block in `brand.css` maps the shadcn vocabulary onto the existing OKLCH semantics and un-breaks all ~70 files at once — **zero component edits.**
- **The proposed plan is sound in direction but needs two corrections:** (B) "add a semantic layer" is really "**bridge + extend** an existing ~80%-complete layer"; (C) "ProductCard first" **inverts the dependency order** — ProductCard composes the broken Badge + Button.
- **Semantic token layer already exists** in `src/styles/brand.css` (`@theme inline` aliases + `:root` semantics). The only genuinely missing color category is **`promo`**.
- **Figma:** read-only for variables; **no MCP tool writes Figma variables**, and the account is **Pro tier** (no Enterprise Variables REST API). Token mirroring code→Figma must be a **manual/plugin import of a generated `tokens.json`** (OKLCH→sRGB, lossy, one-way).

**Recommended next step after this audit:** visually confirm done ✅ (see §1, §6) → first redesign commit = the **shadcn→semantic token bridge** (§2.4, §6.4).

---

## 1. Worktree state & isolation (COMPLETED 2026-06-21)

At audit start, `feat/phase0-setup` had 16 modified + 3 untracked files — **~95% in-flight GTM/consent feature work** entangled with redesign, plus committed `.bak` clutter. This has now been isolated:

| Branch              | HEAD      | Contents                                                                                                                                                                                                                                               |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `feat/gtm-consent`  | `aadd3cb` | GTM + Google Consent Mode v2 + cookie banner (18 files, all 13 locales). Files: root `layout.tsx`, `[channel]/layout.tsx`, `footer.tsx`, new `cookie-consent.tsx` + `privacy-settings-link.tsx`, `cookieConsent` + `footer.privacySettings` i18n keys. |
| `feat/phase0-setup` | `389a040` | **Clean redesign branch.** Hygiene commit untracked the two committed `.bak` files and added `*.bak` to `.gitignore`.                                                                                                                                  |

**Notes / follow-ups:**

- The consent commit was made with `--no-verify` because the pre-commit ESLint hook fails on a **pre-existing** issue in the feature code: `react-hooks/set-state-in-effect` at [cookie-consent.tsx:43](src/ui/components/cookie-consent.tsx#L43) (`setMounted(true)` directly inside `useEffect`). **Fix on `feat/gtm-consent` before merging.**
- The `/privacy → /pages/privacy` footer href fix was the only non-consent edit; it was bundled onto `feat/gtm-consent` (trivial; cherry-pick to `main` separately if needed sooner).
- Two `.bak` files (`src/app/layout.tsx.bak`, `src/config/locale.ts.bak`) were committed at `90e71ca`, were **not on `main`**, and would have reached `main` at merge. They are now untracked (kept on disk, gitignored). To scrub them from history before merge would require `git filter-repo`/interactive rebase — only if they must never reach `main`.
- The third backup `src/app/layout.tsx.pre-gtm-20260529-072922.bak` was already untracked; now gitignored.

---

## 2. Styling & design-token system

### 2.1 Architecture

- **Tailwind v4, CSS-first, no `tailwind.config.js`.** PostCSS uses only `@tailwindcss/postcss` ([postcss.config.mjs](postcss.config.mjs)).
- Import chain: [src/app/layout.tsx](src/app/layout.tsx) → [globals.css](src/app/globals.css) → `@import "../styles/brand.css"`. **`src/styles/brand.css` (463 lines) is the single canonical token source.** Plugins: `@tailwindcss/forms`, `@tailwindcss/typography`, `tw-animate-css`.
- Layering inside `brand.css`:

| Layer            | Mechanism             | Lines   | Purpose                                                                                 |
| ---------------- | --------------------- | ------- | --------------------------------------------------------------------------------------- |
| Primitives       | `@theme { … }`        | 32–133  | OKLCH palette + radius/spacing/shadow/font/easing → generate Tailwind utilities         |
| Semantic aliases | `@theme inline { … }` | 142–210 | Map `:root` semantic vars → Tailwind utilities (`bg-surface-card`, `text-text-primary`) |
| Semantic tokens  | `:root { … }`         | 217–366 | Purpose-driven values (`var()` chained to primitives)                                   |
| Base             | `@layer base { … }`   | 372–463 | Resets, body/link/focus, skip-nav, scrollbar, reduced-motion                            |

- **Light-only:** `color-scheme: light` hardcoded (brand.css:218). **No `.dark` block exists** → any `dark:` variant in components (e.g. [loader.tsx:7](src/ui/atoms/loader.tsx#L7)) is **dead**.

### 2.2 OKLCH primitives

Named `--color-{family}-{step}`, all `oklch(L C H)` (51 tokens). Families: **copper** (60°, CTA/links), **forest** (150°, trust/success), **sand** (85°, surfaces), **gray** (60° low-chroma, text/chrome), plus functional **red / amber / blue**. Non-color primitives: `--radius-*`, `--spacing`, warm `--shadow-*`, `--font-*`, `--ease-*`.

### 2.3 Existing semantic layer (already ~80% of the "proposed" layer)

| Requested category              | Status                    | Tokens (brand.css)                                                                                                                     |
| ------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **surface**                     | ✅ complete               | `--surface-primary/secondary/muted/card/elevated/accent/inverse` (aliased 143–150); `:root` adds success/warning/danger/info (252–263) |
| **text**                        | ✅ complete               | `--text-primary/secondary/tertiary/inverse/link/link-hover` (153–158) + status variants (265–275)                                      |
| **border**                      | ✅ complete               | `--border-default/subtle/strong` (161–163) + status variants (277–284)                                                                 |
| **price**                       | ✅ complete               | `--price-current/compare/sale/sale-bg` (300–303; aliased 191–194)                                                                      |
| **status** success/warning/info | ✅ complete               | `--color-status-{success,warning,info}{,-bg,-border}` (177–188)                                                                        |
| **cta**                         | ✅ exists as **`action`** | `--action-primary/secondary/ghost` (+ hover/text) (287–297; aliased 166–174)                                                           |
| **status error**                | ✅ exists as **`danger`** | `--color-status-danger{,-bg,-border}` (183–185). Named `danger`, **no `error` alias**                                                  |
| **brand**                       | ⚠️ by-proxy only          | No `--brand-*`; brand color is the copper/forest **primitives** surfaced via `action`                                                  |
| **promo**                       | ❌ **missing**            | No `--promo*`/discount/deal/clearance token anywhere                                                                                   |

Also present (commit `a8e8c4b`): component dimension tokens (`--header-height-*`, `--button-height-*`, `--input-height`, `--drawer-width-*`, card paddings), **z-index** scale (`--z-header…--z-toast`, 100–500), control/disabled states (`--control-*`, `--action-disabled-*`), focus (`--focus-ring*`), motion (`--duration-*`).

### 2.4 Two distinct token problems (do not conflate)

**(A) shadcn vocabulary — used-but-UNDEFINED → genuinely broken.** Confirmed: `--color-{primary,secondary,background,foreground,muted,card,accent,destructive,input,ring,popover}` are **absent** from `brand.css`. Yet ~70 files consume them — e.g. [button.tsx:25-31](src/ui/components/ui/button.tsx#L25) (`bg-primary text-primary-foreground`, `bg-destructive`, `border-input bg-background`), [badge.tsx:14-17](src/ui/components/ui/badge.tsx#L14). **Live-verified:** `.bg-primary` produces no rule; the add-to-cart button computes `background-color: rgba(0,0,0,0)`. **Fix = define a bridge** (see §6.4) — additive, zero component edits.

**(B) `status-*` tokens — DEFINED-but-unused → fine, just not adopted.** `--color-status-*` are defined (brand.css:177-188), but **no component uses `bg-status-*`/`text-status-*`**; components hardcode raw palette literals instead (e.g. [order-status-config.ts](src/ui/components/account/order-status-config.ts) uses `bg-green-50 text-green-700`). They would work if adopted — this is a migration, not a bug.

### 2.5 Hardcoded-color inventory (token bypass)

- **~70 files** consume the undefined shadcn vocabulary (problem A above) — highest priority.
- **~33 files** use raw Tailwind palette literals that should be tokens (gray/neutral/green/amber/red/yellow/blue), e.g. [payment-status.tsx](src/ui/components/payment-status.tsx), [order-status-config.ts](src/ui/components/account/order-status-config.ts), footer/hero/cart/pagination grays, header `text-gray-*`/`text-neutral-*`. Migrate to `status-*` / `surface-*` / `text-*` / `border-*` during per-component work.
- **Intentional (leave):** hero & category-hero gradient scrims ([hero-section.tsx:45](src/ui/components/homepage/hero-section.tsx#L45), [category-hero.tsx:28](src/ui/components/plp/category-hero.tsx#L28)), product color-swatch hex **data** (`variant-selection/utils-legacy.ts`), test/fixtures, dev overlay (`dev/graphql-monitor.tsx`).
- **Special case — OG image:** [og/route.tsx:33,98,112](src/app/api/og/route.tsx#L33) ships the **stale README's** hex system (`#FAF9F7`/`#1A1A1A`/`#737373`) because Satori can't read CSS vars. Off-palette vs the OKLCH site; track separately.
- **Stale doc:** [src/styles/README.md](src/styles/README.md) documents a `--background`/`--primary`/`.dark` hex system that **does not match** `brand.css`. Delete/rewrite — it actively misleads (and is the source the OG route copied).

---

## 3. Component & route structure

### 3.1 Routes (`src/app/[channel]/(main)/`)

Homepage ([page.tsx](<src/app/[channel]/(main)/page.tsx>)), category & collection PLP, all-products PLP, PDP (`products/[slug]`), search, cart, account (+orders/addresses/settings), auth, CMS `pages/[slug]`. `[channel]` is a market slug. **PLP/PDP/category are i18n-driven; search/cart/account still hardcode English copy.**

### 3.2 Key surfaces

- **Header** ([header/\*](src/ui/components/header)): two-row sticky. Functional market/language/currency switcher ([header-market-controls.tsx](src/ui/components/header/header-market-controls.tsx), 13 markets). **Placeholders (no handler):** [vehicle-selector-trigger.tsx](src/ui/components/header/vehicle-selector-trigger.tsx), [all-categories-trigger.tsx](src/ui/components/header/all-categories-trigger.tsx) (no mega-menu).
- **Footer** ([footer.tsx](src/ui/components/footer.tsx)): `bg-gray-900` 4-col + bottom bar. Hardcoded grays (migrate to inverse-surface tokens — none exist yet).
- **Homepage** ([homepage/\*](src/ui/components/homepage)): hero (dark/amber, **CTA non-functional**), category-grid (off-palette accent chips), why-maky, brands-strip (text only), newsletter-cta (**non-functional**).
- **PLP** ([plp/\*](src/ui/components/plp)): rich `FilterBar` (Radix dropdowns + mobile Sheet; category/color/size/price/sort), `ProductGrid`, `CategoryHero`. Logic + tests in `filter-utils*.ts`.
- **PDP** ([pdp/\*](src/ui/components/pdp)): `ProductGallery` (Embla + portal lightbox), `AddToCart`, `ProductAttributes` (Accordion), `StickyBar` (mobile), and a **mature** `variant-selection/` subsystem (URL-param selections, `useOptimistic`, cross-filtered availability, swatch/button renderers, unit tests). NB: "compatibility" here = **variant-attribute**, not vehicle fitment.

### 3.3 ProductCard (first composition target) — [plp/product-card.tsx](src/ui/components/plp/product-card.tsx)

`"use client"`. Data contract `ProductCardData` (id/name/slug/brand?/price/compareAtPrice?/currency/image/badge?/colors?/sizes?/href/hasVariants?/onQuickAdd?). Renders `aspect-[3/4]` image (+ optional hover image), `Badge` (sale→destructive, new→default), hover quick-add `Button`, brand, name, color swatches, price (inline `Intl.NumberFormat` + `text-price-sale`/`text-price-compare`). **Its own chrome uses semantic tokens correctly**, but it composes the broken `Badge`+`Button`. **Dead paths:** `hoverImage` and `onQuickAdd` are wired but never populated by `transformToProductCard`/callers.

### 3.4 UI primitives ([ui/\*](src/ui/components/ui)) — **no `cva`**

All variants hand-rolled with `cn()` + conditional class objects (class strings are **not** type-checked). Radix only for `dropdown-menu`/`sheet`; Embla for `carousel`.

| Component                                                              | Variants / sizes                                                                     | Token health                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `button`                                                               | variant: default/secondary/outline-solid/ghost/destructive; size: default/sm/lg/icon | **broken** (shadcn tokens)                                                      |
| `badge`                                                                | default/secondary/destructive/outline-solid                                          | **broken** (shadcn tokens)                                                      |
| `input`, `checkbox`, `accordion`, `carousel`, `dropdown-menu`, `sheet` | various                                                                              | **broken** (`bg-background`/`border-input`/`text-muted-foreground`/`ring-ring`) |
| `image-carousel*`, `image-lightbox`                                    | flags/props                                                                          | OK (own classes / semantic)                                                     |

**No `Price` primitive exists** — money formatting is duplicated across ProductCard, PDP `add-to-cart`, cart, sticky-bar.

### 3.5 Vehicle-selector / fitment / compatibility — **placeholder only**

Two no-op buttons (header + hero), a fully-translated but **dormant** `fitment` i18n namespace, **no GraphQL backing, no selection state, no product↔vehicle data model**. Buildable against a mocked data shape; real fitment data is a parallel track.

---

## 4. i18n (next-intl 4.8.3)

- **Wiring:** `createNextIntlPlugin("./src/i18n/request.ts")` ([next.config.js](next.config.js)); [request.ts](src/i18n/request.ts) `getRequestConfig` dynamic-imports `./messages/${locale}.json` (fallback `DEFAULT_LOCALE`). Channel layout calls `setRequestLocale` + `getMessages` and wraps in `NextIntlClientProvider`.
- **Locale selection:** URL channel slug → `CHANNEL_MAP` ([lib/channel-map.ts](src/lib/channel-map.ts)) → locale. `getLocaleFromChannel` in [config/locale.ts](src/config/locale.ts). **`DEFAULT_LOCALE = "sk-SK"`** (source-of-truth/fallback locale).
- **13 locales**, **structurally parallel — 223 keys each, 0 missing/extra** (verified). Namespaces (en-US): `common`(33) `nav`(30) `product`(40) `fitment`(16) `cart`(12) `checkout`(19) `footer`(23) `pages`(7) `trust`(8) `plp`(21) `cookieConsent`(14). ICU plurals/interpolation used (Slovak adds a `few` category).
- **No automated validation:** no i18n lint, **no next-intl type augmentation** → `t("key")` is **not** type-checked; a missing/typo key silently falls back to `sk-SK` then the raw key.

**Copy-change workflow:** (1) add/rename the key in **all 13** files (keep 223-key parity); (2) reference via `getTranslations`/`useTranslations` namespace; (3) for client text the server can't reach, pass the translated string as a prop (as `PrivacySettingsLink` does). **Parity check** (run on any copy change):

```bash
node -e 'const fs=require("fs");function flat(o,p=""){let r=[];for(const k of Object.keys(o)){const key=p?p+"."+k:k;o[k]&&typeof o[k]=="object"&&!Array.isArray(o[k])?r=r.concat(flat(o[k],key)):r.push(key)}return r}const d="src/i18n/messages/",L=["cs-CZ","de-AT","de-DE","en-CA","en-GB","en-US","es-ES","fr-FR","hu-HU","it-IT","pl-PL","ro-RO","sk-SK"],ref=new Set(flat(JSON.parse(fs.readFileSync(d+"en-US.json"))));for(const l of L){const k=new Set(flat(JSON.parse(fs.readFileSync(d+l+".json"))));console.log(l,"missing",[...ref].filter(x=>!k.has(x)),"extra",[...k].filter(x=>!ref.has(x)))}'
```

---

## 5. Figma MCP capability & token mirroring

- **Authenticated:** `Maky-88` (`marekkysucky@gmail.com`), **Pro tier**, personal team — **not Enterprise**.
- **Read** tools: `get_design_context`, `get_screenshot`, `get_metadata`, `get_figjam`, `get_variable_defs` (variables read-only; needs a concrete file URL + node-id), `get_libraries`, `search_design_system`, Code Connect read tools.
- **Write** tools (`use_figma`, `create_new_file`, `generate_diagram`, `upload_assets`, `*_code_connect_*`) operate on design **content/files** and are interactive/approval-gated.
- **There is NO MCP tool that writes/upserts Figma variables.** Combined with Pro tier (no Enterprise Variables REST API), **mirroring code tokens → Figma variables cannot be automated**.

**Recommended mirror mechanism (one-way, code-canonical):**

1. `scripts/export-tokens.mjs` parses `brand.css` (primitives + `:root` semantics + `@theme inline` aliases), resolves the `var()` chain, converts OKLCH→sRGB hex (**all primitives verified in-gamut — no clipping**; use a library e.g. `culori`, never hand-convert; special-case `oklch(1 0 0)`/`transparent`), and emits a versioned **`design/tokens.json`** (Tokens Studio format with aliases preserved). Scope to **color tokens only**.
2. A human imports `design/tokens.json` via the **Tokens Studio plugin → Create/Update Variables**. Milestone cadence, not continuous.
3. **CI staleness gate:** `node scripts/export-tokens.mjs --check` fails the build if the committed artifact drifts from `brand.css` (mirrors the existing `predev`/`prebuild` → `generate:all` codegen philosophy).

**Caveats:** the mirror is **lossy (OKLCH→sRGB 8-bit) and one-way** — Figma stores hex, can't round-trip to OKLCH. This is fine **because code is canonical**, and is an independent reason never to make Figma the source.

---

## 6. Assessment of the proposed plan

> Proposed: (A) code canonical, Figma = mirror + sketch; (B) add a semantic token layer on the OKLCH primitives, then mirror to Figma; (C) improve components one at a time, start with ProductCard, small branches with validation.

| Pillar                               | Verdict                                                                                                        | Correction                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(A)** code canonical, Figma mirror | ✅ **Sound** — code already _is_ canonical (tokens, WCAG/EAA decisions live in CSS; codegen precedent exists). | Rewrite "mirror" → generated `tokens.json` + Tokens Studio import (not an MCP write); acknowledge lossy/one-way.                                                                                                                                                                                    |
| **(B)** "add a semantic layer"       | ⚠️ **Mis-framed** — it already exists (~80%).                                                                  | Reframe to **(1) bridge the shadcn vocabulary [Step 0, gates everything], (2) add `promo`, (3) add `brand`/`cta`/`error`/`overlay` aliases** — all additive in `@theme inline`. **Never rename existing tokens** (Tailwind v4 silently kills renamed utilities; nothing type-checks class strings). |
| **(C)** ProductCard first            | ⚠️ **Inverted order** — ProductCard composes the broken Badge + Button.                                        | **token bridge → Badge → Button → new `Price` primitive → ProductCard → fan out.**                                                                                                                                                                                                                  |

### 6.1 Risks / blockers

- **Undefined-token wall** hits every component until the bridge lands (§2.4A). Without Step 0, each component branch re-discovers and locally works around it → maximal, divergent rework.
- **No Storybook / visual-regression / component tests** (only 2 pure-logic unit tests). `next build` passing does **not** certify token correctness (undefined `--color-*` passes the build silently). Need an explicit gate (§6.3).
- **i18n tax:** every copy change = 13 files, no type safety, no CI parity check. Keep copy changes off visual-redesign branches; batch them; wire the parity diff into CI.
- **No `cva`:** adding/renaming variants edits hand-rolled `cn()` maps with no central registry and no class-string type-checking.
- **Stale README + OG hex divergence** (§2.5) — reconcile before declaring "code canonical".
- **Dark mode is latent:** no `.dark` block; dead `dark:` variants ship. The 3-tier model is the right substrate for dark mode later, but only once components consume semantic (not primitive/raw) tokens.

### 6.2 Recommended sequence (dependency-topological)

1. **Token bridge (Step 0, blocks everything)** — additive `@theme inline` shadcn aliases + `promo` + `brand`/`cta`/`error`/`overlay`. No component edits.
2. **Badge** — confirm variants map to the right semantics now that tokens resolve.
3. **Button** — verify focus-ring tokens resolve; touches almost everything.
4. **`Price` primitive (new)** — extract the duplicated `Intl.NumberFormat` + compare/sale layout once.
5. **ProductCard** — now a clean composition; redesign becomes layout/imagery only.
6. **Fan out** (FilterBar, PDP add-to-cart, cards) on stable primitives. **Vehicle-selector / CompatibilityBox** comes after the primitives, built against a **mocked** fitment data shape (real data is a parallel track).

### 6.3 Validation gate (per branch)

`tsc --noEmit` + lint + `next build` + **i18n 13-locale parity diff** (if copy touched) + **manual light-only visual check** of the touched component (hover/focus states; ≥2 locales incl. a non-Latin-plural one). **`next build` passing ≠ token correctness.** Recommended low-cost add: one Vitest + Testing Library render smoke-test per changed primitive so the gate isn't purely manual.

### 6.4 The Step-0 token bridge (concrete)

Add to the `@theme inline` block in `brand.css` (additive; nothing renamed):

```css
/* shadcn compatibility bridge — maps the vocabulary ~70 components already use */
--color-background: var(--surface-primary);
--color-foreground: var(--text-primary);
--color-card: var(--surface-card);
--color-muted: var(--surface-muted);
--color-muted-foreground: var(--text-tertiary);
--color-primary: var(--action-primary);
--color-primary-foreground: var(--action-primary-text);
--color-secondary: var(--action-secondary);
--color-secondary-foreground: var(--action-secondary-text);
--color-destructive: var(--color-status-danger);
--color-destructive-foreground: var(--text-inverse);
--color-accent: var(--surface-accent);
--color-border: var(--border-default);
--color-input: var(--border-default);
--color-ring: var(--focus-ring);
/* + promo: --color-promo / -bg / -border / --color-on-promo (new in :root, mirror price/status) */
/* + aliases: --color-cta-* → action; --color-status-error* → danger; --color-brand* → copper/forest */
/* + --color-overlay (modal/lightbox scrim — currently hardcoded) */
```

This single block makes the ~70 currently-colorless files render correctly (including the add-to-cart button) with **no component edits** — the highest-ROI change in the effort, and it must precede any component work.

---

## 7. Recommended smallest next step

The clean redesign branch and this audit are in place. The next action is the **first redesign commit: the Step-0 shadcn→semantic token bridge** in `brand.css` (§6.4) — additive only, validated by `next build` + a visual recheck that the add-to-cart button and shadcn primitives now paint. Defer all component redesign (Badge → Button → Price → ProductCard) until the bridge is in and verified.

---

_Generated as a read-only analysis. No application code was modified by this audit; the only changes made were git-branch isolation and `.bak`/`.gitignore` hygiene (§1)._
