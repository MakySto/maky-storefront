# Integration A/B/C — handoff

Written 10 September 2026 by the thread that did A, B and C on top of the US/CA tip.
Branch-only. Nothing is deployed, published, sellable or indexable, and this document
does not make it so.

Everything below marked as measured was measured on this branch. Anything I could not
establish is marked `UNKNOWN` and is not dressed up as a finding.

## Where it is

|             |                                                                 |
| ----------- | --------------------------------------------------------------- |
| Branch      | `claude/maky-store-integration-abcd-4e54c6`                     |
| Base        | `9304c579` — the US/CA tip, confirmed with `git ls-remote`      |
| Commits     | `cf02f52` (A), `c5a493a` (C), `aaa39e9` (B), plus this document |
| Local build | `pnpm build` clean, BUILD_ID `qGPQOP2U2daaT4K_voOh-`            |
| State       | pushed, **not deployed**, 1752 tests                            |

The worktree started at `578c33b`, a strict ancestor of `9304c579`, so it
fast-forwarded. No reset, no rebase, no force, and no other branch was moved.

## `pnpm build` is not broken — correcting a standing claim

Three handoffs now record that `pnpm build` "fails in a fresh worktree on the prebuild
codegen hook" and must be replaced by `npx next build`, which skips the hook when
`src/gql/` already exists. That workaround was never necessary, and calling it a
bypassed hook understated the problem: it means the committed `.graphql` documents were
never checked against the schema at build time.

The hook fails for one reason, and it is not a code fault:

```
Before GraphQL types can be generated, you need to set NEXT_PUBLIC_SALEOR_API_URL
```

`.graphqlrc.ts` reads that variable through `loadEnvConfig()`, which reads `.env`.
`.env` is gitignored and correctly absent from a fresh worktree, so the variable is
unset and codegen exits 1 before it starts. It is an environment gap.

The three values are `NEXT_PUBLIC_*`. They are inlined into the public client bundle,
and `https://api.maky.store/graphql/` is already hard-coded as the default in two
committed scripts (`scripts/checks/nav-links.mjs`, `scripts/ops/nordrive-manifest.mjs`).
Supplying them is not handling a secret.

With them supplied, the whole chain runs — codegen from the live schema, then the build:

```bash
export NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/
export NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur
export NEXT_PUBLIC_STOREFRONT_URL=https://maky.store
pnpm install --frozen-lockfile --ignore-scripts && node_modules/.bin/husky install
pnpm build
```

Measured twice, on this branch and on the base: exit 0, 34 s wall clock, peak RSS
1,061,196 kB (1.01 GB — consistent with the ~988 MB in CLAUDE.md §13.1), 76 static pages.
The 24 `[GraphQL] … Network error` lines are the known pre-existing `cacheComponents`
prerender aborts.

So a release build needs no bypass. What it still is not: **codegen runs against the
live production schema**, so the generated types depend on what `api.maky.store` served
at that moment. A genuinely hermetic build would pin a `schema.graphql` — `.graphqlrc.ts`
already has the branch for it (`GITHUB_ACTION=generate-schema-from-file`) and the file
simply does not exist in the repo. `src/checkout/graphql/codegen.ts` has no such branch
at all. Committing a pinned schema is a decision for M and not something to slip into an
integration branch; until then, "reproducible" means reproducible from the same schema,
not from any schema.

Dependencies were installed with `pnpm install --frozen-lockfile`, which hardlinks from
the pnpm content-addressable store. Nothing was hardlinked or symlinked into
`/opt/storefront/node_modules`.

## A — the footer links the legal pages in every market

`footer.tsx` gated both link columns and the bottom pair on
`REVERSE_MAP[channel] === "sk"`. Eleven of twelve markets rendered a footer with no route
to `/kontakt` or `/obchodne-podmienky` at all. The pages answered 200 the whole time;
only the way to reach them was missing, and that access path is the half that zákon
22/2004 and Directive 2000/31/EC Art. 5 actually ask for. The comment above
`LEGAL_SUPPORT` asserted the rule the code below it broke.

The filter is `marketHasRoute()` from `route-policy.ts` — the same question the proxy
asks before it 404s, so a rendered link cannot point at a route the proxy would refuse.
No second map. Not driven by `MAKY_LIVE_MARKETS` or the indexing flag: whether a market
sells yet, and whether Google may index it, say nothing about whether a visitor may
reach mandatory information.

`/o-nas` needs no special case. It is a CMS route, so it drops out on its own on the
eleven markets Payload has no document for, and it returns by editing `route-policy.ts`
alone. `/poradna` was not added — it is a CMS route too, and a test now holds it out.

**The 18 English strings.** Turning the links on exposed `footer.shippingAndPayment` and
`footer.withdrawal` sitting in English in nine catalogues — invisible only because the
links were hidden. A Spanish footer would have read "Shipping and payment". The
replacements are the wording those routes already publish as their own `heading` (or
`title` where there is no separate heading), with the market qualifier dropped, so no
third phrasing of either term enters the product:

| locale | `shippingAndPayment`   | `withdrawal`             |
| ------ | ---------------------- | ------------------------ |
| cs-CZ  | Doprava a platba       | Odstoupení od smlouvy    |
| de-DE  | Versand und Zahlung    | Widerrufsrecht           |
| de-AT  | Versand und Zahlung    | Rücktrittsrecht          |
| pl-PL  | Dostawa i płatności    | Odstąpienie od umowy     |
| hu-HU  | Szállítás és fizetés   | Elállási jog             |
| it-IT  | Spedizione e pagamento | Diritto di recesso       |
| fr-FR  | Livraison et paiement  | Droit de rétractation    |
| es-ES  | Envíos y pagos         | Derecho de desistimiento |
| ro-RO  | Livrare și plată       | Dreptul de retragere     |

Values only, 18 changed lines, no keys touched. `footer.cookiePolicy` and
`footer.contact` were left alone — "Cookies" and "Contact" are legitimately identical in
several of these languages, and my own English-leak scan flagged `fr` and `ro` "Contact"
as leaks, which is exactly the false positive the brief predicted.

### A — acceptance, measured in a browser after hydration

`curl` cannot answer this: the footer is inside a Suspense boundary and the shell carries
only the skeleton, so a raw-HTML grep returns a false zero even for `sk`.

| market           | legal links | `/o-nas` | English leak |
| ---------------- | ----------- | -------- | ------------ |
| sk               | **10**      | yes      | none         |
| the other eleven | **9**       | no       | none         |

All twelve read from the hydrated DOM, all with the real footer (skeleton flag false).
Anchors per market went `sk` 13 → 13 (unchanged) and every other market 3 → 12.

- **85 unique footer targets, all HTTP 200.** No footer link 404s.
- **`/o-nas` is 200 on `sk` and a hard 404 on the other eleven** — which is why it is
  linked on `sk` only. `/poradna` is 200 on `sk`, 404 elsewhere, and linked nowhere.
- Every `/kontakt` renders a localised `h1` (Kontakt / Kapcsolat / Contatti / Contacto /
  Contact / Contact us), so these are real pages, not soft-404s.

## B — the model withdrawal form prints as a document

`src/` contained no `@media print` rule at all, and `ModelFormActions` calls
`window.print()` on the whole document. The statutory model form — the sheet a consumer
fills in and posts — printed with the navigation and search across the top, the dark
footer at the bottom, and the cookie bar over the page if it had not been answered.

The chrome now carries `print:hidden` on its own root: header, footer, and **both
Suspense skeletons**, because a print can happen before either resolves and a printed
skeleton is no better than printed navigation. The cookie bar and the cart drawer are
handled by one rule instead — both are `role="dialog"`, and the drawer is portalled to
the end of `<body>` where no ancestor class reaches it.

Deliberately **not** a bare `header`/`footer` element selector: `/garage` and
`/konfigurator` both use a semantic `<header>` for real page content, so that rule would
have deleted content from the page it was meant to clean up.

The rest of the `@media print` block is what a utility cannot express — dropping
`min-h-dvh` so a hidden footer does not reserve a viewport of blank paper, unsticking
`sticky`/`fixed` so nothing repeats on every sheet, releasing the prose column's screen
reading measure, and orphan/widow control. No new dependency, no PDF generator; the
download is still the plain-text file.

### B — acceptance, over CDP against a real build

Under `Emulation.setEmulatedMedia({media:"print"})`, with **ancestor-aware** visibility
(`Element.checkVisibility`) — a first pass using `getComputedStyle` on the buttons
reported them visible, because a child of a `display:none` parent still computes its own
`display`:

| probed under print media | result |
| ------------------------ | ------ |
| site header / nav        | hidden |
| footer                   | hidden |
| consent dialog           | hidden |
| Print + Download buttons | hidden |

- Tested with the consent bar **deliberately opened** as well as closed. The two produce
  **byte-identical** printed text.
- `Page.printToPDF` at **A4** (8.27×11.69 in) and **Letter** (8.5×11 in): one page each,
  ~52–56 kB, for `sk` and `us`.
- **Nothing is lost.** Across all twelve markets the prose column's text is identical
  under screen and print media — 775 (sk) to 1156 (us) characters, compared string for
  string. Print drops chrome and never content.
- The printed `sk` sheet carries the seller block (`MAKY.STORE s. r. o., Stará Vajnorská
11, 831 04 Bratislava, e-mail: info@maky.store`), the declaration, every field line,
  date and signature — and none of "Vytlačiť formulár", "Stiahnuť formulár", "Podpora",
  "Spoločnosť", "Nastavenia súkromia", "Košík" or "Vyhľadať".

The cookie bar was **not** touched. Confirmed again here: `fixed`, `bottom: 0`, full
width, and it does not appear on paper. The earlier "jump" was a full-page-screenshot
artefact.

## C — the cookies page names a control that exists

The page tells the reader to return to a named control in the footer. That name is prose
on one side and `footer.privacySettings` on the other, so the two can drift — and had:

| body | the page said                     | the footer renders            |
| ---- | --------------------------------- | ----------------------------- |
| it   | «Preferenze sulla privacy»        | «Impostazioni privacy»        |
| es   | «Preferencias de privacidad»      | «Configuración de privacidad» |
| ro   | „Preferințe de confidențialitate” | „Setări de confidențialitate” |

The page moves, not the footer: the label is UI chrome, changed in one place, and the
page is the thing doing the referring.

> **The brief said this was `es` and `ro` only, and that Italian never mentions the
> footer. Italian does.** The phrase `piè di pagina` wraps across two source lines under
> Prettier, so a scan of the raw text misses the sentence and reports the file clean —
> the same class of false negative the brief itself warns about. Fixing its two
> neighbours and knowingly leaving Italian pointing at a control that does not exist was
> not defensible, so all three moved. This is the one place where I went past the stated
> scope, and it is a three-string change inside the same defect.

`sk`, `cs`, `pl`, `hu` and `fr` already matched. `de`, `deAt` and both English bodies
name no control in a footer sentence — English takes the label as a prop read from the
catalogue, so it cannot drift.

Because the failure mode is drift between two files, the audit is now
`cookies-control-name.test.ts` rather than a one-off. It normalises whitespace before
matching, so the wrapped phrase cannot hide again.

## Tests — falsified, not just green

The footer had **no test at all**, which is why the original defect survived; 1731 tests
passed while eleven markets shipped a footer with no legal links. The selection is now a
pure function so it can be asserted per market in this repo's `node` environment.

| deliberate defect                    | result                                            |
| ------------------------------------ | ------------------------------------------------- |
| restore the `sk` gate in the footer  | **3 tests red**                                   |
| leak `/poradna` into the footer list | **2 tests red**                                   |
| restore the Italian cookies wording  | **1 test red**, naming the market and both labels |

Restored and green again after each. The synthetic uncovered-market fixture and the
positive twelve-market cases are untouched.

## Gates — run, with results

| Gate                     | Result                                                                  |
| ------------------------ | ----------------------------------------------------------------------- |
| `tsc --noEmit`           | clean                                                                   |
| `eslint`                 | 0 errors, 6 warnings — the same six as the base, none in a touched file |
| `vitest run`             | **1752 passed**, 9 skipped (1731 + 21 new)                              |
| i18n parity              | 12 locales, **637 keys, identical**, missing 0 / extra 0                |
| `pnpm build`             | exit 0 **with the prebuild hook**, BUILD_ID `qGPQOP2U2daaT4K_voOh-`     |
| `check:css`              | OK — 6 `animate-*` classes, all emitted                                 |
| `check:nav`              | OK — 6 surfaced categories resolve, indexable, no slug collision        |
| Footer, 12 markets       | hydrated DOM: `sk` 10, others 9; 85/85 targets HTTP 200                 |
| Print                    | chrome hidden, A4 + Letter 1 page, screen↔print text identical ×12     |
| Viewport                 | 360 px and 1280 px, `scrollWidth == clientWidth` on every page          |
| Regression vs `9304c579` | **96/96**, see below                                                    |

### The regression, and the two traps in it

96 URLs (8 static routes × 12 markets) served from two real builds — this branch on one
port, `9304c579` on another — and compared **from the hydrated DOM**.

| compared                           | identical |
| ---------------------------------- | --------- |
| `<title>`                          | 96/96     |
| canonical                          | 96/96     |
| `<html lang>`                      | 96/96     |
| robots meta                        | 96/96     |
| description                        | 96/96     |
| form and submit counts             | 96/96     |
| every `<h1>`                       | 96/96     |
| every content `<h2>`               | 96/96     |
| **content text (footer excluded)** | **93/96** |
| footer text                        | 8/96      |

The three content changes are `/it/cookies`, `/es/cookies` and `/ro/cookies` — the
privacy-control labels from C, with the before and after printed. The 88 footer changes
are the eleven non-`sk` markets × eight routes, which is A. **Nothing else moved.**

Two traps, both hit and both designed out:

1. **Reading only `<main>` reads the PPR placeholder.** The body arrives later in the
   same response inside `<div hidden id="S:…">`. Known from the US/CA handoff.
2. **The real `<footer>` is not a `<footer>` element in the served HTML.** Only the
   _skeleton_ is. The real footer streams into `<div hidden id="S:9">` and is swapped in
   by a script, so a tag-based split silently separates nothing — my first run reported
   "footer identical 96/96" while the footer text it had extracted was **zero
   characters** and the real footer content was sitting in the body bucket. It was caught
   by printing the minimum extracted length, which read `0`. This one is not in any
   previous handoff.

The final run reports its own floors: minimum content text **1214** characters, minimum
footer text **202**, and it refuses to conclude if either falls below a threshold.

## D — `<html lang>`: not implemented, and D1 is dead

Measured, not estimated.

**D1 (`headers()` in the root layout) does not build.** Not "loses the static shell" —
the build exits 1:

```
Error: Route "/[channel]/poradna": Uncached data was accessed outside of <Suspense>.
Export encountered an error on /[channel]/(main)/poradna/page, exiting the build.
```

Under `cacheComponents: true`, request data in the root layout is a hard error, and
`<html>` is the document element so it cannot be moved inside a Suspense boundary. I
applied D1 to a scratch copy of the base, built it, captured the failure and restored the
file. **D1 should be struck from the options table**, not merely marked high-risk.

**D matters more than the brief assumed.** `<html lang>` is currently the _only_
in-HTML language signal, because there is **no `hreflang` at all** — measured as zero
`hreflang=` occurrences on `/sk`, `/de`, `/us` and `/de/kontakt` alike. Canonical is
correct per market; the language annotation is `sk` on all twelve.

What a consumer actually gets today:

| consumer                                     | sees                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| browser, after hydration                     | correct — `cs`, `de`, `pl`, `hu`, `it`, `fr`, `es`, `ro`, `en` (measured on all 12) |
| crawler, `curl`, validator, pre-hydration AT | `sk`, on every market                                                               |

Note both English markets resolve to `en`, not `en-US`/`en-CA`.

**D2 (route groups: `(storefront)/[channel]/…` and `(checkout)/checkout/…`) is the only
structurally correct fix,** and it keeps the shell static, because the channel set is
finite and known at build time — the lang becomes a build-time constant per channel
rather than request data. Blast radius, counted: 16 files sit directly under `src/app/`
(`layout.tsx`, `page.tsx` root redirect, `error.tsx`, `not-found.tsx`, `robots.ts`,
`sitemap.ts`, `actions.ts`, `config.ts`, the icon/OG assets and two tests), and
`/checkout` is a single-segment route outside `[channel]`. I did **not** build it — the
brief says not to implement two competing variants, and this is a decision, not a task.

**Recommendation for Marek.** Two things to decide, and they are separable:

1. The missing `hreflang` is a bigger and cheaper win than D2 and belongs to whoever owns
   SEO, not to this refactor. It should be looked at first.
2. If `<html lang>` still matters after that, D2 is the only option that works. D3 (leave
   it, documented) remains defensible on its own: it is pre-existing, browsers get the
   right value, and canonical per market is already correct.

## The 12-market matrix

`UNKNOWN` means not verified here, not "failing".

| market | content | route  | footer | print     | CMS `/o-nas` | Returns      | commerce      | deployed | indexable  |
| ------ | ------- | ------ | ------ | --------- | ------------ | ------------ | ------------- | -------- | ---------- |
| sk     | ✅      | ✅ 8/8 | ✅ 10  | ✅        | ✅ published | ✅ live      | ✅ selling    | ✅ prod  | ✅         |
| cz     | ✅      | ✅ 8/8 | ✅ 9   | ✅        | ❌ none      | ❌ SK-pinned | UNKNOWN       | ❌       | ❌ noindex |
| de     | ✅      | ✅ 8/8 | ✅ 9   | ✅        | ❌ none      | ❌ SK-pinned | UNKNOWN       | ❌       | ❌ noindex |
| at     | ✅      | ✅ 8/8 | ✅ 9   | ✅        | ❌ none      | ❌ SK-pinned | UNKNOWN       | ❌       | ❌ noindex |
| pl     | ✅      | ✅ 8/8 | ✅ 9   | ✅        | ❌ none      | ❌ SK-pinned | UNKNOWN       | ❌       | ❌ noindex |
| hu     | ✅      | ✅ 8/8 | ✅ 9   | ✅        | ❌ none      | ❌ SK-pinned | UNKNOWN       | ❌       | ❌ noindex |
| it     | ✅      | ✅ 8/8 | ✅ 9   | ✅        | ❌ none      | ❌ SK-pinned | UNKNOWN       | ❌       | ❌ noindex |
| fr     | ✅      | ✅ 8/8 | ✅ 9   | ✅        | ❌ none      | ❌ SK-pinned | UNKNOWN       | ❌       | ❌ noindex |
| es     | ✅      | ✅ 8/8 | ✅ 9   | ✅        | ❌ none      | ❌ SK-pinned | UNKNOWN       | ❌       | ❌ noindex |
| ro     | ✅      | ✅ 8/8 | ✅ 9   | ✅        | ❌ none      | ❌ SK-pinned | UNKNOWN       | ❌       | ❌ noindex |
| us     | ✅      | ✅ 8/8 | ✅ 9   | ✅ Letter | ❌ none      | ❌ SK-pinned | ❌ 0 products | ❌       | ❌ noindex |
| ca     | ✅      | ✅ 8/8 | ✅ 9   | ✅ Letter | ❌ none      | ❌ SK-pinned | ❌ 0 products | ❌       | ❌ noindex |

Read the columns separately. **M-ready** (content, route, footer, print) is ✅ for all
twelve. **CMS-ready**, **Returns-ready** and **commerce-ready** are other people's, and
none of them is ✅ outside `sk`. The commerce column is inherited from the US/CA handoff's
anonymous read and is **not** a new measurement — I did not query Saleor.

## What I did not do, and why

- **No Payload work.** `maky-cms` is not on this machine, and its production credentials
  are in `/opt/storefront/.env`, which must not be copied into a public-fork worktree.
  The storefront side is already built (`markets.ts` maps all 12; blocks filter per
  market; CMS links are relative), and the gate is two lines in `page-route.tsx` — but
  opening it before a published document exists turns eleven soft-404s into a promise the
  CMS cannot keep. The consumer work the brief lists (the Slovak `ONasStaticContent`, the
  Slovak `CompanyDetails` labels, the bootstrap fallback that must not serve Slovak text
  under a foreign canonical) is **untouched and still open**.
- **No Saleor.** A–C do not depend on it, and the brief's Saleor section is K's.
- **No D.** See above — a decision with numbers attached, not an implementation.
- **No deploy, no PM2, no production `.env`, no market flags, no CMS writes.** Nothing
  was merged to `release/*` or `main`.
- **The second customer-journey package** (navigation, configurator, garage, PDP, cart,
  checkout, account) was not started. A–C plus a trustworthy build and regression was the
  first package.

## How to reproduce

```bash
cd /opt/storefront/.claude/worktrees/storefront-integration-handoff-4e54c6
export NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/
export NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur
export NEXT_PUBLIC_STOREFRONT_URL=https://maky.store
pnpm install --frozen-lockfile --ignore-scripts && node_modules/.bin/husky install
node_modules/.bin/tsc --noEmit && node_modules/.bin/eslint && node_modules/.bin/vitest run
pnpm run i18n:check
pnpm build && node_modules/.bin/next start -p 3457    # never -H 127.0.0.1: redirect loop
```

Headless Chromium is at `~/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`,
driven over CDP by plain Node (`ws` is in `node_modules/.pnpm/ws@8.19.0/`). Use
viewport-only capture for `fixed` elements. Kill Chrome with `pgrep -x chrome`, never
`pkill -f`. Never build in `/opt/storefront` itself (CLAUDE.md §13.1).

Local test runs are not GitHub CI. No production SHA or BUILD_ID is claimed here;
`qGPQOP2U2daaT4K_voOh-` is this branch's local build, not a deployment.
