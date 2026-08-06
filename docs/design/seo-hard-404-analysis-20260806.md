# True HTTP 404 — analysis and recommended architecture

**Date:** 2026-08-06 · **Author:** Claude (read-only analysis + off-production proof-of-concept)

> **Implementation status — read this before trusting anything downstream.**
>
> |                                          | state                                                |
> | ---------------------------------------- | ---------------------------------------------------- |
> | dotted-path matcher fix (§F.3)           | **DONE**                                             |
> | market state, `live` / `preview`         | **DONE**                                             |
> | sitemap follows live markets, fails loud | **DONE**                                             |
> | empty-category `noindex` (§F.4)          | **DONE**                                             |
> | data semantics, §F.0                     | **DONE**                                             |
> | route classifier (§F.1 step 8–9)         | **DONE**                                             |
> | localized market-aware 404               | **DONE** (in-app `notFound()`; see the caveat below) |
> | hard-404 gate (§F.2)                     | **BUILT, SHIPS OFF**                                 |
>
> With the gate armed on a production build, `/sk/neexistujuci-produkt` returns a
> real **HTTP 404** — as do a missing category, collection and Saleor page,
> identically for GET and HEAD and for Chrome, Googlebot and bingbot. It stays
> inert until `ROUTE_EXISTENCE_GATE=on` plus an explicit market and family list.
>
> **A third instance of the same constraint, found by running it.** The gate first
> rewrote to a market-aware 404 page under `[channel]`. The verdict header said
> `x-maky-gate: product:absent`, the rewrite carried `status: 404`, and the
> response came back **HTTP 200** — because that route is partially prerendered
> (`◐`) and a PPR route takes its status from its own prerender entry
> (`app-page.js:1112`), overriding the rewrite. The target has to be a fully
> static route, so it is `/_not-found`. The cost is the body: a gate 404 renders
> the English global page, while an in-app `notFound()` still gets the localized
> market one. Recovering it needs a fully static per-market 404 — a follow-up, and
> the status is the part a crawler acts on.
>
> **Correction, 2026-08-06.** An earlier revision of §F.2 specified a loopback to
> an internal Route Handler sharing the page's full `"use cache"` resolver, and
> quoted the _minimal_ query's latency alongside a "zero extra upstream requests"
> claim that belongs to the _full_ one. Those are two different designs and the
> numbers are not interchangeable. §F.2 now specifies the minimal direct query,
> and §E.2's measurement is labelled with the design it actually measured.

---

## A. Ground truth

|                                               |                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Production checkout                           | `/opt/storefront`, branch `feat/cms-m2`, HEAD `a5e5ff3be706f3b240ea1cfcbc8a41d2385ea3f3`, **clean**           |
| `git ls-remote origin refs/heads/feat/cms-m2` | `a5e5ff3be706f3b240ea1cfcbc8a41d2385ea3f3` — **matches**, base is confirmed                                   |
| Live artifact                                 | `.next/MAKY_DEPLOY_META`: `build_id=JdV9eVV4t2laAlpGhyofM`, built 2026-08-01T14:34:18Z from `a5e5ff3`         |
| Next.js                                       | **16.2.9** (Turbopack) — _not_ 16.1.2                                                                         |
| React / next-intl / node / pnpm               | 19.2.7 / 4.13.0 / v24.15.0 / 10.28.1                                                                          |
| `cacheComponents`                             | `true`, `next.config.js:13` — global, no per-route override exists                                            |
| Process model                                 | PM2 **fork mode, 1 instance** (`maky-storefront`), plus the separate `maky-smtp-app`                          |
| Analysis worktree                             | `/opt/storefront/.claude/worktrees/maky-store-indexing-404-70ae01` @ `a5e5ff3`                                |
| Production during this analysis               | **untouched** — `.next` mtime still Aug 1 14:34, PM2 restarts unchanged, `127.0.0.1:3000/sk` → 200 throughout |

The proof-of-concept was built and served in the analysis worktree on port **3040**. Nothing was built,
restarted or written in `/opt/storefront`.

### A.1 The confirmed mechanism

`src/app/[channel]/(main)/layout.tsx:140` is `<Suspense fallback={null}>{props.children}</Suspense>`.
Every `/{market}/**` route renders inside it. With `cacheComponents: true` the prerendered shell flushes at
that boundary, so the status line is committed as **200** before any page component's data fetch resolves.
Every `notFound()` below it swaps the body, not the status.

There are **20 `notFound()` call sites**, all below that boundary, none able to set a status:

```
[productSlug]/page.tsx:145 · categories/[slug]/page.tsx:101,152 · collections/[slug]/page.tsx:90,144
pages/[slug]/page.tsx:49 · products/page.tsx:97 · search/page.tsx:56,63
account/orders/[number]/page.tsx:37 · cookies:14 · doprava-a-platba:15 · kontakt:16
obchodne-podmienky:16 · ochrana-osobnych-udajov:15 · odstupenie-od-zmluvy:14
reklamacie-a-vratenie:15 · lib/cms/page-route.tsx:121,130,140
```

The per-page `<Suspense>` boundaries are **redundant to the problem** — the layout boundary alone is
sufficient. `/{market}/pages/{slug}` proves it: that route has no local Suspense at all and still soft-404s.

Two files already state this in prose: `src/proxy.ts:136-139` and `src/lib/cms/page-route.tsx:73-76`.

---

## B. Current request lifecycle

### `/sk/<valid-product>` → 200 (correct)

```
nginx :443 ──▶ 127.0.0.1:3000
proxy.ts    matcher admits the path (no dot, not api/_next)
            not "/", not a Saleor slug, not /{market}/products/{slug}
            first="sk" ∈ FRIENDLY_SLUGS  ─▶ NextResponse.rewrite("/sk-eur/<slug>")
                                            + x-channel / x-locale / x-market / x-currency, cookie
App Router  [channel]/layout.tsx        awaits params + getMessages()   ← no Suspense above, prerenderable
            (main)/layout.tsx           ▼ <Suspense fallback={null}>{children}</Suspense>
            ══════════ SHELL FLUSHED — HTTP 200 COMMITTED (measured TTFB 2.5 ms) ══════════
            [productSlug]/page.tsx      <Suspense fallback={ProductPageSkeleton}>
              ProductContent            await getProductData(slug, channel)   ["use cache", tag product:<slug>]
                                        product found → render                (measured total 206 ms)
```

### `/sk/<missing-product>` → 200 + noindex (the defect)

Identical to the above **through the flush**. Then `getProductData` returns `null`,
`ProductContent` calls `notFound()` at `:145` — but the status is already sent. `generateMetadata:78`
emits `robots: noindex, nofollow` because that is the only crawler-visible signal left. The code says so
at `:79-80`.

### `/sk/categories/<valid>` → 200 · `/sk/categories/<missing>` → 200 + noindex

Same shape, `getCategoryData` at `categories/[slug]/page.tsx:30`, `notFound()` at `:101`.
A **second** `notFound()` at `:152` fires inside a _nested_ Suspense, after `CategoryHero` has already
streamed — so an upstream failure paints 404 content underneath a hero that just proved the category exists.

---

## C. Route inventory

42 route entries were walked. Condensed to what matters for the patch:

| Route pattern                                                   | Authority                         | Channel-scoped?         | `notFound()`               | Status on missing today                                        | Desired                  | In patch        |
| --------------------------------------------------------------- | --------------------------------- | ----------------------- | -------------------------- | -------------------------------------------------------------- | ------------------------ | --------------- |
| `/{market}/{productSlug}`                                       | Saleor `product(slug,channel)`    | **yes**                 | page.tsx:145               | 200 + noindex                                                  | **404**                  | ✅              |
| `/{market}/categories/{slug}`                                   | Saleor `category(slug)`           | **NO — global**         | :101, :152                 | 200 + noindex                                                  | **404** (see F.4)        | ✅              |
| `/{market}/collections/{slug}`                                  | Saleor `collection(slug,channel)` | **yes**                 | :90, :144                  | 200 + noindex                                                  | **404**                  | ✅              |
| `/{market}/pages/{slug}`                                        | Saleor `page(slug)`               | **NO — global**         | :49                        | 200 + noindex                                                  | **404**                  | ✅              |
| `/{market}/o-nas`, `/{market}/poradna`                          | Payload CMS                       | market+locale scoped ✅ | page-route.tsx:121,130,140 | 200 + noindex                                                  | **404**                  | ✅ (phase 2)    |
| `/{market}/products`                                            | Saleor                            | n/a — always exists     | :97 (on API failure!)      | 200                                                            | **200 / 5xx**, never 404 | ✅ (bug fix)    |
| `/{market}/search`                                              | Saleor                            | n/a                     | :56, :63                   | 200, _two contradictory robots tags_                           | 200 + noindex            | ✅ (bug fix)    |
| `/{market}` homepage                                            | Saleor                            | n/a                     | **none**                   | 200 + `index,follow` + self-canonical for _any_ channel string | 404 for unknown          | ✅              |
| `/{market}/products/{slug}`                                     | —                                 | —                       | none                       | 308 → `/{market}/{slug}`                                       | unchanged                | ⛔ preserve     |
| `/{market}/account/**`, `/cart`, `/login`, `/signup`, `/orders` | Saleor                            | —                       | orders/[number]:37         | 200                                                            | private, `noindex`       | ⛔ out of scope |
| `/{market}/kontakt` + 6 sibling legal pages                     | static                            | sk-only                 | :14–16                     | 200 for non-sk, **indexable Slovak `<head>` over a 404 body**  | see open question 2      | ⚠️              |
| `/checkout`, `/checkout/complete`                               | Saleor                            | —                       | none                       | 200 graceful views                                             | unchanged                | ⛔              |
| `/api/**`                                                       | —                                 | —                       | none                       | real statuses (Route Handlers **can** set them)                | unchanged                | ⛔              |
| **`/{anything.with.a.dot}/**`\*\*                               | —                                 | —                       | **none — proxy bypassed**  | **200 + `index, follow` + self-canonical**                     | **404**                  | ✅ **P0**       |

---

## D. Data-semantics audit

### D.1 The union already exists — and is destroyed one line later

`src/lib/graphql.ts:33-46` defines a proper discriminated result:

```ts
type GraphQLResult<T> = { ok: true; data: T } | { ok: false; error: GraphQLError };
// GraphQLError.type: "network" | "http" | "graphql" | "validation", + statusCode, isRetryable
```

Every executor honours it. Then every caller throws the discrimination away:

```ts
// [productSlug]/page.tsx:43-48
if (!result.ok) { console.error(...); return null; }   // ← network | http | graphql | authoritative-null
return result.data.product;                            //   all collapse to the same null
```

Confirmed conflation sites (13): `[productSlug]:48`, `categories:30` and `:150`, `collections:29` and `:142`,
`pages/[slug]:48`, `products:96`, `search/saleor-provider:50`, `sitemap:57` and `:87`,
`filter-utils.server:31`, `checkout/lib/server/fetch-order:35`.

Three of them are the **inverse** defect — `!result.ok → notFound()` — i.e. a Saleor outage renders "not found"
over a resource that exists: `categories:152`, `collections:144`, `products:97`.

### D.2 The poisoning defect — this is the real blocker

`getProductData` (`[productSlug]/page.tsx:51-66`) is `"use cache"` with
`applyCacheProfile(CACHE_PROFILES.products, slug)` → `cacheLife("minutes")` + `cacheTag("product:<slug>")`.
Next's built-in `minutes` profile (`node_modules/next/dist/server/config-shared.js:147-151`) is
`{ stale: 300, revalidate: 60, expire: 3600 }`.

So **an upstream fault is laundered into `null`, and that `null` is written into the cache.** A 30-second
Saleor blip pins "this product does not exist" for a _real_ product: 60 s until revalidation, up to 300 s
served stale, hard expiry 3600 s. The entry is tagged on a slug the webhook will never be told about, so
eviction is purely time-based. Same for `getCategoryData` and `getCollectionData`.

**Today that is invisible** — it surfaces as a soft 404, and `noindex` on a real product for an hour is bad
but recoverable. **The moment a hard 404 is wired to the same signal, a Saleor blip becomes hours of real
404s across the catalogue.** Fixing the semantics is therefore not tidy-up; it is a prerequisite.

### D.3 Two unguarded throw paths

- `graphql.ts:339` — `await response.json()` is **not** inside any try/catch in `executeGraphQL`. A 2xx whose
  body is not JSON (an nginx/Cloudflare HTML error page, a truncated body) raises `SyntaxError` that
  propagates through every caller to `src/app/error.tsx` — after the shell flushed, i.e. HTTP 200 with an
  error body. `executeRawGraphQL:434/442` already handles exactly this. The two executors have divergent
  contracts for the same failure.
- `graphql.ts:345` — `{"data": null}` with no `errors` key returns `{ok: true, data: null}`; callers then do
  `result.data.product` → `TypeError`.

### D.4 The template already in the tree

`src/lib/cms/page-route.tsx` + `src/lib/cms/client.ts:27-35` do this correctly:

```ts
type CmsPageOutcome =
	| { status: "found"; page: CmsPage }
	| { status: "not-found" }
	| { status: "market-mismatch"; documentId: string; markets: readonly string[] }
	| { status: "error"; reason: string };
```

with the rule stated in prose at `page-route.tsx:24-38`: **an upstream fault renders the bootstrap; only an
authoritative absence may 404.** It also builds `generateMetadata` and `Page` from one config so they cannot
disagree. That is the pattern to port to Saleor.

### D.5 Channel scoping — verified from the actual `.graphql` documents

| Resource         | Document                                                                             | Channel-scoped  |
| ---------------- | ------------------------------------------------------------------------------------ | --------------- |
| product          | `ProductDetails.graphql:1-2` `product(slug:$slug, channel:$channel)`                 | **yes**         |
| collection       | `ProductListByCollection.graphql:9` `collection(slug:$slug, channel:$channel)`       | **yes**         |
| **category**     | `ProductListByCategory.graphql:9` `category(slug: $slug)`                            | **NO — global** |
| Saleor page      | `PageGetBySlug.graphql:1-2` `page(slug:$slug)`                                       | **NO — global** |
| Payload CMS page | `cms/client.ts:119-129` slug + `_status=published` + locale + `fallback-locale=none` | yes ✅          |

Consequences for categories, all live today: `/cz/categories/stresne-boxy`, `/de/...` etc. all resolve the
Slovak category and render 200 with a hero. A category that exists but is empty in this channel yields an
empty `edges[]`, not a null — so it renders an empty PLP at 200 **with a self-canonical**
(`categories/[slug]/page.tsx:70-75`). `SitemapCategories.graphql:5-11` is the only place in the repo that
asks the two-part question correctly (`categories { products(channel:$channel) { totalCount } }`), and the
sitemap filters empties out — but the routes still serve them from every market prefix.

---

## E. Architecture options — decided empirically, not by argument

All of the following were **built and served** in the analysis worktree (`next build` + `next start`,
port 3040), not reasoned about.

### E.1 Option A — pre-stream lookup in the page/layout architecture: **REFUTED, structurally**

Three build-time facts, each a hard stop:

**A-1.** A route that awaits dynamic `params` with **no Suspense boundary above it** does not compile:

```
Error: Route "/[channel]/zprobe-b/[slug]": Uncached data was accessed outside of <Suspense>.
       https://nextjs.org/docs/messages/blocking-route
Export encountered an error on /[channel]/zprobe-b/[slug]/page, exiting the build.
```

**A-2.** `export const dynamic = "force-dynamic"`:

```
Route segment config "dynamic" is not compatible with `nextConfig.cacheComponents`. Please remove it.
```

**A-3.** `export const dynamicParams = false`:

```
Route segment config "dynamicParams" is not compatible with `nextConfig.cacheComponents`. Please remove it.
```

**A-4.** And PPR itself cannot be switched off for one route family. Verified at source in the installed
package, three independent ways:

- `config.js:1076-1078` — `cacheComponents: true` **forces** `experimental.ppr = true`.
- `config.js:371-372` — setting `experimental.ppr` yourself throws `HardDeprecatedConfigError`.
- `app-segment-config.js:80-121` — the complete segment-config key list contains no `experimental_ppr`, and
  `ppr.js:39-46 checkIsRoutePPREnabled` reads only the app-level config.

So the "disable PPR for the dynamic route families" half of Option A is not implementable as written.

Taken together: **under `cacheComponents`, for a dynamic-segment route with no build-time params, a Suspense
boundary between the flushed shell and the lookup is compulsory — the compiler enforces it.**
`cacheComponents` is a single global flag, and turning it off is not an option either: `"use cache"`
_requires_ it, so disabling it would invalidate every cached resolver in the codebase.

**Correction to an earlier draft of this document.** It claimed there is _no_ per-route escape hatch from
A-1. That was too strong. `node_modules/next/dist/server/app-render/instant-validation/instant-config.js:60-74`
— `export const unstable_instant = false` makes `isPageAllowedToBlock` return true, which sets
`allowEmptyStaticShell` (`app-render.js:3377`) and skips `throwIfDisallowedDynamic` entirely
(`app-render.js:3877-3881`). It does **not** rescue Option A: with an empty prelude the route still receives
a postponed state (`app-render.js:3900-3903`, `DynamicHTMLPreludeState.Empty`), and `didPostpone`
(`app-page.js:943`) keys only on that state _existing_ — so the same non-awaited resume with the
pre-committed status runs anyway. Untested here, and it does not change the conclusion.

**Why the resume can never set the status** (`node_modules/next/dist/build/templates/app-page.js`):

```js
:1112  if (cachedData.status && (…)) { res.statusCode = cachedData.status; }   // 200, from the BUILD-TIME entry
:1249  const transformer = new TransformStream(); body.push(transformer.readable);
:1253  // "We don't await because we want the result to start streaming now"
       doRender({ postponed: cachedData.postponed, … }).then(…)               // ← never awaited
:1289  return sendRenderResult({ req, res, result: body, … })
```

The status comes from the prerender entry and the resumed render is explicitly not awaited. The only sites
that ever set a 404 (`app-render.js:1975-1978`, `:4288-4291`) sit in a catch that requires the render promise
to reject _before_ the response is committed — which a non-awaited resume cannot do. Measured on production:
`/sk/does-not-exist` returns `x-nextjs-prerender: 1` + `x-nextjs-postponed: 1`, i.e. it is served by exactly
that resume path.

**And the official documentation prescribes the remedy by name.**
<https://nextjs.org/docs/app/api-reference/functions/not-found>, section _"Calling notFound() after streaming
has started"_:

> "The trade-off is the HTTP status code. Because the check runs inside the `<Suspense>` boundary, the
> response has already begun streaming as a `200`, and the status can't change once streaming has started.
> The `noindex` tag keeps a soft 404 out of search results. To return a real `404` status, the resource has
> to be checked before the response streams. **With Cache Components, every dynamic route streams a static
> shell first, so run that check in `proxy` instead.**"

<https://nextjs.org/docs/app/api-reference/file-conventions/loading>, _"Status Codes"_, says the same and
also names `proxy`. This is not a workaround; it is the documented architecture for this exact
configuration.

And the runtime measurements agree:

| Probe              | What it removes                                          | `/sk/<missing>`                         |
| ------------------ | -------------------------------------------------------- | --------------------------------------- |
| baseline           | nothing                                                  | **200**                                 |
| **A** — `zprobe-a` | page-level `<Suspense>` removed, layout boundary remains | **200**                                 |
| **C** — `zprobe-c` | `notFound()` inside `generateMetadata()`                 | **200** (browser) / **200** (Googlebot) |

The `generateMetadata` idea deserves its own line, because the cloaking worry attached to it rests on a
false premise. **Googlebot is not an `htmlLimitedBot`.** Executed against the installed
`node_modules/next/dist/shared/lib/router/utils/html-bots.js:15`, the regex matches
`AdsBot-Google`, `Google-InspectionTool`, `bingbot` — but "Googlebot/2.1" matches neither `[\w-]+-Google`
nor `Google-[\w-]+`:

| UA                                              | `botType` | htmlLimited | streams metadata |
| ----------------------------------------------- | --------- | ----------- | ---------------- |
| Chrome                                          | undefined | false       | yes              |
| **Googlebot** (desktop + smartphone)            | `dom`     | **false**   | **yes**          |
| AdsBot-Google · Google-InspectionTool · bingbot | `html`    | true        | no               |

So even the mechanism the objection invokes would apply to Bing and AdsBot and _not_ to Googlebot — the
inverse of the concern. Measured on production, `/sk/does-not-exist-abc123` returns **200 for all of**
Chrome, Googlebot, bingbot, AdsBot-Google and curl. `bingbot` and `AdsBot-Google` are the maximally blocking
configuration available (`serveStreamingMetadata=false` **and** `supportsDynamicResponse=false`, i.e. no
streaming metadata and fully buffered HTML) and they still return 200. **Blocking metadata does not buy a 404.** Invariant #22 is satisfied — not because the mechanism is UA-independent, but because it is inert
for every UA.

There _is_ real UA-dependent behaviour today, and it is worth knowing about: `supportsDynamicResponse:
!botType` (`base-server.js:1040`) means every bot gets a fully buffered render while browsers get the PPR
resume — visible as `x-nextjs-postponed: 1` present for Chrome and absent for Googlebot. Same status either
way, so it is not a cloaking problem, but it is why bot and browser timings differ.

### E.2 Option B — existence gate in `src/proxy.ts`: **WORKS, measured**

A proof-of-concept gate was added to `proxy.ts`, scoped to a probe path, with a process-local LRU
(positive TTL 300 s, negative 60 s) and a loopback to an internal Route Handler.

| Case                               | Status  | TTFB       | Notes                                                  |
| ---------------------------------- | ------- | ---------- | ------------------------------------------------------ |
| `/sk/zprobe-h/<valid>` cold        | 200     | 8.1 ms     | gate + render                                          |
| `/sk/zprobe-h/<valid>` warm        | 200     | 1.9–2.2 ms | LRU hit, `x-probe-source: lru`                         |
| `/sk/zprobe-h/<missing>` cold      | **404** | 6.2 ms     |                                                        |
| `/sk/zprobe-h/<missing>` warm      | **404** | 1.1–1.3 ms |                                                        |
| `/sk/zprobe-h/<missing>` Googlebot | **404** | —          | identical to browser                                   |
| `HEAD` (via `curl -I`)             | **404** | —          | GET/HEAD parity confirmed on every probe               |
| `?utm=x`                           | **404** | —          | query params ignored correctly                         |
| trailing slash                     | 308     | —          | Next's own redirect fires **before** the proxy         |
| **`/fr/zprobe-h/<sk-product>`**    | **404** | —          | **market isolation works** — same slug is 200 on `/sk` |

Regression set, all unchanged: `/wishlist/...` 404 · `/sk` 200 · `/sk/categories/stresne-boxy` 200 ·
`/sk/poradna` 200 · `/sk/kontakt` 200 · `/sk/products/<slug>` 308.

Two mechanisms were confirmed that the option depends on:

- **Module state survives across requests.** After 9 requests the gate reported
  `x-probe-lookups: 3`, `x-probe-cache-size: 3` — one lookup per distinct `(channel, slug)`. PM2 fork mode
  with a single instance means one coherent cache; there is no multi-process problem to solve.
- **The gate and the render can share one `use cache` entry.** The server log shows exactly **3**
  `[zprobe] UPSTREAM` lines for 3 distinct keys, although both the loopback handler _and_ the page render
  called the resolver for each — so a cold gate costs zero extra upstream requests in that design.

  ⚠️ **Scope of this measurement.** The probe called a _shared full_ resolver through a loopback Route
  Handler. It proves the mechanism exists; it does **not** license the "zero extra requests" claim for the
  minimal-query design in §F.2, which necessarily issues its own small request. The two numbers quoted in
  §F.6 (~27 ms) belong to the minimal query, not to this probe. v1 ships the minimal query and accepts one
  extra request per cold key; the shared-resolver variant needs its own PoC on the real full product
  document before it is considered again.

### E.3 Option C — dynamically refreshed route manifest: **REJECTED**

Its Next-native form does not compile (E.1 A-3). But the decisive argument is sharper than "it might go
stale", and it is specific to this codebase:

**The manifest's source is not the same authority as the render.** A manifest would be built from
`SitemapProducts.graphql:5` — `products(channel: $channel, …)`, a _connection_, filtered by channel listing
visibility. The PDP resolves from `ProductDetails.graphql:2` — `product(slug:, channel:)`, a single-object
lookup, which is **not** so filtered. A product that is published but not visible in listings renders a real
200 PDP today and would be **absent from the manifest → a hard 404 on a live, buyable product.** (Saleor's
exact `visibleInListings` semantics were not probed — writes and authenticated queries were out of scope —
but the two documents differ, and that asymmetry alone means a manifest measures _listability_, not
existence.)

Two more, both grounded in the repo:

- **Categories would be actively wrong.** `sitemap.ts:90` filters to `totalCount > 0`, and
  `SitemapCategories.graphql:1-3` records that _"Twelve of the thirty categories on this catalogue currently
  hold no products, including four that sit in the main navigation."_ A manifest from that source hard-404s
  four categories the header links from **every page**.
- **Silent partial builds.** `sitemap.ts:60-80` `break`s out of pagination when a page returns null, and
  `:57` collapses every error to null. One Saleor blip on page 3 of 5 yields a short list indistinguishable
  from a complete one — ~200 real products silently missing, i.e. ~200 hard 404s, with no error anywhere.

Its failure mode is therefore a **stale false 404 on a real product** — unrecoverable in the index in a way
a soft-404 is not. Retained in one narrow role: **as a warming input, never as the authority.** A _positive_
manifest entry may short-circuit to "pass through" — worst case a soft 404, i.e. today's behaviour. A
_negative_ verdict must always come from a live authoritative answer at the moment of the request.

_(Counter-argument considered and rejected: at 458 products and 18 categories, a periodically refreshed slug
**set** would give a 100 % hit rate with no cold-TTFB penalty. True — but only if the set is authoritative,
and the `visibleInListings` asymmetry above is exactly why it is not. Small corpus does not rescue a wrong
authority.)_

### E.4 Option D — hybrid, and everything else considered

- **Route Handler owning the status** — Route Handlers _can_ set statuses (`/api/auth/*` already return
  400/401), but they cannot own an HTML page route. Used here as the gate's _backend_, which is the good half.
- **`generateStaticParams` + `dynamicParams=false`** — does not compile, and would fail the
  no-rebuild requirement anyway.
- **nginx-level handling** — `nginx -V` confirms `--with-http_auth_request_module`, so an `auth_request`
  subrequest _is_ technically available. It is strictly worse: nginx still cannot know whether a slug exists,
  so the subrequest lands in the same Node process anyway — one extra round trip **per page view**, not per
  miss; it duplicates routing knowledge into `/etc/nginx/conf.d/storefront.conf`; it cannot express fail-open
  cleanly (a failed `auth_request` is a 500); and it sits outside the deploy script's rollback story. nginx's
  right job here is the static legacy sweep (`/wp-content/*`, `/*.php` → 410), which is a separate
  micro-task.
- **`revalidateTag`-driven negative cache** — the tag infrastructure already exists
  (`cache-manifest.ts` + `/api/revalidate`), and it is the right _freshness accelerator_ (see G.5), but it
  cannot decide a status.

**The hybrid is the recommendation: Option B's placement, Option D's shared-cache backend, Option C demoted
to an optional warm-up.**

### E.5 Comparison

|                             | A · page-level                                        | B+D · proxy gate w/ shared cache                                   | C · manifest                  |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------- |
| true 404 correctness        | ❌ impossible (build-enforced)                        | ✅ measured, both UAs, GET+HEAD                                    | ✅ if fresh                   |
| future products, no rebuild | n/a                                                   | ✅ 60–120 s, or instant with webhook                               | ❌ depends on refresh owner   |
| all 12 markets              | n/a                                                   | ✅ derived from `CHANNEL_MAP`, verified `/fr` vs `/sk`             | ⚠️ 12× the manifest           |
| upstream outage             | n/a                                                   | ✅ fails open, passes through                                      | ❌ stale false 404            |
| extra upstream requests     | n/a                                                   | **1 per cold key** (minimal query, v1)                             | 0 steady-state                |
| cold TTFB                   | n/a                                                   | +200 ms via current client, **+27 ms** via a lean keep-alive fetch | 0                             |
| warm TTFB                   | n/a                                                   | **+0 ms** (1.9 ms vs 2.5 ms baseline)                              | 0                             |
| cache invalidation          | n/a                                                   | TTL + existing `cacheTag`/webhook                                  | bespoke                       |
| multi-process               | n/a                                                   | ✅ non-issue (fork mode, 1 instance)                               | ❌ needs sync                 |
| implementation complexity   | —                                                     | medium                                                             | high                          |
| operational complexity      | —                                                     | low (env kill switch)                                              | high (a new system, no owner) |
| PPR / LCP risk              | ❌ would require disabling `cacheComponents` globally | low, bounded to cold misses                                        | low                           |
| testability                 | —                                                     | ✅ HTTP-level, no mocks needed                                     | hard                          |
| rollback                    | —                                                     | one env var                                                        | redeploy                      |

---

## F. Recommended architecture

Three layers, in this order. **Layer 0 must land before Layer 1**, for the reason in D.2.

### F.0 — Layer 0: data semantics (no routing change, no §10 approval)

1. Close the two unguarded paths in `graphql.ts` (`:339` JSON parse, `:345` `data: null`), mirroring
   `executeRawGraphQL:434/442`.
2. Add `src/lib/saleor/resource-outcome.ts`:
   ```ts
   export type ResourceOutcome<T> =
   	| { status: "found"; resource: T }
   	| { status: "not-found" }
   	| { status: "upstream-error"; reason: string; retryable: boolean };
   ```
   with `resolveProduct(slug, channel)`, `resolveCategory(slug, channel)`, `resolveCollection(slug, channel)`,
   `resolveSaleorPage(slug)`. Mapping is exhaustive: `ok && data.X` → found · `ok && !data.X` → **not-found
   (the only authoritative arm)** · `!ok` → upstream-error carrying `type`, `statusCode`, `isRetryable`.
3. **Never cache an upstream fault.** Empirically confirmed on this exact Next version: a _rejected_ promise
   inside `"use cache"` is **not** stored, while a resolved value is —

   ```
   3 identical requests →  I-THROW body executed ×3   (never cached)
                           I-OK    body executed ×1   (cached)
   ```

   So the cached resolver **throws** on `upstream-error` and the caller catches outside the cached function.
   No new cache infrastructure is needed; this is a property of the layer already in use.

4. Fix the inverse conflation at `categories:152`, `collections:144`, `products:97` — an upstream failure
   must never call `notFound()`.
5. Give `pages/[slug]` a single shared cached resolver so `generateMetadata` and the body cannot drift
   (it currently issues two independent uncached lookups).

Layer 0 alone changes no status codes. It is a correctness fix that is worth landing on its own.

### F.1 — Layer 1: the status decision, in `proxy.ts`

Decision order (new steps marked ★):

```
1.  nginx: host/protocol canonicalisation                          (already)
2. ★ matcher fix — stop excluding every dotted path                 P0, see F.3
3. ★ legacy redirect registry (exact map, ships EMPTY)              architecture only
4.  root geo redirect + market cookie                              (already)
5.  Saleor channel slug → friendly market 301                      (already)
6.  invalid first segment → 404                                    (already)
7.  /{market}/products/{slug} → 308                                (already)  ← gate must come AFTER
8. ★ static-market-segment allowlist → pass through untouched
9. ★ route classification: product | category | collection | saleor-page | other
10.★ resource existence → 404, or pass
11. friendly market → Saleor channel rewrite                       (already)
```

**Step 8 is load-bearing.** `[productSlug]` sits at the market root, so ~20 real static routes look like
product slugs to the gate — `poradna`, `kontakt`, `obchodne-podmienky`, `odstupenie-od-zmluvy`, `o-nas`,
`cookies`, `doprava-a-platba`, `ochrana-osobnych-udajov`, `reklamacie-a-vratenie`, `cart`, `login`,
`signup`, `orders`, `search`, `products`, `account`, `categories`, `collections`, `pages`. If the gate asks
Saleor about `poradna` and gets `null`, it takes a live legal page off the site. That list **must be
generated from `src/app/` at build time** with a test that fails on drift, never hand-maintained.

**Step 7 before step 10** is equally load-bearing: `previousProductSlug()` (`product-redirects.ts:59`) is
consulted _inside_ `getProductData` as a fallback. The gate must replicate that fallback, or it will 404 the
ten migrated slugs during the Saleor-convergence window.

### F.2 — Gate mechanics

**v1 asks the minimal question directly.** Not a loopback into the app.

```
key       `${saleorChannel}:${routeType}:${slug}`, from the NORMALIZED pathname
          (the matcher also fires for .rsc / .json / .segment.rsc — see below)
front     process-local LRU, positive TTL 300 s, negative TTL 60 s, bounded size
miss      one bare fetch, single attempt, AbortSignal.timeout(300–500 ms):
              product     { product(slug:$s, channel:$c) { id } }
              collection  { collection(slug:$s, channel:$c) { id } }
              category    { category(slug:$s) { id } }        ← global, see F.4
single-flight   concurrent misses on one key share one in-flight request
concurrency     bounded, so a dictionary scan cannot fan out to Saleor
breaker         a run of failures short-circuits to pass-through
verdict   404 ONLY on an authoritative null from a healthy upstream.
          upstream-error, timeout, breaker-open, unknown → pass through
headers   strip every client-supplied `x-maky-*` before setting our own
flags     ROUTE_EXISTENCE_GATE (global kill switch) + per-market + per-family,
          all default OFF
404 body  rewrite to `/_not-found` — see the note below; the market-aware target was
          tried, measured, and does not work from the proxy
```

Why the minimal query rather than the shared full resolver measured in §E.2:

- the status decision needs **existence**, nothing else; the full product document
  is far more than the question requires
- it avoids a publicly reachable internal endpoint, the secret that would have to
  protect it, and a loopback hop on the critical routing path
- it does not depend on `"use cache"` sharing behaviour surviving a future
  refactor — the LRU stays a performance cache, never a correctness dependency
- category cannot share the page's resolver anyway: the page asks for a paginated,
  filtered product connection keyed on query parameters, so there is nothing to
  share

The cost is honest and small: **one extra minimal request per cold key**, i.e. at
most one per active slug per five minutes per process. The shared-full-resolver
variant remains on the table for a later revision, but only against a PoC on the
real full product query (request count, cold/warm p50/p95, timeout and outage
behaviour, cache-sharing proof) — not against the synthetic probe in §E.2.

**Fail-open is the whole safety argument.** A hard 404 must require positive proof of absence from a healthy
authority. Everything else degrades to exactly today's behaviour, which is survivable.

Four implementation constraints, each verified against the installed Next 16.2.9 rather than assumed:

- **`proxy.ts` runs on Node.js and cannot be moved to Edge.** `build/entries.js:231-234` routes a proxy file
  unconditionally to `onServer()` — there is no `onEdgeServer()` branch (the legacy middleware path at
  `:235-243` still has one). Setting `runtime` throws `E1031`
  (`build/analysis/get-page-static-info.js:583-599`): _"Proxy always runs on Node.js runtime."_ Confirmed
  from this worktree's own build output: `functions-config-manifest.json` carries
  `"/_middleware": { "runtime": "nodejs" }` while the Edge `middleware-manifest.json` is empty. So `fetch`,
  `AbortSignal.timeout` and module state are all plainly available. This is _stronger_ than "Edge is not a
  restriction" — Edge is not even reachable.
- **The LRU key must be the normalized pathname.** The built matcher carries the suffix group
  `(\.json|\.rsc|\.segments\/.+\.segment\.rsc)?` — the proxy also runs for RSC, prefetch and segment
  requests. One user navigation can therefore invoke the gate several times for the same logical path. Key
  on the normalized path or the Saleor traffic multiplies.
- **The LRU is a performance cache, never a correctness dependency.** The official proxy docs say plainly:
  _"you should not attempt relying on shared modules or globals."_ Mechanically it works here — Node's CJS
  `require` at `next-server.js:1064-1079` evaluates the bundle once per process, and PM2 fork mode gives one
  V8 isolate — but the design must remain correct if that ever changes. It does: a miss only costs a fetch,
  and cluster mode would simply mean N colder caches. The LRU is also **cold after every deploy**.
- **Do not import `RequestQueue` into the proxy bundle — and the reason is not only the 200 ms.**
  `src/lib/graphql.ts:140` is `await Promise.all([fn(), sleep(minDelayMs)])` with `minDelayMs = 200` (`:180`)
  and only **3 concurrency slots shared with the render path** (`:179`), so the gate would head-of-line-block
  the very page it is gating. Worse: on a Saleor outage that client takes **up to ~67 s** to give up
  (15 s timeout `:185` × 4 attempts `:190`/`:223`, plus 1 + 2 + 4 s backoff `:250`) — **past nginx's default
  60 s `proxy_read_timeout`**, and `/etc/nginx/conf.d/storefront.conf` sets no override. "Fail open" would
  then present as a site-wide **504**. The gate must use a bare `fetch`, single attempt,
  `AbortSignal.timeout(~300–500 ms)`.
- **The proxy is a separate turbopack bundle from the app — plan for TTL-only invalidation.**
  `.next/server/middleware.js` resolves to its own chunk; `src/lib/channel-map.ts` and
  `src/lib/product-redirects.ts` are physically duplicated into both graphs. Consequences: `revalidateTag`
  cannot reach the gate's LRU by import, and **a webhook handler updating a "shared" `Map` would be a no-op
  that builds, type-checks and unit-tests clean.** Eviction needs either an explicit `globalThis` rendezvous
  plus new code in `api/revalidate/route.ts`, or the design must accept TTL-only expiry. The proxy also runs
  with **no Next work store** (`next-server.js:1195-1200` passes `page:'middleware'` while `adapter.js:213`
  expects `'/proxy'`), so inside `proxy.ts` there is no incremental cache and `fetch(…, {next:{revalidate}})`
  is inert.

  **This does not contradict the measured cache sharing in E.2.** That result came from a _loopback HTTP
  request_ into the app bundle, which does have a work store — not from a module import. The sharing works;
  what does not work is reaching into the proxy's own memory from the app.

### F.3 — P0, and it is not what the brief asked about

`src/proxy.ts:154` excludes `.*\..*` from the matcher — **any path containing a dot skips the proxy
entirely**, including the 404 gate. Verified live on production, 2026-08-06:

| URL                                       | status  | robots          | canonical      |
| ----------------------------------------- | ------- | --------------- | -------------- |
| `/does.not.exist`                         | **200** | `index, follow` | self-canonical |
| `/admin.php`                              | **200** | `index, follow` | self-canonical |
| `/wp-login.php`                           | **200** | `index, follow` | self-canonical |
| `/index.php`                              | **200** | `index, follow` | self-canonical |
| `/does.not.exist/categories/stresne-boxy` | **200** | `index, follow` | —              |

And the rendered page emits 12 crawlable links under the bogus prefix
(`/does.not.exist/categories/*`, `/does.not.exist/poradna`, `/does.not.exist/login`, …). This is the same
self-propagating indexable-URL generator recorded as fixed on 2026-07-29 — fixed for **dotless** first
segments, still open for dotted ones. On a domain that was previously a WooCommerce shop, that is aimed
straight at the legacy `/*.php` and `/wp-content/*` inventory. It also matters more than usual right now
because the `/admin` and `/*/login$` `Disallow` lines were deliberately removed from `robots.ts:24-33`, so
these URLs are fully crawlable by design.

The fix is to replace the blanket dot rule with an explicit exclusion list (`/robots.txt`, `/sitemap.xml`,
the icons, `/.well-known/*`). It is small, independent of everything else here, and should ship **first and
separately**.

### F.3b — Fallback if §10 approval for a blocking gate is refused

A **render-fed negative cache**: the page writes `globalThis.__makyAbsent.set(key, expiry)` immediately
before `notFound()`, and the proxy 404s on subsequent hits. Zero added latency, zero extra Saleor requests,
roughly fifty lines, and it exploits the same single-process fact the LRU relies on. Googlebot re-crawls URLs
it has indexed, so the second crawl gets a real 404 — which recovers most of the SEO benefit.

It is a fallback, not the answer: **the first request is still a 200**, so it fails a `curl -I` acceptance
criterion — the standard this project set for itself on 2026-07-29. Recorded here so the option is not
rediscovered later as if it were free.

### F.4 — Categories need a two-part question

`category(slug:)` is global. So for categories the gate must ask both:

1. does the slug exist at all (global), **and**
2. does it hold ≥ 1 product in _this_ channel — `SitemapCategories.graphql:5-11` is the exact shape.

What to do when (1) is yes and (2) is no is a **business decision, not a technical one** — see open
question 1.

### F.5 — Freshness SLA

| Event                                            | Time to correct, no rebuild                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| New product published in Saleor                  | ≤ 60 s (negative LRU TTL) + ≤ 60 s (`use cache` revalidate) ≈ **60–120 s** |
| …with the Saleor `PRODUCT_UPDATED` webhook wired | **immediate**                                                              |
| Product deleted / unpublished                    | ≤ 300 s (positive TTL)                                                     |
| Product published in a _second_ market           | same 60–120 s, that market only — keys are per channel                     |

`/api/revalidate` already exists and already handles product/category/collection by tag. But
**`SALEOR_WEBHOOK_SECRET` is absent from `/opt/storefront/.env`** — the endpoint has no configured producer
today. Wiring it is a small, separate ops task that upgrades the SLA from ~2 minutes to instant. It is an
accelerator, never a correctness dependency.

### F.6 — Performance, honestly

The warm path costs nothing measurable: 1.9–2.2 ms TTFB gated vs 2.5–2.9 ms ungated.

The cold path is the real trade. Today a cold product URL flushes its shell at **2.5 ms** and completes at
206 ms. With the gate, the status must be decided first, so TTFB becomes the lookup latency:

| Path                                                                                                     | measured                                                                    |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Node `fetch` (undici, **keep-alive** — what `proxy.ts` would actually do), 24 samples across 2 processes | **p50 27.2 ms · p95 42.5 ms** (warm); 63–65 ms on a process's first request |
| `curl`, fresh TLS handshake per run, 10 runs                                                             | ~46 ms (p50 46.5, p95 49.9) — of which **TLS ~19.4 ms**                     |
| the same query through `executePublicGraphQL`                                                            | **~200 ms**                                                                 |

Two separate effects, and both are addressable:

- The ~150 ms gap to `executePublicGraphQL` is the storefront's own `RequestQueue` (200 ms inter-request
  delay, documented at `next.config.js:19`), not Saleor.
- The gap between curl and undici is the TLS handshake. Keep-alive pays it once per process, so the steady
  cost of a miss is **~27 ms**, not ~46 ms.

`api.maky.store` resolves to `3.77.6.21` (AWS eu-central-1) — a different host, but TCP connect is 1.1 ms,
so the ~27 ms floor is Saleor's own server time and is not reducible by co-location. Combined with the 300 s
positive TTL, only the first request per slug per five minutes pays it. Optionally, warming the LRU at boot
from the sitemap's existing enumeration (481 URLs) makes essentially every real product URL warm — which
also covers the cold-after-deploy case.

---

## G. Implementation plan

Branch `fix/seo-hard-404-v1`, worktree `/home/ubuntu/worktrees/maky-storefront-seo-hard-404-v1`, off
`a5e5ff3`. Five commits, each independently revertable.

**C1 — P0 matcher fix** (`src/proxy.ts`)
Replace `.*\..*` with an explicit asset exclusion list. Test: `/does.not.exist` → 404, `/admin.php` → 404,
`/robots.txt` → 200, `/sitemap.xml` → 200, `/icon.png` → 200, `/.well-known/x` unchanged.

**C2 — data semantics** (`src/lib/graphql.ts`, new `src/lib/saleor/resource-outcome.ts`, 13 call sites)
As F.0. Adds unit tests for each arm of the union and a regression test that an upstream fault is not cached.

**C3 — generated static-route allowlist** (new `src/lib/route-classifier.ts` + build step + drift test)
Enumerates market-root static segments from `src/app/`, plus the classifier for
product / category / collection / saleor-page / other.

**C4 — the gate** (`src/proxy.ts`, new `src/lib/route-existence.ts`) — ships **OFF**
Minimal direct query, bare `fetch`, single attempt, 300–500 ms timeout. LRU with single-flight, bounded
concurrency and a circuit breaker. Fail-open on anything but a healthy authoritative null. `x-maky-*`
stripping. Global kill switch plus per-market and per-family flags, all default OFF. No internal HTTP
endpoint, so nothing new to authenticate or rate-limit.

**C5 — localized 404 + legacy redirect registry skeleton**
Add `(main)/not-found.tsx` (Slovak, market-aware links — the current global `not-found.tsx` is hardcoded
English with market-less links, served inside Slovak chrome, and its "Browse Products" link points at
`/products`, which **the proxy itself 404s**, verified live). Without this, shipping the gate is a visible UX
regression: a missing product today gets a localized _Produkt nenájdený_ with chrome; via `/_not-found` it
would get an English page with no header or footer and a dead link. Add an **empty** exact-match legacy redirect
map so the architecture exists without inventing redirects. Also fixes a small observed defect: the
soft-404 response currently carries **two conflicting robots tags** — `<meta name="robots" content="noindex">`
(Next's injection) and `<meta name="robots" content="noindex, nofollow">` (the route's own), and on
`/sk/search` the pair is `index, follow` _and_ `noindex`, which is worse.

---

## H. Acceptance plan

Run against a scratch `next start` first, then production after deploy. Markets are iterated from
`CHANNEL_MAP`, never hardcoded.

```bash
# 1. every market, missing resources → 404
for m in sk cz de at pl hu it fr es ro us ca; do
  for p in "/$m/seo-canary-missing-product" \
           "/$m/categories/seo-canary-missing-category" \
           "/$m/collections/seo-canary-missing-collection" \
           "/$m/pages/seo-canary-missing-page"; do
    printf '%-56s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "$BASE$p"   # expect 404
  done
done

# 2. no canonical on a 404
curl -s "$BASE/sk/seo-canary-missing-product" | grep -c 'rel="canonical"'      # expect 0

# 3. valid pages unchanged
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/sk"                            # 200
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/sk/categories/stresne-boxy"     # 200 + index,follow

# 4. GET / HEAD parity, browser / Googlebot  (curl -I, never curl -X HEAD)
# 5. retired product URL:  /sk/products/<slug> → 308 → /sk/<slug> → 200
# 6. static market pages:  /sk/poradna /sk/kontakt /sk/odstupenie-od-zmluvy → 200
# 7. P0:  /does.not.exist /admin.php /wp-login.php → 404 ; /robots.txt /sitemap.xml → 200
# 8. every one of the 481 sitemap URLs → 200, no noindex, correct canonical
```

Upstream-fault suite (integration, against a local fake Saleor): timeout · 500 · invalid JSON · GraphQL
error · contract mismatch → **no 404, no cached negative** in every case.

Future-product suite: server up → slug absent → 404 → mock upstream starts returning it → **no rebuild, no
restart** → after the TTL → 200. Same test scoped to one market only, to prove isolation.

---

## I. Risk

| Risk                                                 | Mitigation                                                                                                                                                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate 404s a real page (static-route collision)       | Allowlist generated from `src/app/` + drift test; per-family flags; kill switch                                                                                                                                 |
| Gate 404s during a Saleor outage                     | Fail-open by construction; Layer 0 lands first so absence and fault are distinguishable                                                                                                                         |
| Cold TTFB regression on PDPs                         | Lean existence query (~46 ms, not ~200 ms); 300 s positive TTL; optional boot warm-up                                                                                                                           |
| Migrated slugs 404 during convergence                | Gate replicates `previousProductSlug()`; explicit test on all 10                                                                                                                                                |
| Dictionary-scan URLs hammering Saleor                | Negative LRU absorbs repeats; bounded LRU size; 500 ms timeout                                                                                                                                                  |
| One navigation triggering several gate lookups       | LRU keyed on the **normalized pathname** — the matcher also fires for `.rsc` / `.json` / `.segment.rsc`                                                                                                         |
| Making `proxy` async stalls delivery if Saleor hangs | `AbortSignal.timeout(500)` + fail-open; bare `fetch`, never the queued client (which needs ~67 s to fail, past nginx's 60 s `proxy_read_timeout` → 504)                                                         |
| `fork_mode` is load-bearing but **unpinned**         | No `ecosystem.config.js` exists; `deploy-production.sh:389` just runs `pm2 start`. A future `pm2 scale` silently gives N colder caches — correct, but slower, with no error anywhere. Worth pinning explicitly. |
| Testing the gate in `next dev`                       | `next dev` takes a different render path and would report a 404 where production returns 200 — a **false green**. Acceptance must run against `next build` + `next start`.                                      |
| Rolling the gate to all 12 markets at once           | 11 of 12 channels have an empty catalogue (`sitemap.ts:18-19`) — a simultaneous rollout converts eleven empty storefronts into eleven hard-404 fields. `sk-eur` first, alone.                                   |
| `proxy.ts` is CLAUDE.md §10 restricted               | Explicit approval required before C1 and C4                                                                                                                                                                     |
| P0 fix over-404s a real asset                        | Explicit exclusion list + asset acceptance test in C1                                                                                                                                                           |

**Rollback:** `ROUTE_EXISTENCE_GATE=off` (no redeploy) → `pm2 restart maky-storefront` → artifact rollback
per CLAUDE.md §13.3. Deploy only via `./scripts/ops/deploy-production.sh`.

**Rollout:** C1 alone first, verified 24 h. Then C2 (no status change). Then C4 flagged on for
`product` + `sk-eur` only, watch the nginx 404 rate 24 h, then categories and collections, then the other
11 markets. An alarm on the 404 share of requests is a hard prerequisite — the first version of any such
gate has a false positive; the only question is whether it is seen in five minutes or in a week.

---

## J. What was NOT done

> **This section described the state on 2026-08-06 before any code was written, and said so in the
> present tense: "no implementation, no commit". That stopped being true the same day.** It is
> rewritten below rather than deleted, because the earlier wording survived nine commits and was
> read as current — which is exactly the failure it now warns about. Anything in sections A–H that
> reads as present tense describes `a5e5ff3`, not the branch.

**Done since:** thirteen commits on `fix/seo-hard-404-v1`, `a5e5ff3..cf9f515`, 38 files. C1 (matcher),
the market-state layer, C2 (data semantics), C3/C5 (route classifier + localized 404) and C4 (the
gate, shipping off) are all implemented, and an acceptance run against a production build is
recorded in `seo-hard-404-stop-report-20260806.md`.

**Still not done, and all still true:**

- **Not deployed.** Production is `a5e5ff3` / `JdV9eVV4t2laAlpGhyofM`, PM2 untouched since 1 Aug. No
  build has ever run in `/opt/storefront` for this work — the acceptance build was made in the
  branch worktree and served on port 3040.
- **The gate has never been armed outside a scratch server.** It ships off and stays off until
  `ROUTE_EXISTENCE_GATE=on` plus an explicit market and family list.
- **No monitoring, no alerting, no 404-rate baseline.** The stated hard prerequisite for arming it.
- **The future-product path is unverified end to end** — publishing a product and watching a 404
  become a 200 after the negative TTL needs a write to the production catalogue.
- No write to Saleor, Payload or any database. nginx untouched.

---

## K. Open questions — these need Marek, not more analysis

> **Questions 1 and 2 have since been answered in code**, and the answers ship. Recorded here so
> nobody re-opens them from this list: (1) a category that exists globally but is empty in this
> market serves **200 + `noindex`, no canonical** — `categories/[slug]/page.tsx`; it becomes
> indexable again on its own when stock arrives, with no deploy. (2) The seven sk-only legal pages
> under another market are a **hard 404**, decided from the route policy in `proxy.ts` — note this
> ships **even with the gate off**, so `/de/kontakt` changes from 200 to 404 on the next deploy.
> Question 5 (§10 approval for `proxy.ts`) was granted for C1 and C4. Questions 3, 4 and 6 are
> still open.

1. **Category that exists globally but is empty in this market.** 404, or 200 + `noindex`? **Twelve of the
   thirty categories currently hold no products, and four of those sit in the main navigation** — i.e. four
   links emitted from every page on the site. Whatever we choose, it must not 404 a URL the header links to.
   This is a merchandising decision, not a technical one.
2. **The seven sk-only legal pages under a non-sk market** (`/cz/kontakt` …). They currently serve an
   indexable Slovak `<head>` over a 404-ed body. Hard 404, or translate, or `noindex` + 200?
3. **Legacy redirect registry content.** The architecture can ship empty. Populating it needs the
   WooCommerce URL inventory (Search Console export or the old sitemap) — do we have one?
4. **410 vs 404 for withdrawn products.** Saleor returns the same `null` for "never existed" and
   "unpublished", so 410 cannot be derived. Do we want an explicit gone-list?
5. **§10 approval** to modify `src/proxy.ts` and routing logic (C1 and C4).
6. **`/wp-content/*` → 410 at nginx.** Cheaper and better than letting Node answer. Separate micro-task —
   confirm it should be raised.
