# Product experience v3 — handoff

**Written 2026-07-29 at the end of the overnight session. Self-contained: everything a
fresh thread needs is here or linked from here.**

Read first, in this order: `CLAUDE.md` (§4 colour semantics, §8 PDP, §10 restrictions,
§11 validation, §13 build/deploy safety), then this file. Two companion docs:

- `docs/design/i18n-hardcoded-strings.md` — 62 untranslated strings with proposed
  Slovak. **Waiting on a decision from Marek** (see §3).
- `docs/design/product-experience-v2-handoff.md` — the previous handoff. Its §5
  "facts" section is still accurate; its §2 work queue is now done.

---

## 1. Where things stand

Production `maky.store` runs **`2ff14a0`**, BUILD_ID **`bKCAV3OX2heop4vVvhmaC`**,
PM2 `maky-storefront`, cwd `/opt/storefront`.

The branch `feat/product-experience-v1` and `origin/` are one commit ahead at
**`aba3d3b`** — this document. It is docs-only, so **no code is unshipped**: every
source change in §2 is live. The worktree `/home/ubuntu/wt-pdp` is clean at `aba3d3b`.
`/opt/storefront` is checked out at `2ff14a0`, which is what the running build was made
from; that is expected, not drift.

Rollback artefacts in `/opt/storefront`:

| directory           | build                                |
| ------------------- | ------------------------------------ |
| `.next.rollback`    | `752072d` (the deploy before last)   |
| `.next.prev-backup` | `9a02b27` (old, from the v1 session) |

Five deploys this session, 40–43 s downtime each, PM2 restarts 0 throughout.

**Marek pre-authorised deploying without asking**, for this line of work. He reviews in
the morning. That authorisation is not open-ended — treat anything outside "fix and
improve the storefront" as needing a fresh ask.

---

## 2. What shipped this session

18 commits on top of `471c704`. Grouped by theme, newest first within each group.

### Layout / mobile

| commit    | what                                                                              |
| --------- | --------------------------------------------------------------------------------- |
| `2ff14a0` | keep the header slogan on 360px phones (shrink it instead of hiding it)           |
| `752072d` | **the sideways-pan bug** — header + PDP grid overflow at 360px; translate buy bar |
| `0b510d2` | cookie consent below the drawer; new `--z-consent: 250` token                     |
| `52f1c27` | cart drawer painted over by the sticky toolbar; whole z-index scale onto tokens   |

### Accessibility — now 100 on homepage, category and product

| commit    | what                                                                     |
| --------- | ------------------------------------------------------------------------ |
| `f85e72b` | last contrast + naming failures; **a11y 100 on all three page types**    |
| `047bee6` | 24px carousel targets, footer heading order, logo name, AA text contrast |

### SEO

| commit    | what                                                                  |
| --------- | --------------------------------------------------------------------- |
| `a4ae6c9` | one breadcrumb component, visible on mobile, + BreadcrumbList JSON-LD |
| `adaffe7` | category listings had no canonical at all                             |
| `7846683` | PDP structured data claimed the category was the brand                |

### Performance

| commit    | what                                                                 |
| --------- | -------------------------------------------------------------------- |
| `ebf7123` | drop the `eager` escape hatch — next/image preloads eager images too |
| `0dc4111` | stop preloading images the browser never renders                     |
| `5192b61` | drop Vercel Speed Insights, which cannot work on this host           |

### Content / truthfulness

| commit    | what                                                                 |
| --------- | -------------------------------------------------------------------- |
| `f620554` | **brand strip advertised five brands the shop does not sell**        |
| `c8deb03` | drop the footer identification block; card category reads as a link  |
| `8fbcf84` | "SKU" for sk/en, native terms restored for the other nine locales    |
| `00bfc09` | (superseded by `8fbcf84`)                                            |
| `0c80488` | card: availability on its own line under the SKU; category is a link |

### Docs

`f67f9ba` i18n inventory · `cfe034f` the v2 handoff.

---

## 3. Open decisions — ask Marek before coding

1. **i18n scope.** `docs/design/i18n-hardcoded-strings.md` lists 62 hardcoded English
   strings with proposed Slovak. Open question: fill **all 12 locale files**, or only
   sk/en while the other ten markets still have no products? Nothing should be typed
   into the message files until he answers.
2. **Brand links.** Deferred by Marek on 2026-07-29. No `/znacky` route and no brand
   facet exist (`filter-utils.ts` handles colour, size, price only). Choice is
   `?brand=<slug>` on `/sk/products` (smaller, reuses the toolbar) versus a real
   `/{market}/znacky/{slug}` route (better SEO, more work). **Do not build either
   unprompted.**
3. **Composite SKUs.** Deferred — they render raw, pipes and all
   (`PZ-GP019|PZ-GP020`, `A7604|A7604|A7604`). Marek chose raw deliberately: the last
   one is a genuine set of three identical parts, so "first segment only" would lie.
4. **Grid tweaks.** Marek said "niekoľko vylepšení" about the product grid and has not
   yet named specifics. Ask; do not guess.

---

## 4. Proposed backlog — measured, not guessed

Ordered by impact. Every claim below was verified on production on 2026-07-29.

### 4.1 Sitemap contains no products and no categories — biggest SEO gap

`https://maky.store/sitemap.xml` has **32 URLs**: eleven market homepages, their
`/{market}/products`, and the Slovak legal pages. Zero of the 453 products and zero of
the ~7 categories. Verify with:

```bash
curl -s https://maky.store/sitemap.xml | grep -c '<loc>'
```

### 4.2 The sitemap hands Google ten empty storefronts

Only `/sk` has products. `/cz /de /at /pl /hu /it /fr /es /ro /us /ca` each return
**zero** products on `/{market}/products`, and all eleven markets plus their
`/products` are in the sitemap — 22 URLs of empty shop. That is thin content and can
drag the whole domain's quality signals. Either `noindex` them or drop them from the
sitemap until they are stocked. Related: `en-CA` is still missing 211 i18n keys
including all of `checkout.*`, and `/ca` is both live and advertised.

### 4.3 "Vybrať vozidlo" is a dead button

`src/ui/components/header/vehicle-selector-trigger.tsx` has no `onClick`, no state, no
filtering. It is the most prominent control in the header. Wiring it needs fitment
data that does not exist — every TAZAR product is universal. So the real choice is
hide it or accept it as a visible promise the shop cannot keep. This is a data/product
decision, not a layout one.

### 4.4 `<title>` and `meta description` stream into the BODY, not `<head>`

That is why PLP and PDP sit at SEO 92 while the (static) homepage reaches 100.
Confirmed: `document.head.querySelector('meta[name=description]')` returns `null`
after hydration even though the tag is present in the markup. It is a consequence of
the PPR/`cacheComponents` setup, so it touches §10 territory — discuss before
changing.

### 4.5 Filters are price-only in practice

`filter-utils.ts` offers colour, size and price. Colour and size are apparel facets
inherited from the template and extract nothing from this catalogue, so the toolbar
effectively filters on price alone. The facets that would matter here are **brand**
and **vehicle**. Brand ties directly to open decision 3.2.

### 4.6 Smaller, all confirmed

- Carousel dot labels are hardcoded English `Go to slide N` on a Slovak storefront.
  Needs a translation key threaded through a shadcn primitive.
- `errors-in-console`: a React #419 keeps best-practices at 96.
- CLS `0.0615` on `<div class="flex min-h-[calc(100dvh-64px)]">` — the layout assumes
  a 64px header and the real one is taller. **Pre-existing**, identical score measured
  on the untouched build; not introduced by this session.
- 153 KiB of unused JavaScript.
- `@vercel/speed-insights` is still in `package.json` though nothing renders it now.
  Dropping it is a lockfile change; do it in daylight.

### 4.7 Blocked on data, not code

CompatibilityBox at the CTA (CLAUDE.md §8 requires it, but no fitment data exists),
reviews (`Product.rating` is null across the catalogue), related products (needs a
rule for what "related" means).

---

## 5. Facts that will cost you hours if you assume otherwise

Carried forward from v2 and still true:

- **MAKY.STORE IS A VAT PAYER.** Saleor computes it and the storefront renders `gross`,
  so displayed prices already include VAT and both PDP and card say "Cena s DPH". Any
  older prompt saying otherwise is obsolete and now legally wrong.
- **Availability lives on the VARIANT**, `metafield(key: "cfm_availability_mode")`.
  Reading it from the product renders nothing and fails **silently**.
- **Never derive availability from `quantityAvailable`** — it is a synthetic cap of 50
  with `trackInventory=false`.
- **Attribute units** are keyed on `externalReference` (`cfm:attribute:weight`), never
  on display name or slug. `MeasurementUnitsEnum` has no speed unit.
- **12 locales, not 13.** `en-GB` was removed 2026-07-20.
- **Saleor `products` is a Relay cursor connection with no offset**, so honest numbered
  pagination is impossible without storing every cursor.
- **Tailwind v4, CSS-first, no `tailwind.config.js`.** An undefined `--color-*` emits
  NOTHING and the build still passes. `next build` certifies nothing about styling.

New this session:

- **Test mobile at 360px CSS, not 390 or 412.** Marek's phone is 360. The sideways-pan
  bug was completely invisible at 412 and cost a round trip.
- **Tailwind v4 has no `--z-index-*` theme namespace**, so the z tokens in `:root`
  cannot generate `z-header`-style utilities. Use `z-[var(--z-drawer)]`.
- **`loading="eager"` is not a middle ground on next/image** — it preloads every
  non-lazy image, so eager reproduces exactly the preload links you were trying to
  remove. Count `<link rel="preload" as="image"` in the served HTML.
- **The catalogue's real brands** (queried from `cfm:attribute:manufacturer`): Amos,
  ATAS, CARCAMP, DAC, DYNAMAX, Fabbri, G3, Green Valley, Junior, KJUST, Lampa, MANIA,
  Menabo, Neznačkové, Nordrive, Northline, Peruzzo, Peruzzo - GP, Pro-USER, SLIME,
  Spinder, Thule, Yakima. Several are **not** on CLAUDE.md §6's approved homepage list;
  adding them is Marek's call.
- **CLAUDE.md §9 changed.** The operating-entity details are no longer in the footer;
  they live on `/kontakt`, `/obchodne-podmienky` and `/reklamacie-a-vratenie`. The
  footer's links to the first two are load-bearing for
  zákon 22/2004 / Directive 2000/31/EC Art. 5 — do not remove them.

### Do NOT re-report these — they were checked and are fine

- **Search works.** The parameter is `?query=`, not `?q=`. An early "0 results" reading
  in this session was a bad grep, corrected the same hour.
- **The PDP price is correct.** It renders `55,35 €` with a Slovak comma; a screenshot
  made it look like a dot. The DOM is authoritative.
- **The CLS 0.0615 is pre-existing**, not a regression from the breadcrumb work.

---

## 6. How to work on this box

### Worktree

`/opt` is root-owned in spirit, worktrees go under `/home/ubuntu`. **`/home/ubuntu/wt-pdp`
already exists** on `feat/product-experience-v1`, with `node_modules`, `.env` and
`.husky/_` in place. Reuse it. If you need a fresh one:

```bash
git worktree add --detach /home/ubuntu/wt-<name> <sha>
cp -al /opt/storefront/node_modules /home/ubuntu/wt-<name>/node_modules
cp -p /opt/storefront/.env /home/ubuntu/wt-<name>/.env
cp -r /opt/storefront/.husky/_ /home/ubuntu/wt-<name>/.husky/_
```

`package.json`/`pnpm-lock.yaml` are unchanged from prod, so **never run `pnpm install`** —
the hardlink copy is enough and sidesteps the repo's supply-chain policy.

There is no `typecheck` script. Use `npx tsc --noEmit`. Lint reports **6 pre-existing
warnings, 0 errors** — that is the clean baseline. Tests: 241 passing, 23 files.

### Measuring in a real browser

Headless Chromium lives at
`/home/ubuntu/.cache/ms-playwright/chromium-1228/chrome-linux/chrome`. Two scratch
scripts were written this session and are worth recreating (they are ephemeral, under
`/tmp/claude-1000/.../scratchpad/`):

- `shot.mjs <url> <out.png> <w> <h> [clickSelector]` — CDP screenshot with device
  emulation, dismisses the cookie banner unless `KEEP_BANNER=1`, optional `SCROLL=<px>`.
- `dom.mjs <url> <expression>` — evaluates JS in the page with `W`/`H` env for viewport
  and `awaitPromise` on, for measuring layout.

The cart drawer trigger is `[data-testid="CartNavItem"]`.

**Screenshot the awkward state, not the happy one.** The cookie-consent z-index defect
was only visible with the banner left undismissed; the obvious screenshot looked fine.

### Lighthouse — and why single runs lie

PSI's public API is unusable here (HTTP 429, anonymous daily quota exhausted; it needs
a key). Run Lighthouse directly:

```bash
CHROME_PATH=/home/ubuntu/.cache/ms-playwright/chromium-1228/chrome-linux/chrome \
npx --yes lighthouse@12 "https://maky.store/sk" \
  --only-categories=performance,accessibility,seo,best-practices \
  --form-factor=mobile --screenEmulation.mobile \
  --output=json --output-path=./lh.json \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu" --quiet
```

**Three runs of the SAME production build gave PDP performance 72 / 78 / 82 and LCP
6.3 / 4.1 / 3.7 s.** The first run is cold-cache and always reads worst. Take a median
of at least three per URL, and never compare a localhost preview against production —
different transport, different TTFB. Accessibility and SEO audits are deterministic and
can be trusted from a single run; performance cannot.

A `width: min-content` probe **overstates** a flex/grid constraint, because it ignores
that `overflow: hidden` lets flex items shrink below their content. Trust rendered
rects (`getBoundingClientRect`) and `scrollWidth` vs `clientWidth`.

### Deploy (~42 s downtime, measured five times)

```bash
cd /opt/storefront
rm -rf .next.rollback && cp -al .next .next.rollback
pm2 stop maky-storefront && git checkout <sha> && rm -rf .next && pnpm build && pm2 start maky-storefront
```

Always wrap it so a failed build restores `.next.rollback` and checks the old SHA back
out. **Never `next build` in `/opt/storefront` while PM2 is serving it** (CLAUDE.md §13).
**Never `pkill -f` with a broad pattern** — `next-server` matches the production
process, and a `-f` pattern also matches the killing shell. Kill a preview by
port-derived PID:

```bash
ss -lptnH 'sport = :3033'
```

…and compare against `pm2 pid maky-storefront` before killing.

Post-deploy, verify the CSS actually paints — `next build` passing certifies nothing
(CLAUDE.md §4.2). Fetch the `/_next/static/chunks/*.css` the page references and grep
for a token you touched.

---

## 7. What I got wrong this session

Recorded so the next thread does not repeat it.

- **Reported an accessibility improvement without re-auditing the deployed result.**
  Two of four fixes had not actually landed. Re-measure after deploying, not before.
- **Hid the header slogan to fix the overflow.** That was the lazy half of the fix;
  Marek noticed immediately. Shrinking it was both possible and correct.
- **Claimed a "0 results" search bug** from a bad grep, and **misread a price
  separator** off a screenshot. Both corrected within the hour by checking the DOM.
  Screenshots are evidence of a symptom, never of a cause.
- **Assumed `loading="eager"` would avoid a preload.** It does not. The count in the
  served HTML was unchanged, which only surfaced because I checked.
