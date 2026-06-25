# Legal & Contact Content Pages — implementation spec — v4

**Status:** design intent (written spec = our design source per `CLAUDE.md §2`). **Date:** 2026-06-24 (v4).
**Public page text (verbatim source):** `docs/design/MAKY_STORE_pravne_stranky_SK.md` (v4).
**Companion:** `docs/design/pdp-purchase-panel-spec.md` (separate branch — keep scope apart).

**What v4 reconciles:** the prior hybrid spec + the v3 content-driven plan + a workflow verification of
every page claim against the real storefront. Several claims did NOT match reality; they are corrected
or guarded below. Three branches now: **A** (static legal/content pages — Stripe-account unblock),
**B** (functional §20a withdrawal form), and a **separate Stripe checkout-integration** spec (the real
blocker to taking money). A **`feat/gtm-consent` merge** is a prerequisite for the cookies/GDPR pages.

## Why (context)

MAKY.STORE s. r. o. (Mestský súd Bratislava III, **Sro 200804/B**, IČO 57 704 627, konateľ Marek
Kysucký) needs public legal/contact pages for (1) SK compliance and (2) **Stripe account
verification** (Stripe wants real, indexable, password-free pages with a business description
consistent with the dashboard).

## Decisions (locked 2026-06-24, v4)

1. **Architecture = ALL-CODE RSC pages** at top-level Slovak routes `/sk/<slug>` (we now have the full
   text, so Saleor CMS is unnecessary; in-repo = version-controlled + truthfulness-reviewable). Verified
   viable: `proxy.ts` rewrites `/sk/*` → `/sk-eur/*`, the `(main)` group adds no URL segment, and there
   is **no collision** with the Saleor CMS `pages/[slug]` route (legal docs use distinct Slovak slugs,
   not under `pages/`).
2. **Gate pages to the SK channel.** The `[channel]` param is the Saleor slug `sk-eur`. Each page:
   `const { channel } = await props.params; if (channel !== "sk-eur") notFound();` — so Slovak binding
   legal text never renders on `/de`, `/pl`, … (wrong-language legal text = compliance hazard). Other
   markets get their own localized legal pages in a later wave.
3. **`feat/gtm-consent` merges FIRST** (Marek's call). It already ships the consent banner
   (`cookie-consent.tsx`), the **re-open trigger** (`privacy-settings-link.tsx` → dispatches
   `window` event `maky:open-consent`, footer label `footer.privacySettings` = "Nastavenia súkromia"),
   the GTM injection (`app/layout.tsx`), and the `cookieConsent` i18n namespace (13 locales). **Only
   after** it is merged are the cookies/GDPR pages truthful and the "Nastavenia súkromia" link real.
   ⚠️ It touches `footer.tsx` + all 13 message files — the **same files Branch A touches** → merge it
   first, then build Branch A on top (see Merge plan). It also has a known pre-existing ESLint error
   (`react-hooks/set-state-in-effect` at `cookie-consent.tsx:43`) to fix before merge.
4. **"Stripe" stays in the copy** (Marek's chosen gateway) — BUT Stripe is **not yet integrated**
   (checkout runs the Saleor **dummy** gateway only; no SDK/keys; card form is a non-functional
   mockup; real Stripe code is build-excluded in `src/_reference/`). **Hard launch guard:** the store
   **must not accept real customer orders** until Stripe is actually integrated — otherwise the pages
   claim "Stripe" while orders go through a fake gateway. Naming Stripe is forward-true **only** if no
   real sale happens before integration. → Stripe integration is a **separate spec/branch** (Decision 5).
5. **Stripe checkout integration = separate spec + branch** (`feat/stripe-checkout`, `§10`). Scope:
   install the Saleor Stripe payment app on the backend, wire `transactionInitialize/Process` + Stripe
   Elements in the storefront checkout, add env keys, remove/replace the mockup card form. This is the
   real blocker to taking money; spec to be written next (does not block Branch A).
6. **Checkout copy cleanup = DEFERRED (`§10`).** `order-summary.tsx` has a free-shipping badge,
   `shipping === 0 ? "Free"`, a latent "Tax (VAT)" line, a "30-day returns" line, and a dummy
   `saleor10` promo field. Touching `src/checkout/` needs explicit approval; bundle it with the Stripe
   integration branch (Decision 5) and resolve **before** real sales.
7. **§20a withdrawal function = Branch B** (mandatory since 19.6.2026; Act 310/2025 amending 108/2024).
   Static page now (Branch A); functional form before consumer sales. Not a Stripe blocker.
8. **Deploy per `§13`.** Never `next build` in the live `/opt/storefront` while PM2 serves it.

## Critical path to the first real sale (corrected)

1. **Branch A** (legal pages) → helps Stripe **account** verification. ← we are here
2. **`feat/gtm-consent` merged** (prereq for cookies/GDPR truthfulness).
3. **Stripe account activated** by Stripe.
4. **Stripe checkout integration** (Decision 5) → only now can a customer actually pay. **Missing today.**
5. **Branch B** (§20a withdrawal form) before consumer sales.
6. **Checkout copy cleanup** (Decision 6) before real sales.

> Account activation ≠ checkout integration. Even after Stripe activates the account and the legal
> pages are live, **no real payment is possible** until step 4.

## Verified grounding (workflow, 2026-06-24 — corrected vs assumptions)

- **Stripe NOT integrated:** active handler supports only `mirumee.payments.dummy` (fake
  `CHARGE_SUCCESS`); for any real gateway it errors "only supports test payments"
  (`src/checkout/views/saleor-checkout/payment-step.tsx:20,303-311`); no `@stripe/*` dep, no
  `STRIPE_*` env; card form is a cosmetic mockup (`payment-method-selector.tsx`); real Stripe code is
  build-excluded (`src/_reference/`).
- **Consent/GTM NOT on the base branch** — lives only on the **unmerged** `feat/gtm-consent`
  (`cookie-consent.tsx`, `privacy-settings-link.tsx`, GTM in `app/layout.tsx`, `cookieConsent` ×13).
  Base has zero consent/gtag code; only the functional `maky-market` routing cookie + cookieless
  Vercel Speed Insights (`app/layout.tsx`) + Cloudflare Web Analytics (env `CF_WEB_ANALYTICS_TOKEN`).
- **Processors (real):** FedEx (courier — backend), AWS (host, incl. self-hosted Saleor + order DB),
  Cloudflare (CDN/edge + Web Analytics — `proxy.ts` reads `CF-IPCountry`), Vercel (Speed Insights,
  mounted in `app/layout.tsx`), Google + Meta (via GTM, consent-gated — **after** gtm-consent merge).
  **Postmark is NOT used** (storefront sends no email; auth email via Saleor `setPassword`; the
  separate `maky-smtp-app` handles SMTP) → generalize to "poskytovateľ e-mailových služieb".
- **Shipping price shows at checkout, NOT cart:** cart drawer shows "Calculated at checkout"
  (`cart-drawer.tsx:330`), cart page "Shipping will be calculated in the next step"; the real price
  appears at the checkout shipping step (`shipping-step.tsx`) + order summary → copy says "v pokladni".
- **VAT/DPH:** "neplatiteľ, ceny konečné" is OK; Saleor returns tax=0 so no VAT line paints today, but
  `order-summary.tsx:326-344` hardcodes "Tax (VAT)"/"Including VAT" (gated `tax>0`) → latent, fix in
  the Decision-6 checkout cleanup.
- **Routing:** single `[channel]` segment, locale derived from channel; `proxy.ts` rewrites friendly
  slugs; literal route dirs beat dynamic — the 8 new slugs are safe siblings of `pages/`.
- **Footer/i18n:** page bodies = inline Slovak (no parity tax); footer **labels** resolve via
  `t(link.key)` across all 13 (silent miss if absent). Parity is **208 keys** (CLAUDE.md §11 says 223
  — stale; fix in this branch). `gtm-consent` already added `footer.privacySettings` + `cookieConsent`
  ×13.
- **Free-shipping (live `§6` violation):** cart-drawer `freeShippingThreshold` const (r.137) + derived
  locals (r.138/139) + 4 refs (r.161, r.164, r.330, r.361) + progress bar (r.154–177); i18n keys ×13
  (`product.freeShippingText`, `product.freeDeliveryOver`, `product.freeReturnsText`, `trust.freeShipping`,
  `trust.freeShippingDesc` rendered; `cart.freeShippingFrom` unused); PDP `add-to-cart.tsx:114`,
  `product-attributes.tsx:119-120`; checkout `order-summary.tsx:370-377` (§10, deferred). Keep
  `common.free` (price label).

## Merge plan — `feat/gtm-consent` first (Decision 3)

1. Inspect + **fix the ESLint error** (`cookie-consent.tsx:43`, `react-hooks/set-state-in-effect`).
2. Merge `feat/gtm-consent` into `feat/token-bridge` (the deployment line). It's a single commit
   (`aadd3cb`) off `8bbae39`; expect a clean-ish merge with `feat/token-bridge` (the two diverged at
   `8bbae39`).
3. **Rebase/merge `feat/token-bridge` into `feat/legal-content-pages`.** Now `footer.tsx` already has
   the `PrivacySettingsLink` + the `cookieConsent`/`footer.privacySettings` keys exist in all 13.
4. Build Branch A on top: the footer gains the legal links + entity block **and keeps** the
   `PrivacySettingsLink`; message files get the legal footer labels **in addition to** `cookieConsent`.
5. **Conflict points to expect:** `src/ui/components/footer.tsx` and all 13 `src/i18n/messages/*.json`
   (both branches edit them). Resolve by keeping gtm-consent's additions AND layering Branch A's.
6. One combined `§13` deploy at the end (gtm-consent + legal pages together) to minimize prod risk.

## ═══ BRANCH A — Static legal/content pages (Stripe-account unblock) ═══

Branch: `feat/legal-content-pages` (off `feat/token-bridge`, after the gtm-consent merge). Goes first.

**Scope IN:**

- `src/config/company.ts` — single source of truth for entity data (legal name, sídlo, IČO, OR
  súd+vložka, konateľ, return address, phone, email). **DIČ omitted until assigned** (no public
  placeholder). Render the entity block in the footer + Kontakt from this.
- 8 RSC pages at `src/app/[channel]/(main)/<slug>/page.tsx`, **SK-channel-gated**, bodies = inline
  Slovak from the content file (verbatim), per-page SEO `title` + `meta description`:
  `kontakt`, `o-nas`, `obchodne-podmienky`, `reklamacie-a-vratenie`, `odstupenie-od-zmluvy`
  (static: notice + downloadable model form; functional form = Branch B), `doprava-a-platba`,
  `ochrana-osobnych-udajov`, `cookies`.
- `footer.tsx`: "Právne informácie" links repointed to the new Slovak slugs + the entity identification
  line; **keep** the `PrivacySettingsLink`. Remove the old dead English-slug links.
- Footer label i18n keys: reuse existing (`aboutUs`, `contact`/`contactUs`, `privacyPolicy`,
  `termsOfService`, `cookiePolicy`, `shippingInfo`, `returns`, `claims`, `warranty`, `faq`); add the
  few new ones (`shippingAndPayment`/doprava-a-platba, `withdrawal`/odstupenie) to **all 13** files.
  Drop `faq` from the footer (no page planned).
- **Free-shipping truthfulness sweep (non-checkout)** — see below (Marek-approved, in this branch).
- `getCopyrightText` → legal entity + localized via `footer.allRightsReserved` (pass the translated
  string in, or `CopyrightText` uses `useTranslations("footer")`; the pure fn can't call `t()`).
- Fix `CLAUDE.md §11` "223" → "208".

**Scope OUT:** other 12 locales' page bodies · PDP branch · PDP/PLP/ProductCard/homepage layout ·
Saleor query structure · **checkout (logic AND copy — Decision 6)** · cart **logic** (cart-drawer edit
is UI/copy only) · CFM · channel/routing/i18n locale-resolution · the functional withdrawal form
(Branch B) · Stripe integration (separate). No new deps.

**Free-shipping sweep (non-checkout) — one cart-drawer edit:** remove `const freeShippingThreshold`
(r.137) + derived locals + every reference (progress bar r.154–177, r.161, r.164, r.330, r.361);
replace r.330 (Order-Summary Shipping row) with an unconditional truthful value ("Cenu dopravy uvidíte
v pokladni"). i18n: delete `cart.freeShippingFrom` (unused); for the rendered keys remove the **call
site first**, then delete the key in the same commit (untyped next-intl → runtime miss if a caller
remains). PDP lines `add-to-cart.tsx:114` + `product-attributes.tsx:119-120`; homepage `why-maky.tsx`
`trust.freeShipping*`. Keep `common.free`. Checkout free-shipping = Decision 6 (deferred). **Hardened
gate:** `free.?shipping|…` AND `freeShippingThreshold` grep → zero on `src/`; per-removed-key
`t("<key>")` grep → zero; manual cart Order-Summary shows no `"Free"`.

**Content v4 deltas already applied** (in `MAKY_STORE_pravne_stranky_SK.md` vs the v3 draft): shipping
"v košíku"→"v pokladni"; GDPR processor list corrected (AWS/Cloudflare/Vercel/Google+Meta-via-GTM/
generic email; Postmark name dropped); cookies/GDPR reference the "Nastavenia súkromia" button. Stripe
kept (Decision 4). **Final legal proofread by Marek recommended before deploy.**

**DoD — Branch A:**

- [ ] 8 pages render at `/sk/...`, server-rendered, indexable, password-free, `notFound()` on non-`sk-eur`.
- [ ] Footer: legal links (Slovak slugs, no 404) + entity line + `PrivacySettingsLink`; copyright = legal entity, localized.
- [ ] SEO title + meta description per page.
- [ ] Hardened free-shipping gate green; `/o-nas` range matches the real catalog.
- [ ] Return window consistent (14 / 30 reg.) across pages + PDP trust row (never blanket "30 dní" to a guest).
- [ ] "Nastavenia súkromia" actually re-opens consent (post gtm-consent merge).
- [ ] i18n parity (all 13, missing 0/extra 0, interim values non-empty); CLAUDE.md §11 223→208 fixed.
- [ ] typecheck + lint + `next build` (per `§13`). DIČ absent from public pages; VOP effective date set.
- [ ] Report before commit; commit/deploy only on approval; after deploy confirm URLs + that the
      dashboard business name/descriptor/support email/description match the site (bidirectional).

## ═══ BRANCH B — Functional withdrawal form (§20a) ═══

Branch: `feat/withdrawal-function`. High priority; done **before** consumer sales (Act 310/2025 → §20a,
effective 19.6.2026; SOI penalty €200 – 2% turnover). Not a Stripe blocker.

On `/sk/odstupenie-od-zmluvy`, a functional form replacing the static section: trigger "Odstúpiť od
zmluvy tu" (also in the footer); fields meno + číslo objednávky + e-mail (+ optional IBAN); button
"Potvrdiť odstúpenie od zmluvy". On submit: (a) record/archive, (b) email the customer an
acknowledgement **with date + time** (§20a ods. 3), (c) notify info@maky.store. **Must work for
guests** (no login), not be hidden, not be more complex than buying. No auto-approval/auto-refund
required. Verify storefront email capability (Saleor / the separate `maky-smtp-app`). When B lands,
update VOP §6.3 + the withdrawal page to list the online function. **B2B note:** withdrawal is consumer
protection — exclude B2B orders when a B2B track is added. Detailed Branch-B spec (fields, email copy,
edge cases) to be written when we start it.

## Truthfulness rules (same optic as PDP)

No "doprava zadarmo" / "vrátenie zadarmo" anywhere. Delivery = FedEx, price at checkout, no invented
days (conditional ETA wording only). Return window 14 (guest) / 30 (registered), identical across
pages + PDP trust + (deferred) checkout. "Záruka 2 roky" = statutory liability per OZ. No EU ODR
reference (discontinued 20.7.2025) — ARS via SOI (Act 391/2015). VAT = "neplatiteľ, ceny konečné". No
invented entity data; DIČ omitted until assigned. **Stripe named but guarded:** no real orders until
Stripe is integrated.

## Validation (per `§11` + `§13`)

typecheck + lint + `next build` (never in the live dir — `pm2 stop → rm -rf .next → build → spare-port
verify → pm2 start`, or a separate worktree). i18n 13-locale parity. Hardened free-shipping gate +
manual cart check. Light-mode visual check of the 8 pages + footer on `/sk` desktop + mobile;
`/de/<slug>` → 404. Report before commit; no prod deploy until approved.

## Roadmap / branches

- **A** legal pages (this) → **B** §20a withdrawal form → **`feat/stripe-checkout`** Stripe
  integration + checkout copy cleanup (Decision 5+6, separate spec). The PDP purchase-panel branch is
  independent; coordinate only the "14/30 dní" trust-row wording.

## Appendix — kickoff prompt for the Branch A thread

```text
We are implementing Branch A — legal + contact content pages for MAKY.STORE.

First read: docs/design/legal-content-pages-spec.md (v4), docs/design/MAKY_STORE_pravne_stranky_SK.md
(v4 — public text, goes on the site verbatim), CLAUDE.md (§2, §6, §9, §10, §11, §13).

PREREQUISITE: feat/gtm-consent must be merged first (consent banner + privacy-settings-link +
cookieConsent i18n). Fix its ESLint error (cookie-consent.tsx:43) before merge. Then build Branch A on
top. Both branches edit footer.tsx + all 13 message files — expect/resolve conflicts there.

Base: feat/token-bridge (post gtm-consent merge). Branch: feat/legal-content-pages.

SCOPE: src/config/company.ts (entity data, DIČ omitted) · 8 RSC pages at
src/app/[channel]/(main)/<slug>/page.tsx, SK-gated (if channel !== "sk-eur" notFound()), bodies =
inline Slovak from the content file, per-page SEO · footer legal links (Slovak slugs) + entity line,
keep PrivacySettingsLink, drop dead English-slug links · footer label i18n across 13 (reuse + add
shippingAndPayment, withdrawal) · free-shipping sweep non-checkout (cart-drawer freeShippingThreshold +
4 refs incl r.330 + progress bar; i18n keys call-site-first; PDP lines; homepage trust; keep
common.free) · getCopyrightText localized to legal entity · fix CLAUDE.md §11 223→208.

DO NOT TOUCH: checkout (logic OR copy) · cart logic · Saleor query structure · CFM · channel/routing/
i18n locale-resolution · Stripe integration (separate branch) · the functional withdrawal form
(Branch B) · PDP/PLP/homepage layout · other 12 locales' page bodies. No new deps. Stripe stays named
in copy but DO NOT enable real orders.

VALIDATION: typecheck + lint + next build per §13 · i18n 13-locale parity (interim non-empty) ·
hardened free-shipping gate (free.?shipping AND freeShippingThreshold = zero; per-removed-key caller
grep = zero; manual cart Order-Summary no "Free") · pages render /sk/<slug> server-rendered + /de 404 ·
"Nastavenia súkromia" re-opens consent · report before commit · do not commit/deploy until approved ·
after deploy confirm URLs + dashboard↔site consistency.

NEXT (separate branches, not now): B — functional §20a withdrawal form; feat/stripe-checkout — Stripe
integration + checkout copy cleanup (the real blocker to taking money).
```
