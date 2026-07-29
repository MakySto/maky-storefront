# Session handoff — 2026-07-29

**This supersedes the ground-truth section of `product-experience-v3-handoff.md`, which
still names `2ff14a0` as production. That is four deploys stale.** Everything else in the v3
handoff (§5 facts, §6 how to work on this box, the deploy recipe) is still accurate and worth
reading.

---

## 1. Production ground truth

|                   |                                           |
| ----------------- | ----------------------------------------- |
| SHA               | **`007f75e`**                             |
| BUILD_ID          | **`WRxB8lq9Ps8OmdZq-oBbR`**               |
| PM2               | `maky-storefront`, online, **0 restarts** |
| `/opt/storefront` | detached at `007f75e`                     |

Verify rather than trust this file — `git -C /opt/storefront rev-parse --short HEAD` and
`cat /opt/storefront/.next/BUILD_ID`.

Rollback artefacts in `/opt/storefront`, newest first: `.next.rollback-9ed9aed`,
`.next.rollback-d089e74`, `.next.rollback-0dd709b`, `.next.rollback-2ff14a0`. A hardlink
restore is ~15 s; see the deploy recipe in the v3 handoff §6.

## 2. What shipped today — four deploys

| deploy | SHA       | what                                                                                                          |
| ------ | --------- | ------------------------------------------------------------------------------------------------------------- |
| 1      | `0dd709b` | LCP `fetchPriority`, trust-block `prefetch={false}`, drop GeistMono, header-height CLS fix, `public/llms.txt` |
| 2      | `d089e74` | **VAT truth on the legal pages** — shipped alone, deliberately                                                |
| 3      | `9ed9aed` | invalid-market 404 firewall, `robots.txt`, real sitemap, GTM `lazyOnload`, dead-file cleanup                  |
| 4      | `007f75e` | product body and category hero narrowed to `max-w-7xl`                                                        |

Branches, all pushed and equal to origin: `perf/mobile-lcp-1a @ 0dd709b` ·
`perf/mobile-fcp-1 @ 95a40bf` (superseded, cherry-picked into deploy 3) ·
`fix/vat-truth @ d089e74` · `fix/channel-firewall @ 9ed9aed` ·
`fix/container-width @ 007f75e`.

`feat/product-experience-v1` is at `59b8ced` and is **behind production** — do not treat it
as the mainline.

Baseline after all four: `npx tsc --noEmit` 0 · lint **6 warnings / 0 errors** ·
vitest **271 passing, 25 files** (was 241/23; +12 VAT, +18 proxy).

## 3. ⚠ Hard deadline — 2026-08-04

**MAKY.STORE is a VAT payer, IČ DPH `SK2122890660`, effective 2026-08-04.** No real order
may be accepted before that date. The storefront already prices with VAT ("Cena s DPH",
Saleor `gross`) and the terms of sale now carry the same effective date.

Three things must be settled **before** that date, none of them started:

1. **`maky-smtp-app`** — a separate PM2 process, never audited. Its order emails may still
   repeat the old "nie je platiteľom DPH" claim, and from 2026-08-04 they should show a tax
   breakdown. Track B locked neutral "Celková cena" wording _because_ the shop was not a VAT
   payer; that decision is now obsolete.
2. **Invoices** — nobody has established what generates them. From 2026-08-04 they need tax
   base, rate, VAT amount and IČ DPH (§ 74). This cannot be decided at the first order.
3. **Do not open checkout before 2026-08-04.**

## 4. Open, not blocked

- **Four categories in the main navigation hold zero products**: Strešné nosiče, Ťažné
  zariadenia, Snehové reťaze, Autochladničky. Either stock them or take them out of the nav.
  **The counts are correct — do not "fix" the query.** Saleor's `Category.products` already
  includes descendants here: summing it over the level-0 categories gives exactly 453, the
  whole catalogue. Their subcategories are empty too.
- **Eleven markets are live and indexable with an empty catalogue** (`cz de at pl hu it fr es
ro us ca` — 0 products each, verified against the API). They are out of the sitemap;
  `noindex, follow` until stocked is the other half and is a business decision.
- **hreflang still advertises 12 language versions** while the sitemap says only `/sk` exists.
  Contradictory signals; resolve with the point above.
- **Manual, in Google Search Console**: submit the new sitemap, and use Removals on the junk
  that now genuinely 404s (`/admin/*`, `/wishlist/categories/*`, `/products/signup`,
  `/gb/login`).
- **`robots.txt`: do not restore the `Disallow` lines** for `/admin`, `/*/login$`,
  `/*/signup$`. With 404s and `noindex` in place they are unnecessary, and they would restore
  the exact trap that kept the junk indexed.
- The root `not-found.tsx` renders English on a Slovak-first shop. Marek has explicitly
  deprioritised it. It sits outside `[channel]` so it has no locale — needs a decision, not a
  quick patch.

## 5. Facts that will cost time if assumed otherwise

- **The route firewall lives in `src/proxy.ts`, and it has to.** Under PPR the shell is
  flushed before a page-level `notFound()` could set a status, so the response comes back 200
  with a noindex tag — which removes nothing already indexed. **The acceptance criterion is
  `curl -I`.** `NextResponse.rewrite(url, { status: 404 })` does yield a real 404 in Next
  16.2.9.
- `/checkout` and `/checkout/complete` are the **only** real market-less routes.
  `RESERVED_FIRST_SEGMENTS` in `proxy.ts` is enumerated from `src/app/`; extend it there if a
  new top-level route appears, or that route will 404.
- Certbot uses the `dns-cloudflare` and `nginx` authenticators, **not webroot**, so ACME does
  not depend on this app.
- `maky.store` previously ran a **WooCommerce shop selling workwear**. Legacy URLs such as
  `/pilcicke-nohavice-…` now 404, which is correct. Marek plans to sell work clothing, work
  footwear and hand tools again — but only after the auto-moto range is finished.
- `src/config/company.ts` is the single source for legal identity. **There is deliberately no
  `vatPayer` boolean** — derive from `icDph`. `src/config/company.test.ts` fails the build if
  a non-VAT-payer phrasing returns to a legal page.
- The sitemap is generated from Saleor at build time and revalidates hourly; a Saleor outage
  degrades it to the static entries rather than an empty `<urlset>`.

## 6. Performance track — closed

Measured, deployed and documented; do not reopen it inside the CMS work. Production Lantern
baseline after deploy 1 (5 runs, per-metric medians): perf **80** · FCP 1070 · LCP 3678 ·
TBT 339 · CLS **0.0143** · SI 1462. Remaining score loss is LCP −10.3 and TBT −9.6 only.

Two findings worth not re-deriving:

- **`fetchPriority` alone bought +4 ms.** The 565 ms saved on download reappeared as element
  render delay. Never claim an LCP win from a phase delta; only the end-to-end median counts.
- **Blocking Google removes 181–297 ms of TBT; deferring it removes almost none.** Google is
  49 % of all script bytes in two requests. `lazyOnload` (shipped) is worth ~2–3 points. The
  full win needs consent-gating — a business and legal decision, not a technical one, and
  GA4 + Google Ads currently ping before any consent click (Consent Mode v2 cookieless pings).

---

Next work is the Payload → Next.js content layer. Nothing in this document blocks it; the
2026-08-04 items above run on their own clock.
