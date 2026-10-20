# Indexing: the Bing `noindex` of 2026-10-08, where `noindex` stays on purpose, and how to tell the engines

Written 2026-10-08 after Marek sent a Bing Webmaster Tools screenshot of
`https://maky.store/cz/autochladnicky`: "Not indexed due to NOINDEX directive", discovered
8 Oct, last crawl attempted 11:11 (Webmaster Tools shows the account's time, CEST), crawl
allowed, page fetch successful, indexing allowed **No**.

## 1. What happened

The site was not blocking Bing. Bing read the page at a moment when the page was, by design,
`noindex`:

- **One visit.** The nginx log has exactly one Bingbot request for that URL:
  `08/Oct/2026:09:11:52 +0000`, HTTP 200, 35 055 bytes. 09:11 UTC is 11:11 CEST, the "last crawl"
  in the screenshot. No request for the URL from anyone is logged before it, and no Bingbot request
  after it; the Bingbot line at 15:18 UTC is the web server's own test with that user agent.
- **The size says which page it was.** A stocked fridge category weighs about 45 to 50 KB on the
  wire (Bingbot user agent, 15:18 UTC: 49 641 B; Googlebot at 10:57 UTC: 49 208 B). A category
  that holds nothing in that market, or has no translation there, weighs about 32 to 35 KB and
  carries `noindex` and no canonical (probe of 15:32 UTC, `/cz/stresne-boxy` 34 155 B and the
  like). The 35 055 B of 09:11 is the second kind.
- **Why that kind exists.** `categories/[slug]/page.tsx`: a category with `products.totalCount === 0`
  in the channel answers `noindex, follow` with no canonical, and "reverts on its own the moment the
  channel gets stock, no deploy". A foreign category without its own name and SEO texts is "not found"
  with `noindex, nofollow`. Both are right in steady state, since an empty or untranslated page must not
  be nominated.
- **When it changed.** The first full-size render of `/cz/autochladnicky` in the log is 10:54:50 UTC
  (43 KB), Googlebot got 49 KB at 10:57. Bing's IT and FR fridge pages, read at 09:50 UTC, were already
  full size (48 KB). So the Czech fridges went in that morning, after Bing's visit.
- **Bing has not come back.** Webmaster Tools therefore still shows the 09:11 verdict. A search engine
  does not re-read a page it has seen as `noindex` quickly, and the site has no way to make it.

Live state, measured from the web server at 15:18 to 15:32 UTC with a Bingbot, a Googlebot and a browser
user agent: 81 HTML pages (home, categories and products in sk, cz, de; pages, products and vehicle pages from every
sitemap shard) all answered `index, follow` with the Google and Bing image and snippet directives, no
`X-Robots-Tag`, one self-canonical. `robots.txt` allows everything but the private areas and has no
crawl delay. `MAKY_LIVE_MARKETS` and `MAKY_INDEXABLE_MARKETS` list all twelve markets. Bing's other
traffic is healthy: 952 requests in about 40 hours, 936 of them 200, and it reads the sitemap shards.

What the log cannot show: whether at 09:11 the Czech fridge products were not yet in Saleor's `cz-czk`
channel (the likely case), or were in and a cached "empty" answer of that category was still being served.
A category entry is refreshed after 60 s and expires after an hour (`cacheLife("minutes")`), and
`/api/revalidate` expires a category only when the event names it (a product event carries the category
only if the webhook subscription selects `category { slug }`). Section 4 is written so that the second
case cannot bite either, and section 6 shows how a stale answer of that kind reaches a crawler and what was
changed so that it cannot.

"Almost nothing is indexed" in the screenshot's question is a separate matter: no technical block was found
(see above), and a new domain with twelve markets and well over a hundred thousand URLs is read by Bing over
weeks. IndexNow (section 5) is the lever the site itself has.

## 2. Where `noindex` stays, and why

`noindex` is always the page's own robots meta (and `X-Robots-Tag` where the proxy answers). It is **not** a
`robots.txt` `Disallow`: a URL a crawler may not fetch can never be re-crawled, so it can never be dropped
from the index either.

| Page                                                                   | Robots                  | Why                                                                                                                          |
| ---------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Cart, checkout, order confirmation, login, signup, account, order list | `noindex, follow`       | Personal or transactional, nothing to rank. `follow` because they link on to real pages.                                     |
| Garage, favourites, configurator                                       | `noindex, nofollow`     | The page is one visitor's saved cars or list; an empty shell to everyone else.                                               |
| Search results                                                         | `noindex, follow`       | Infinite thin variants (`?q=`). Becomes indexable only if `route-policy` says so.                                            |
| Category with no products in this market                               | `noindex, follow`       | Nothing to show. No canonical. Reverts by itself the moment the channel holds stock.                                         |
| Category with no translation in a foreign market                       | `noindex, nofollow`     | Treated as not found in that market (exact-locale rule); the page would be wrong-language content.                           |
| Vehicle pages CFM marks not indexable                                  | `noindex, follow`       | `indexabilityOf(page)`; only published, indexable pages with text in the market's language are indexable and in the sitemap. |
| Brand list with no brands, unknown brand                               | `noindex, follow`       | Empty or absent.                                                                                                             |
| Not found: product, collection, page                                   | `noindex, nofollow`     | A "not found" title and no canonical. For products the proxy gate answers a real 404 first; the meta is the floor.           |
| Saleor not answering (fault)                                           | `noindex, nofollow`     | "Could not verify" is not "does not exist": no canonical, no not-found title, remembered for seconds only.                   |
| Legal pages of a market with no approved copy                          | `noindex, nofollow`     | The page 404s; the metadata must agree.                                                                                      |
| CMS preview (Draft Mode)                                               | `noindex, nofollow`     | `private, no-store`; a draft is never indexed.                                                                               |
| A market that is not live                                              | `X-Robots-Tag: noindex` | `MAKY_LIVE_MARKETS`; today there is none (all twelve are live and indexable).                                                |
| Junk paths, unknown sitemap shards                                     | 404 + `noindex`         | The proxy and the sitemap route.                                                                                             |

Every public page of a live market that holds content is indexable: home, stocked categories, products,
brand pages with brands, vehicle pages CFM marks indexable, the legal and content pages. If one of them
answers `noindex` while it has content, that is a defect, not the design.

## 3. Looking at a page the way Bing does

```bash
UA='Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36'
F=$(mktemp)
curl -s -A "$UA" -D - -o "$F" https://maky.store/cz/autochladnicky | grep -i -E '^(HTTP|x-robots-tag|content-length)'
grep -o 'name="robots" content="[^"]*"' "$F" | head -1
grep -c 'rel="canonical"' "$F"
rm -f "$F"
```

Expected for an indexable page: `HTTP/2 200`, no `x-robots-tag`, `index, follow`, one canonical. Bing is
among the `htmlLimitedBots` (`src/config/html-limited-bots.js`), so it gets the finished page with its head
metadata, not the streamed shell: this is the page it indexes, and a probe with another user agent proves
less. Compare the size with the ranges in section 1 when the robots line looks right but something feels off.

## 4. Launch order for a category in a market

A crawler that arrives between "the products are in" and "the page says so" reads `noindex` and does not
come back soon. In this order:

1. The products are published in the market's channel, and the category has its name, description, SEO
   title and SEO description in the market's language.
2. The category page is expired **by name**: a category event,
   `POST /api/revalidate` with `{"category":{"slug":"<base slug>"},"channel":"<channel>"}` and the
   `x-revalidate-secret` header (what `scripts/ops/foreign-catalog-purge.mjs` sends), once per channel. It
   expires the category page, the sitemap tag and the vehicle-page offers at once. Do not rely on a product
   event for this unless the webhook subscription selects the category.
3. Probe as Bing (section 3): `index, follow`, one canonical, a size in the stocked range.
4. Only then point engines at it: the sitemap already lists it on its own; send it through IndexNow
   (section 5, `--urls`).

## 5. IndexNow

IndexNow lets the site tell Bing, Yandex, Naver, Seznam and Yep which URLs are new or changed. One
POST names them; the engine fetches them soon after. It does not decide what gets indexed.

- **The key** is `c495b1fed398d0bfa806ba2f42d53c85`, and it is public by design: the file
  `public/c495b1fed398d0bfa806ba2f42d53c85.txt` holds exactly that text and is served at
  `https://maky.store/c495b1fed398d0bfa806ba2f42d53c85.txt`. The engine reads it to see that whoever
  submits for `maky.store` controls `maky.store`. Nothing private hangs on it. To rotate: a new file with a
  new name and content, the old one removed, one deploy.
- **The tool** is `scripts/ops/indexnow.mjs`, run on the web server from `/opt/storefront` after the deploy
  that carries the key file. Node only; it reads the public sitemaps, touches nothing else and writes only its
  state file. Dry run is the default.

  ```bash
  node scripts/ops/indexnow.mjs --kinds pages                  # plan only; also says whether the key file is served
  node scripts/ops/indexnow.mjs --kinds pages --state ~/indexnow-state.json --fire
  node scripts/ops/indexnow.mjs --kinds vehicles,products --max 10000 --state ~/indexnow-state.json --fire
  node scripts/ops/indexnow.mjs --urls /cz/autochladnicky,/cz/<product> --fire     # after a publish
  ```

  `pages` is the home pages, categories and content pages of every market (about 180 URLs): start there.
  Products and vehicles are about 140 000: with `--state`, each run sends the next `--max` URLs and the
  last one says "nothing to send". `--urls` ignores the state, because a URL is named when it has just changed.

- **What stops it.** Not firing unless the public site serves the key file; any URL off the site's host; a
  typo in an option; any answer other than 200 or 202 (403: key file not reachable or wrong; 422: URLs
  not of the host; 429: too many requests, wait and run again, the state file has kept the progress).
- **Etiquette.** Send what is new or changed, not the whole site every hour. Only URLs that are indexable:
  the sitemap-driven mode sends sitemap URLs only; `--urls` sends whatever it is given.
- **In Bing Webmaster Tools** (Marek's account): "URL Inspection", paste the URL, "Request indexing" for a
  single page (a small daily allowance), and "Sitemaps" once with `https://maky.store/sitemap.xml`. IndexNow does
  the same for many URLs without a person.

## 6. A head that lags behind its page (found the same evening)

Bing's six fridge categories of 14:37 to 14:39 UTC (AT, RO, PL, ES, FR, DE) came back `200` at 48.8 to 49.7 KB,
the size of a stocked page, and Webmaster Tools says "indexing allowed: No" and no canonical for the two
inspected (RO and DE). The same pages answered `index, follow` with one canonical to Bing's own live tests at
19:30 and 19:47 UTC and to the web server's probe of 19:58 to 20:01 UTC (all 177 pages of the page sitemaps and
all twelve fridge categories). A full listing under a `noindex` head means the two did not come from the same read.

**The mechanism.** The listing is read when the page is rendered. The head (`robots`, canonical, title) comes
from `getCategoryOutcomeCached`, a `"use cache"` entry (`cacheLife("minutes")`: refreshed after 60 s, gone after
an hour), and that function read Saleor with `revalidate: 300`, which puts a second cache, the data cache, under
the entry. The data cache hands back a stale read however old it is and refreshes it behind the request, so a
prerender that found the entry stale (a stale entry is a miss there) was given the previous read again, and the
visitor after a long gap, which is what a crawler is, always met the answer from before the last change. One bad
read, a moment of "empty" while products were being written or a fault, stayed in front of the next visitor.

**Reproduced** on Next 16.3.6, the version in production, in a throwaway app with the same structure (the head
from a cached entry with `cacheLife("minutes")`, the listing from its own fetch, `cacheComponents`, the
Bingbot user agent; the data changes from empty to six products at second 1):

| The entry and the fetch under it                                  | First visit +10 s | +100 s | +320 s | Revisit of a stored page +10 s | +40 s | +100 s | +320 s |
| ----------------------------------------------------------------- | ----------------- | ------ | ------ | ------------------------------ | ----- | ------ | ------ |
| As before: `minutes`, fetch `revalidate: 300`                     | stale             | stale  | stale  | stale                          | stale | stale  | stale  |
| `minutes`, fetch not cached                                       | stale             | fresh  | fresh  | stale                          | stale | fresh  | fresh  |
| 30 s / 300 s entry, fetch not cached                              | stale             | fresh  | fresh  | stale                          | fresh | fresh  | fresh  |
| `minutes`, 5 s / 300 s when empty, fetch not cached (this change) | fresh             | fresh  | fresh  | fresh                          | fresh | fresh  | fresh  |

"Stale" is `noindex, follow`, no canonical and the title of the empty read, with the listing under it fresh:
what Bing was given. Under the old code the head was still stale at 360 s and at 400 s, and still two and five
seconds after a request at 320 s had made the data cache refresh (the entry in front of it was rebuilt from the
stale read): two caches, two rounds, and a crawler comes once.

**Repeated with the cache handler of PR #50** (2026-10-18: the same app and variants on Next 16.3.6, built and
started as production is, with `cache-handler.mjs` and `cacheMaxMemorySize` of 256 MB). A page stored while the
category was empty and asked for again 10, 40, 100 and 320 s later came back `noindex, follow` every time under
the old code, and again on a second and third request a few seconds after each. The variant without the data
cache was `noindex` at +10 and +40 s and fresh from +100 s, the 30 s / 300 s entry `noindex` at +10 s and fresh
from +40 s, and this change `index, follow` with one canonical from the first revisit at +10 s. The handler
decides only where an entry is stored (memory, and disk only while the build runs); it does not decide when a stale
read is handed out, so it neither removes the mechanism nor changes what the fix does.

**What changed** in `categories/[slug]/page.tsx`:

- The read behind the outcome is not cached a second time (`cache: "no-store"`); the entry is the one cache.
- A category that holds nothing in the channel, and one with no name in the market, are kept for seconds
  (stale after 5 s, gone after 300 s: `FAULT_CACHE_LIFE`, the life a fault already had), not for the profile's
  hour. Those are the answers that end by themselves when the products or the texts arrive, and `noindex` is the
  one a crawler does not return for. A stocked category keeps `minutes`.
- The markets that carry the same category are read together, not one after the other: an entry past its 60 s is
  read again by a prerender, and without the data cache that is a round trip each. (Superseded by section 7: they
  are now one request.)

`page.metadata.test.ts` pins all three. Not changed, and worth knowing: the listing itself and the collection
page's outcome (`collections/[slug]/page.tsx`) still read under `revalidate: 300`; `/api/revalidate` still expires
a category only when the event names it (section 4 stays the launch order).

**What it costs.** Without the data cache under it, a Saleor outage that outlasts the transport's own retries
(three, after 1 s, 2 s and 4 s) reaches the head as `upstream-error` (`noindex, nofollow`, remembered 5 s), where
the data cache used to answer from an older read for up to five minutes. A category that is not cached already
behaves so, after every deploy and restart. The production error log (1.17 million lines, read on 2026-10-08)
holds no `scope: category` error; its network errors sit in other uncached reads (product 33, product-presence 78,
sitemap-categories 46, category-products 4). After a deploy, count the `"scope":"category"` lines in the PM2 logs:
a rise is this cost, and the remedy is a last-good fallback or arming the category gate (`x-maky-gate:
category:not-armed` today), not the data cache back.

**What was not proven.** Which read poisoned the entry at 14:2x to 14:3x is not in the logs: a head-only fault logs
nothing, the RO page was full-size at 12:58, 14:06 and 14:25, and the error log does not date its lines. The
mechanism is shown to exist and to give exactly this picture; the change takes it away whatever the trigger was.
The restart of 19:42 UTC emptied every cache, so the pages Bing is sent to by IndexNow are read fresh.

## 7. After the deploy: more `[assortment]` lines, and what the follow-up changes (2026-10-20)

PR 46 went live on 2026-10-19 (together with PR 56). The category heads stayed right: 36 of 36 checked pages
`index, follow` with one canonical, and no `"scope":"category"` error in the first day. But the PM2 error log
gained 1 422 `[assortment]` lines by 08:00 UTC on 20 October, where the 25 hours of PR 54 alone had none, and
`category navigation unavailable` went from 10 to 26 (`nordrive-stresne-nosice` 14, `thule-stresne-nosice` 12,
always `CategoryNavigation: deadline exceeded`).

**What the lines count.** Not outages. `getMarketAssortment` (which categories a market stocks, for the header, the
menus and the homepage) prints one line on every call that meets a fault, the entry keeps a fault for 5 s
(`FAULT_CACHE_LIFE`), and a page render calls it several times. The reads that really failed are the
`[upstream-error]` lines of the scope `sitemap-categories`: 24 since the deploy (`ro-ron` 17, `it-eur` 5, `fr-eur` 1,
`at-eur` 1), plus 2 of `product-presence`. The 116 lines of 07:47 to 08:00 were two bursts, 48 for `ro-ron` and 68
for `at-eur`, each matching a cluster of requests to that market in the nginx log. A read of the list took 510 to
874 ms in 25 of 25 measured attempts (medians 515 to 668 ms) against a deadline of 1 500 ms.

**Why PR 46 is a suspect.** On a cold category head it reads every live market at once, twelve
`ProductListByCategory` reads (a product card in each) per category slug, and it keeps an empty or untranslated market
for 5 s, so a category that is empty in eight markets is read up to eight times every few seconds while its pages
keep being requested. Those reads and the header's own deadline-bound reads (the list above, the category navigation)
wait in the same request queue, which has twelve slots (`maxConcurrent` in `graphql.ts`). A read that takes 0.5 to
0.9 s on the wire misses a 1.5 s deadline after a wait of a second or so.

**What is not proven.** That this is the cause. Every failed list read says `SitemapCategories: deadline exceeded`,
none `before a Saleor slot came free`, and the log did not say whether the deadline went on the queue or on Saleor
(`queueStarved` was never printed). Every catalogue event also expires the market's list at once
(`sitemap:{channel}`, `IMMEDIATE` in `/api/revalidate`), so the next render reads it synchronously, right after a
write, when Saleor may be slowest. And the line is not new: the 64 hours of PR 50 to PR 54 had 48 `[assortment]`
lines (the 25 hours of PR 54 alone had none, so that quiet day is not a baseline).

**What the follow-up changes** (`category-presence.ts`, `category-counterparts.ts`):

- The other markets' hreflang and market switcher come from ONE request with an alias per live market, the way the
  product page gets its markets (`product-presence.ts`), not from one heavy read per market. It asks for exactly what
  the exact-locale boundary and the product count read and answers through that boundary, so it says what the
  page's own lookup and the sitemap say; a parity test over the real `ProductListByCategory` document pins that, case
  by case. Its entry keeps the life of a category entry (an empty market does not shorten it; the own market's head
  keeps its short life from section 6), carries every live channel's category tag, and is cut off at 1.5 s. A fault
  is the whole answer: the page then names only itself, remembered for 5 s and logged as `category-presence`. The
  page's own market is decided by the head the page has just read, never by this entry.
- `[upstream-error]` lines, and the `category navigation unavailable` line, say `queueStarved` when the deadline was
  spent waiting for a Saleor slot in this process.

**How to read the result.** Count the `[upstream-error]` lines per scope, not `[assortment]`: `sitemap-categories`
with and without `"queueStarved":true`, `category-presence`, `product-presence`, and the `[queueStarved]` marker on
`category navigation unavailable`. The number to compare is `sitemap-categories` lines per day, counted from a known
point of the log (it carries no timestamps): 24 in the first 24.5 h after PR 46 went live. If it does not fall and
the lines are not `queueStarved`, the trigger is the re-read of the list after each catalogue event, and the next
step is to refresh the list in the background with a longer deadline and not to expire it at once; this change does
not do that.
