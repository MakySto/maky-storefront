# STOP report — before the resource-existence gate is armed in production

**Branch** `fix/seo-hard-404-v1` @ `cf9f515` · **base** `a5e5ff3` (= production) · **not deployed**

Written after the acceptance run, from its output. Every number below was measured on a
production build (`next build` + `next start`), not inferred from unit tests. Where something
was not measured, it says so.

---

## 1. Commits

Thirteen on top of `a5e5ff3`, `38 files changed, 4483 insertions(+), 286 deletions(-)`.

| SHA       | Release | What                                                                 |
| --------- | ------- | -------------------------------------------------------------------- |
| `3aa7a2b` | —       | analysis of the soft-404 architecture                                |
| `5e85cff` | **A**   | matcher no longer skips every dotted path                            |
| `cd301c5` | **B**   | separate "market we route" from "market Google may index"            |
| `eb8d031` | **B**   | preview noindex moved from metadata to the proxy                     |
| `ae37b2e` | —       | correct the ground truth, and the minimal-vs-full query claim        |
| `93edb14` | **B**   | preview is direct-access only; the live set is durable               |
| `54c98ea` | **C**   | tell an absent resource apart from an upstream that could not answer |
| `2b408c7` | **D**   | route classifier, market-scoped routes, localized 404                |
| `f9dc237` | **D**   | resource-existence gate — ships off                                  |
| `c6288d3` | **D**   | the proxy fails open on its own exceptions + 61-case armed suite     |
| `7fba44c` | **B**   | the market switcher offered eleven storefronts we do not sell from   |
| `8fa599d` | —       | deploy gates: a check that passes when its tool is missing           |
| `cf9f515` | —       | correct the record on the reported URIError 500                      |

## 2. Independent diff summary

Read from `git diff a5e5ff3..cf9f515`, not from the commit messages.

- **`src/proxy.ts`** — matcher widened to `/((?!api/|_next/).*)`; static assets recognised from a
  generated list instead; market-scoped 404s from route policy; the gate call site; the rewrite
  extracted to `marketRewrite`; the whole function wrapped in try/catch with a fail-open fallback.
- **`src/lib/route-existence.ts`** (new, 350 lines) — the gate: four minimal queries, one bare
  `fetch`, 400 ms timeout, no retry, bounded LRU with 300 s/60 s TTLs, single-flight, concurrency
  cap, circuit breaker, and the migrated-slug fallback ahead of the verdict.
- **`src/lib/saleor/resource-outcome.ts`** (new) — the `found | not-found | upstream-error` union,
  wired into five catalogue pages, the sitemap and search.
- **`src/lib/market-state.ts`** (new) — live/preview split, `MAKY_LIVE_MARKETS`, default `["sk"]`.
- **`src/lib/route-policy.ts` + `src/lib/routing.generated.ts`** (new) — the route registry, generated
  from `src/app/` by `scripts/generate-routing-constants.mjs`, with a drift test.
- **`src/app/sitemap.ts`** — live markets only; throws rather than serving a short list.
- **`src/ui/components/header/`** — the switcher takes the live set as a prop from a `connection()`
  boundary; `channel-select.tsx` deleted (dead, carried a second unfiltered list).
- **`scripts/ops/deploy-production.sh`** — the routing gate, plus the four silent-pass fixes.
- **Tests** — 768 across 45 files, up from 707. New: `proxy.gate.test.ts` (61), `route-existence`
  (23), `market-state` (19), `route-policy`, `routing-generated`, `resource-outcome`.

## 3. Final request lifecycle

Order matters; each step returns and the later ones never run.

```
matcher /((?!api/|_next/).*)        api and _next never reach the proxy
  └─ try {
       PUBLIC_ASSET_PATHS / METADATA_ROUTE_PATHS   → next()          13 files + 7 routes, generated
       pathname === "/"                            → 307 to a LIVE market only
       first segment is a Saleor slug              → 301 to the friendly slug
       /{market}/products/{slug}                   → 308 to /{market}/{slug}
       route exists but not in this market         → 404  (route policy, no upstream call)
       ── gate, only if ROUTE_EXISTENCE_GATE=on and the market AND family are armed ──
         classifyRoute → null                      → unclassified, falls through
         verdict absent                            → 404 + x-robots-tag: noindex
         verdict exists | unknown                  → falls through
       first segment is a known market             → rewrite to the Saleor channel
                                                     + x-channel/-locale/-market/-currency
                                                     + x-robots-tag on a PREVIEW market
                                                     + sticky cookie on a LIVE market only
       any other first segment                     → 404
     } catch → log [proxy] fail-open, then the same market rewrite (never next())
```

## 4. Acceptance matrix

Build `qiAR3Og0H5IYsp63vzVAE`, `next start` on port 3040, in the worktree. Production `.next`
(`JdV9eVV4t2laAlpGhyofM`, 1 Aug) verified unchanged before and after; PM2 uptime unbroken,
`restarts=1` throughout; `https://maky.store/sk` 200 throughout.

### Gate OFF — the configuration that would actually deploy · **49/49 pass**

| Group                                                                                                                                            | Result                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `/admin.php` `/wp-login.php` `/index.php` `/does.not.exist` `/does.not.exist/categories/foo` `/wp-sitemap.xml` `/wishlist` `/neexistujuci-kanal` | **404** (production serves 200 for all of these today)   |
| `/robots.txt` `/sitemap.xml` `/icon.png` `/apple-icon.png` `/opengraph-image.png` `/twitter-image.png` `/favicon.ico`                            | 200                                                      |
| all 13 files under `public/`                                                                                                                     | 200                                                      |
| `/sk` `/sk/products` `/sk/categories/stresne-boxy` `/sk/poradna` `/sk/kontakt` `/sk/o-nas` + 3 legal pages, `/checkout`                          | 200                                                      |
| `/de/kontakt` `/cz/kontakt` `/fr/obchodne-podmienky` `/de/o-nas` `/pl/odstupenie-od-zmluvy`                                                      | **404** (200 with an indexable Slovak `<head>` today)    |
| `/de` `/cz` direct                                                                                                                               | 200 + `x-robots-tag: noindex, nofollow`                  |
| `/sk`, `/logo.svg`, `/checkout`                                                                                                                  | **no** `x-robots-tag` — the preview header does not leak |
| `/sk/products/639901-…` → 308 · `/sk-eur` → 301                                                                                                  | as specified                                             |
| RSC `/sk`, `/sk/products`                                                                                                                        | 200                                                      |

### Gate ARMED — `markets=sk families=product,collection,category,saleor-page`

| Check                                                                   | Result                                   |
| ----------------------------------------------------------------------- | ---------------------------------------- |
| absent product / category / collection                                  | **404**, `x-maky-gate: <family>:absent`  |
| real product, real category                                             | 200, `<family>:exists`                   |
| **all 481 sitemap URLs**                                                | **481 × 200. Zero false positives.**     |
| all 9 static market segments + `/sk`                                    | 200, `unclassified` — never asked Saleor |
| all 10 migrated products: `/sk/products/<old>` → 308, `/sk/<new>` → 200 | **10/10**                                |
| market not armed (`/cz/...`)                                            | 200, `product:not-armed`, no lookup      |

### Upstream fault — the safety property

Testing this needed its own build (`8KugmAIz6oZNq0kxTAnZB`): **`NEXT_PUBLIC_SALEOR_API_URL` is
inlined at build time**, so overriding it at runtime does nothing. The first attempt did exactly
that and produced 404s that looked like fail-open had failed — they were correct answers from the
real Saleor about products that genuinely do not exist. Recorded because the same mistake will
look conclusive to the next person.

With the endpoint built to point at a black hole:

```
8 × /sk/<missing>          200  gate=product:unknown      never 404
    /sk/categories/<x>     200  gate=category:unknown
    /sk/collections/<x>    200  gate=collection:unknown
    breaker open for 30000ms after 5 faults
```

**A Saleor outage cannot produce false 404s.** Measured, not argued.

### Market isolation

Gate armed for `sk` **and** `de`, one product live in `sk-eur` only:

```
/sk/stresny-box-thule-force-3-xxl-sport-645300   200  product:exists
/de/stresny-box-thule-force-3-xxl-sport-645300   404  product:absent     ← channel-scoped
/cz/stresny-box-thule-force-3-xxl-sport-645300   200  product:not-armed
```

### Runtime market promotion, no rebuild

Same build `qiAR3Og0H5IYsp63vzVAE`, restart with `MAKY_LIVE_MARKETS="sk,cz"`:

|                              | `sk`                      | `sk,cz`                              |
| ---------------------------- | ------------------------- | ------------------------------------ |
| boot line                    | `live=sk preview=cz,de,…` | `live=sk,cz preview=de,…`            |
| sitemap                      | 481 URLs                  | **483**, `/cz` present, `/de` absent |
| `/cz` `x-robots-tag`         | `noindex, nofollow`       | **none**                             |
| switcher prop in the payload | `markets:["sk"]`          | **`markets:["sk","cz"]`**            |

### Cold / warm performance

|                              | cold (LRU miss) | warm       |
| ---------------------------- | --------------- | ---------- |
| absent → 404                 | 30–33 ms        | 1.4–1.6 ms |
| existing product (full page) | 205 ms          | —          |

The gate adds ~30 ms on a cold miss and ~1.5 ms warm, against a 400 ms timeout ceiling.

## 5. Future-product test — NOT PERFORMED

Publishing a product in Saleor and watching a 404 become a 200 after the 60 s negative TTL needs a
write to the production catalogue, which is out of scope for this branch. The mechanism is in place
and unit-tested (`route-existence.test.ts`), and the negative TTL is 60 s by construction — but the
end-to-end path is **unverified**. It should be run once, deliberately, before `family=product` is
armed on `sk`.

## 6. Clean branch / origin proof

```
$ git ls-remote origin refs/heads/fix/seo-hard-404-v1
cf9f515be6b761409437f229aa050bfe22c8570c
$ git rev-parse HEAD
cf9f515be6b761409437f229aa050bfe22c8570c
$ git status --porcelain
(empty)
```

`tsc --noEmit` 0 errors · `pnpm lint` 0 errors, 6 pre-existing warnings · **768/768 tests, 45 files**.

## 7. Rollback

The gate is a runtime flag, so the first rollback needs no deploy at all:

```bash
# remove ROUTE_EXISTENCE_GATE from /opt/storefront/.env, then
pm2 restart maky-storefront --update-env
```

Artifact rollback, if the deploy itself is bad — CLAUDE.md §13.3:

```bash
ls /opt/storefront-rollbacks/
cat /opt/storefront-rollbacks/<pick>/MAKY_DEPLOY_META
pm2 stop maky-storefront
cd /opt/storefront && rm -rf .next
sudo cp -a /opt/storefront-rollbacks/<pick> .next
sudo chown -R ubuntu:ubuntu .next
git checkout <git_sha from MAKY_DEPLOY_META>
pm2 start maky-storefront
```

## 8. What still stands between here and arming the gate

1. **No monitoring, no alerting, no baseline.** The stated hard prerequisite. Nothing on this branch
   provides it. `x-maky-gate` is on every gated response and the boot line reports the armed set, so
   the raw material exists — the 404-rate baseline per market and the alarm do not.
2. **The future-product path is unverified** (§5).
3. **`ROUTE_EXISTENCE_*` are absent from `.env.example`.** Documented only in code comments.

## 9. Defects found during acceptance, NOT fixed here

- **A publicly reachable 500 on production today.** `https://maky.store/sk/%25E0%25A4%25A` (double
  percent-encoded) answers **500**. It comes from Next's own app-page handler — `failed to decode
param` while decoding `[productSlug]` — not from our code, and it is not reachable from the proxy.
  Present on `a5e5ff3`, i.e. live right now, and **this branch does not fix it with the gate off**.
  Arming the gate happens to turn it into a 404. Separate task.
- **The homepage featured section and the site-wide navigation still cache a Saleor fault as empty
  content** (`nav-links.tsx`, `(main)/page.tsx`), the navigation on an _hours_ cache profile. One
  blip strips every internal category link from every page for hours. Same root cause as this
  branch's data-semantics work, not converted. Separate task, immediately after Release A.
- **`SearchResult.unavailable` is set but never read** — an outage still shows the visitor
  "no results". Half-landed.
- **en-CA is missing 211 of 437 message keys**, re-verified on this tip. Harmless while `ca` is
  preview; a blocker before it goes live.
