# M2 — CMS consumer, navigation and SEO wiring

Written 10 September 2026, on top of the A/B/C handoff. Branch-only. Nothing is
deployed, published, sellable or indexable, and this document does not make it so.

## Where it is

|             |                                                                    |
| ----------- | ------------------------------------------------------------------ |
| Branch      | `claude/maky-store-integration-abcd-4e54c6`                        |
| Base        | `069324a` — the A/B/C tip                                          |
| Commits     | `87f1def` (M2.1 CMS consumer), `a9ef79f` (M2.2 hreflang + sitemap) |
| Local build | `pnpm build` clean, BUILD_ID `s3kOrCdJpfCWuVVqGKC0M`               |
| Tests       | **1790 passed**, 9 skipped (1752 before + 38 new)                  |
| Regression  | **96/96 identical on every field, footer included**                |

## First: a correction to my own last handoff

**hreflang was never missing.** `src/lib/seo/hreflang.ts` exists, is careful, and
returns `[]` below two live markets — and `DEFAULT_LIVE_MARKETS` is `["sk"]`, so zero
tags is the designed answer. I measured zero correctly and then called a deliberate
gate an absence. The A/B/C handoff says otherwise and is wrong on that point.

Two things made it easy to get wrong, and both are worth keeping:

- **Next renders the attribute as `hrefLang`**, React's camelCase name. `grep -c
'hreflang='` reports **0** on a page carrying four. Use `grep -i`.
- **`generateMetadata` is baked at build time under `cacheComponents`.** Setting
  `MAKY_LIVE_MARKETS` on `next start` changes nothing — I measured zero tags on a
  three-market runtime before realising the live set is a _build_ input. A market going
  live needs a rebuild, not a restart. This belongs in the release procedure.

What was actually missing was narrower: the helper had **one caller**. The homepage used
it; the legal pages and the CMS route set a canonical and stopped.

## M2.1 — the CMS consumer

`cmsPageRoute` gated on `isSlovakChannel()`, and everything under that gate assumed the
market it excluded: one `staticTitle`, one `staticDescription`, one `Bootstrap`, and a
company block written as Slovak prose. **Deleting the two gate lines would have served
Slovak copy and Slovak SEO under a German URL** the first time a foreign document was
published. The brief was right that this is not a two-line change.

### The four outcomes, per market

| outcome                                         | body                                | metadata                  |
| ----------------------------------------------- | ----------------------------------- | ------------------------- |
| route not offered in this market                | `notFound()`                        | noindex, **no canonical** |
| not-found (unpublished)                         | `notFound()`                        | noindex, no canonical     |
| market-mismatch                                 | `notFound()`                        | noindex, no canonical     |
| upstream fault, market **has** a bootstrap (SK) | the approved bootstrap              | full, with canonical      |
| upstream fault, market has **none**             | localised "temporarily unavailable" | noindex, no canonical     |
| found                                           | the CMS document                    | full, with canonical      |

The unavailable state is deliberately **not** a 404. An outage is not a deletion, and
telling a crawler the page does not exist because Payload timed out is a claim it will
act on. It is a service message (`cms.unavailableTitle` / `cms.unavailableBody`, added to
all twelve catalogues), not legal copy, and it carries `noindex` and no canonical so a
fault can be neither indexed nor nominated as the real page.

`generateMetadata` follows the page component branch for branch, which is the invariant
that stops a soft-404 acquiring a self-canonical.

### Two gates, deliberately separate

- `marketHasRoute()` — does the **application** offer this route here. Static, in
  `route-policy.ts`.
- the CMS — is there **published content** right now.

The old code collapsed them, which is why the footer's comment claimed `/o-nas` "follows
the CMS" while the code read only the static table: publishing changed nothing, and
unpublishing left the link advertising a page that had gone.

`cmsRouteAvailable()` adds the second half. **The static gate is checked first and
short-circuits**, so a market that does not offer the route never reaches the CMS — today
that is one call on one market and none on the other eleven. That call is the same cached
`fetchCmsPage` the page performs, with the same `cms:page:<slug>` tag, so it is a Data
Cache hit and the webhook that invalidates the page invalidates the navigation at the
same moment. An **outage keeps the link**, because the route still renders something.

### The company block

`CompanyDetails` translates its four labels and none of its facts. Each label is the
wording that market's own `/kontakt` already publishes (`Anbieter:`, `Vendeur :`,
`Cégazonosító szám (IČO):`, …), so the two surfaces cannot name the same thing
differently. `companyInfo.registry` stays Slovak on purpose — it is the register's name,
not a sentence, like the street and city.

### What has NOT moved

`route-policy.ts` still lists `o-nas` and `poradna` as `sk`. Payload holds no translated
document, and opening a market before one exists turns eleven soft-404s into a promise
the CMS cannot keep. **This is the consumer, ready and proven against a mock.** Opening a
market stays one line there, once P delivers evidence.

`poradna` was deliberately not widened alongside `o-nas`: the two share the factory, so
opening one must not quietly open the other.

## M2.2 — SEO wiring

**Three of the eight static legal routes build their own metadata** rather than going
through `legalRoute` (`/odstupenie-od-zmluvy`, its `vzorovy-formular`, and the CMS
route), so each needed wiring individually. Verified per route rather than assumed — the
first pass wired `legalRoute` alone and left **two of eight silent**, which a
route-by-route check caught and a spot-check would not have.

**Eligibility is what had to be added, not the tags.** A market being live says nothing
about whether it has the page, and a non-reciprocal annotation gets the _whole_ cluster
discarded rather than the bad entry. Alternates now come from `route-policy.ts` — the same
table the proxy 404s on and the footer links from. Catalogue and private routes get
**nothing**: the same product slug under `/sk` proves nothing about `/de`, and that
identity lives in Saleor. When those identities exist, pass markets in explicitly rather
than widening the rule.

**Only `languages` is added anywhere.** `buildAlternatesMetadata` also builds an
_absolute_ canonical, and these routes have always emitted a relative one — so using the
whole helper silently rewrote the canonical on every legal page. Two existing tests caught
it. `buildLanguageAlternates` exists so the two decisions stay separate.

### The sitemap

`SK_ONLY_PATHS` was a hand-written table guarded by `market === "sk"`, with a comment
saying those routes "call `notFound()` for any other channel". Seven of the eight had
since gained approved copy in all twelve markets, so the table and the application
disagreed — invisibly, because only `sk` is live. It would have shipped as **eleven
sitemaps missing their legal pages**.

Deriving from route-policy also picked up **`/odstupenie-od-zmluvy/vzorovy-formular`**,
which is indexable and had never been in the sitemap at all.

### Sitemap headroom — for the release checklist

Measured on this build, `sk` alone live:

|      |                                               |
| ---- | --------------------------------------------- |
| URLs | **9,610** — 19.2% of the 50,000 limit         |
| size | 2.1 MB uncompressed — 4.2% of the 50 MB limit |

**At this density twelve live markets would be ~115,000 URLs — more than twice the
limit.** The current code emits one combined sitemap, so **splitting is required before
the multi-market catalogue launch**, not optional. That is a release-checklist item with a
number attached, not a reason to build a fictional catalogue now.

## Gates — run, with results

| Gate                    | Result                                                              |
| ----------------------- | ------------------------------------------------------------------- |
| `tsc --noEmit`          | clean                                                               |
| `eslint`                | 0 errors, the same 6 pre-existing warnings                          |
| `vitest run`            | **1790 passed**, 9 skipped                                          |
| i18n parity             | 12 locales, **643 keys, identical** (637 + `company` ×4 + `cms` ×2) |
| `pnpm build`            | exit 0 **with the prebuild hook**, BUILD_ID `s3kOrCdJpfCWuVVqGKC0M` |
| Regression vs `069324a` | **96/96 identical**, every field including the footer               |

### Proven against real builds, not only unit tests

With `MAKY_LIVE_MARKETS="sk,cz,de"` **at build time**:

- **24/24** legal URLs (8 routes × 3 markets) carry a complete four-entry cluster
- all three markets name the **same set** — reciprocal
- `/o-nas`, `/poradna`, `/products`, `/search`, `/cart` stay **silent**

With the default set (`sk` alone): **zero tags on every page**, so today's output is
unchanged — which the 96/96 regression confirms independently.

### Falsified, not just green

| deliberate defect                                                                     | result    |
| ------------------------------------------------------------------------------------- | --------- |
| remove **both** market filters (parser _and_ renderer — either alone changes nothing) | **5 red** |
| restore the shared Slovak bootstrap for every market                                  | **2 red** |
| treat an upstream outage as an unpublish                                              | **1 red** |
| drop the static short-circuit before the CMS call                                     | **1 red** |

The two-filter finding matters on its own: block-level market visibility is enforced
twice, in `page-schema.ts` and again in `cms-blocks.tsx`. A test that removes one and
sees green has proved nothing.

## State, reported separately

|                                               | SK                                         | the other eleven                                             |
| --------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `STATIC_A_C_READY`                            | ✅                                         | ✅                                                           |
| `CMS_CONSUMER_READY`                          | ✅                                         | ✅ (proven against a mock)                                   |
| `CMS_PROVIDER_E2E`                            | ✅ live                                    | ❌ no document exists                                        |
| `CONTENT_SEO_READY`                           | ✅                                         | ✅ latent — emits once ≥2 markets are live **at build time** |
| `CUSTOMER_JOURNEY_READY`                      | UNKNOWN                                    | UNKNOWN — M3, not started                                    |
| `D_STATUS`                                    | open — D1 does not build; D2 not attempted |                                                              |
| `COMMERCIAL_READY` / `DEPLOYED` / `INDEXABLE` | separate decisions, not this branch's      |                                                              |

## What P needs to hand over before a market opens

1. The published document id, its locale, and the market list on it.
2. `publish → update → unpublish → republish` observed through the storefront's own
   read, not the Payload admin — the consumer distinguishes all four, and the
   distinction is only real if the provider behaves as the contract says.
3. Evidence for the shared-locale pairs specifically: **US/CA both resolve to `en`, and
   DE/AT both to `de`**. The raw upstream response is legitimately identical and shared
   by the fetch cache; only the post-fetch filtering separates them. That is tested here
   in both directions, but against a mock.

Then, in this order: `route-policy.ts` (one line per market) → verify → nothing else. The
footer, the sitemap and hreflang all follow from that single edit.

## Open, and not mine to close

- **D (`<html lang>`)** — D1 does not build (measured, A/B/C handoff). D2 not attempted.
  Note that Google states it does not use `hreflang` or HTML `lang` to determine page
  language, so the case for D2 rests on **accessibility**, not SEO. That is a real case,
  but a different one than the last handoff implied.
- **A localised "temporarily unavailable" is my wording**, not approved copy. It is a
  service message and I would rather it were reviewed than assumed.
- **M3 — the customer journey** (configurator → PDP → cart → checkout) is not started.
- **Saleor, Returns, and the CFM export** are K's, R's and C's.

## How to reproduce

```bash
cd /opt/storefront/.claude/worktrees/storefront-integration-handoff-4e54c6
export NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/
export NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur
export NEXT_PUBLIC_STOREFRONT_URL=https://maky.store
pnpm install --frozen-lockfile --ignore-scripts && node_modules/.bin/husky install
node_modules/.bin/tsc --noEmit && node_modules/.bin/eslint && node_modules/.bin/vitest run
pnpm run i18n:check
pnpm build && node_modules/.bin/next start -p 3457      # never -H 127.0.0.1

# hreflang only exists in a build whose live set had two or more markets:
MAKY_LIVE_MARKETS="sk,cz,de" pnpm build
MAKY_LIVE_MARKETS="sk,cz,de" node_modules/.bin/next start -p 3465
curl -s localhost:3465/de/kontakt | grep -oiP 'hreflang="[^"]+"'   # -i matters
```

Local test runs are not GitHub CI. No production SHA or BUILD_ID is claimed here.
