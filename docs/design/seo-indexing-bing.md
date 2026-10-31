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
  node scripts/ops/indexnow.mjs --kinds pages --fire           # about 190 URLs in one request; needs no state file
  node scripts/ops/indexnow.mjs --kinds pages,products,vehicles --state /var/lib/maky-indexnow/state.json --fire
  node scripts/ops/indexnow.mjs --urls /cz/autochladnicky,/cz/<product> --fire     # after a publish
  ```

  `pages` is the home pages, categories and content pages of every market (about 190 URLs): start there.
  Products and vehicles are about 140 000. They go out only with `--state`, because without it every run would
  send the same first `--max` URLs again. With it, a run sends first the URLs it has never sent (in sitemap
  order, so a backlog drains market by market), then those whose sitemap `lastmod` is later than the time
  they were sent, none of them more than once per `--resend-after-days` (default 7). Only products carry a
  `lastmod`; a page or a vehicle is told once. `--urls` ignores the state, because a URL is named when it has
  just changed.

- **Only a 200 counts as sent.** The endpoint answers 200 (accepted) or 202 (received, the key file has not
  been checked yet). On 2026-10-08 the first run, 177 URLs, got a 202, the tool wrote all of them to the state
  file as sent, and Bing Webmaster Tools never listed them. The site was not at fault: the key file was served
  as `text/plain` with exactly the key, and the next two submissions (2 and 9 URLs on 2026-10-12) were
  answered with a 200. A 202 now stops the run, records nothing and exits 3, so the next run sends the same
  URLs again.
- **What stops it.** Not firing unless the public site serves the key file; any URL off the site's host; a
  typo in an option; products or vehicles without `--state`; any answer other than 200 (202: exit 3, nothing
  recorded; 403: key file not reachable or wrong; 422: URLs not of the host; 429: too many requests, wait and
  run again, the state file has kept the progress).
- **The daily run.** `scripts/ops/systemd/maky-indexnow.timer` starts `maky-indexnow.service` at 06:20 UTC every
  day. That hour is clear of the CarFitManager 4.5 windows on the same box (01:30 to 02:04 and 03:15 to 05:00
  UTC, Mondays also about 02:30 to 03:04), and the service skips the day while a deploy holds its lock. A run
  sends at most 10 000 URLs, at low priority, under a 768 MB ceiling and without swap, so the first backlog
  (140 000 URLs or more; a dry run says how many are pending) is told over a few weeks and after that a run
  sends what is new or changed. `--max` in the unit is raised once a week of runs looks clean. The
  progress lives in `/var/lib/maky-indexnow/state.json`, outside the checkout, so a deploy does not touch it.
  A person installs it once on the web server (the commands are at the top of the service file); the deploy
  does not. `journalctl -u maky-indexnow.service` shows every run with the endpoint's answers, and
  `sudo systemctl disable --now maky-indexnow.timer` stops it. If `maky-storefront` restarts, its memory passes
  6 GB (CLAUDE.md section 13.3.1) or the nginx log shows 5xx answers on a day it ran, stop the timer first and
  look second.
- **Reading Bing Webmaster Tools.** The IndexNow report names two sources. "Self" is what this tool sent.
  "Cloudflare" is Cloudflare's Crawler Hints, which names only cached static files (robots.txt, the favicon,
  fonts, images) and does no harm. Times are shown in the account's time zone, not UTC. "Indexing insights"
  counts URLs sent, crawled and indexed; a submission shows there within about a day. The first thing to look
  for is the crawl: `bingbot` asking for the URLs in the nginx log. Whether Bing then indexes them is Bing's
  decision.
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

- The other markets' hreflang and market switcher come from ONE cached read per category, made of two small
  requests, not from one heavy `ProductListByCategory` per market. The first asks the translations of every live
  market and no product. The second asks for the first product (`products(channel:, first: 1)`: whether the market
  holds one, never how many) in the markets the first let through, and only there. Both answers go through the
  exact-locale boundary and the emptiness rule the page itself uses, so they say what the page's own lookup and the
  sitemap say; a parity test over the real `ProductListByCategory` document pins that, case by case. The entry keeps
  the life of a category entry (an empty market does not shorten it; the own market's head keeps its short life
  from section 6), carries every live channel's category tag, and both requests run under ONE 1.5 s deadline. A fault
  in either request is the whole answer: the page then names only itself, remembered for 5 s and logged as
  `category-presence`, with the name of the request that was running (`CategoryMarketTranslations` or
  `CategoryMarketStock`). The page's own market is decided by the head the page has just read, never by this entry.
- `[upstream-error]` lines, and the `category navigation unavailable` line, say `queueStarved` when the deadline was
  spent waiting for a Saleor slot in this process.

**Why two requests** (measured on the production server on 2026-10-20, read-only, 32 categories, 12 live markets,
three runs that day to choose the shape and a fourth for the code as written). What Saleor spends on
`products(channel:, …)` inside a category depends on what the category holds in that channel, and the questions that
could answer "does this market hold a product" pull in opposite directions:

- **The count** (`totalCount`) is cheap for a small category and costs about 140 ms per market for `stresne-nosice`
  (about 25 000 products in a channel): all twelve markets in one request took 1.7 s in the first run (10:34 UTC)
  and in the third, and six such questions at once 2.9 s in the first.
- **The first product** (`first: 1`) is cheap for a dense category and slow for an empty one: Saleor looks through
  the channel's products before it can say there is none, 80 to 100 ms for each such market. `stresne-nosice` took
  0.2 s, but `nosice-lyzi` (26 products, one market) 1.1 s, `autodoplnky` 1.0 s and `default-category` (no product
  at all) 1.0 s, with eleven or twelve empty markets in the request (the second and third runs).
- **The texts** are cheap whatever the category holds: 20 to 27 ms for all twelve markets.

28 of the 32 categories are translated in the source market only, so after the first request the second has a
single alias. The four that are translated everywhere (`stresne-nosice`, `thule-stresne-nosice`,
`nordrive-stresne-nosice`, `autochladnicky`) are stocked in every market, which is the case where the first product
is fast. Third run (12:44 UTC), one category at a time, the slowest one and the sum over all 32:

| Shape                                                                                              | Slowest                       | Sum              | Categories over 600 ms |
| -------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------- | ---------------------- |
| count in all twelve markets, one request                                                           | 1 693 ms (`stresne-nosice`)   | 6 960 ms         | 3                      |
| first product in all twelve markets, one request                                                   | 1 102 ms (`nosice-lyzi`)      | 8 847 ms         | 7                      |
| translations, then the count in the translated markets                                             | 1 712 ms (`stresne-nosice`)   | 5 039 ms         | 3                      |
| **translations, then the first product in the translated markets (this change)**                   | **226 ms (`stresne-nosice`)** | **1 973 ms**     | **0**                  |
| count under 1 000 or 5 000 products in the Slovak channel, else the first product                  | 427 ms                        | 4 088 / 4 100 ms | 0                      |
| the same under 10 000                                                                              | 797 ms                        | 5 475 ms         | 2                      |
| a first request with the texts and the Slovak count decides the form of the second (1 000 / 5 000) | 371 / 370 ms                  | 1 938 / 1 898 ms | 0                      |
| count and first product asked at once, the first whole answer wins                                 | 928 ms                        | 4 788 ms         | 1                      |

The shape chosen has the lowest sum, needs no size hint (a hint from the page's own market would split the shared
cache entry by market), and has the smaller worst case: the second request asks for the first product in at most the
twelve markets, so it costs no more than the first-product form did for twelve markets (1.1 s at the slowest measured),
whatever the category holds, where a count in many markets of a large category has no such bound. One of its five
repeats of `stresne-nosice` took 696 ms (230, 696, 231, 228, 230) and one of the probe shape 692 ms, at the same
position, which suggests a pause on the Saleor side and not the shape's own cost.

**Fourth run** (20 Oct, 13:41 UTC, the production server, read-only, 32 categories): the two documents exactly as
`category-presence.ts` builds them for the twelve live markets (1 418 and 1 173 characters, sha256 `b371b11e…` and
`b244cb18…`), each category asked three times, alone. The two requests listed the same markets as a read of the
product count in every market in 32 of 32 categories. The slowest category, by the median of its three passes, took
228 ms (`stresne-nosice`), the medians added up to 2 001 ms, no category took 600 ms or more, and the slowest single
pass took 230 ms; the first request took 20 to 40 ms, the second 26 to 208 ms. `stresne-nosice`, `default-category`
and `autochladnicky` (the three slowest) were asked ten times each, one second apart: the slowest of those repeats
took 292 ms (`stresne-nosice`). Asked at once, each category on its own connection with its two requests one after the
other, the six slowest took at most 360 ms and the twelve slowest, which is twelve requests in flight (as many as the
queue in `graphql.ts` has slots), at most 418 ms, against the page's deadline of 1 500 ms. For comparison, the request
for the first product in all twelve markets, which the page never sends, still took 897 to 1 223 ms for `nosice-lyzi`,
`autodoplnky` and `default-category`, categories that hold a product in at most one market: the case the first request
keeps out of the second.

**What this does not cover.** A category translated in many markets and stocked in few puts the empty markets into
the second request, 80 to 100 ms each; with every market translated and one stocked that is the 1.1 s above, inside
the deadline and, past it, a page that names only itself. None of the 32 categories has that shape today. The list
read behind the sitemap and the menus (`SitemapCategories`, 0.5 to 0.7 s per market, the failures above) is not
changed: the third run read it with the translated markets first and the stock second and got 0.33 s for `ro-ron`
and `it-eur` against 0.54 and 0.67 s for the count, and no gain for `sk-eur` (0.67 against 0.65 s). That is a separate
change, to be made if the failures there continue.

**How to read the result.** Count the `[upstream-error]` lines per scope, not `[assortment]`: `sitemap-categories`
with and without `"queueStarved":true`, `category-presence`, `product-presence`, and the `[queueStarved]` marker on
`category navigation unavailable`. The number to compare is `sitemap-categories` lines per day, counted from a known
point of the log (it carries no timestamps): 24 in the first 24.5 h after PR 46 went live. Under the build that
carries PR 57 (live since 08:38 UTC on 20 October) the server counted 2 of them by 13:41 UTC, both `ro-ron`, written
between 12:46 and 13:24 UTC and none before, next to 136 `[assortment]` lines and two `CategoryNavigation: deadline
exceeded` lines for `stresne-nosice`, none with the sentence about waiting for a Saleor slot (the server's count of
its error log, not checked from here). If the count does not fall and the lines are not `queueStarved`, the trigger is
the re-read of the list after each catalogue event, and the next step is to refresh the list in the background with a
longer deadline and not to expire it at once; this change does not do that.

## 8. The product shards: why a cold one took 18 seconds, and what keeps it from being cold (2026-10-30)

**What was seen.** On the box, `/sitemap.xml` answered in 0.8 s and `sk-products-1.xml` (6.3 MB) in 17.9 s cold. The deploy
of PR 73 timed out three times on the check that reads that shard (`urlopen`, 60 s). The log carried
`[upstream-error] SitemapCategories: deadline exceeded` for `sk-eur`, `hu-huf` and others.

**Why a shard was slow.** A product shard is built from a walk of the whole Saleor catalogue, 92 to 120 pages of 100
products read one after another (a cursor connection cannot be read in parallel): ~18 s for Slovakia, ~14 s for a foreign
market, whose pages also carry every translation the exact-locale boundary reads (0.5 to 1 MB a page). The walk was held
by Next's data cache under the tag `sitemap:{channel}`, and three things made that cache the wrong place for it:

- `/api/revalidate` expires the tag **immediately** on every product, category and translation event of the channel, so
  the first crawler after an event paid the whole walk again, in front of the crawler.
- The entries are memory-only (`cache-handler.mjs`). Twelve markets of 0.5 to 1 MB pages are about a gigabyte against a
  256 MB LRU that every rendered page shares: they were evicted before they were reused, and they pushed pages out
  (CLAUDE.md §13.3.1 already named "keep the large `sitemap` responses out of the shared LRU" as the first thing to try).
- A crawler asking for all shards, or the deploy gate reading all 36 one after another, starts up to twelve walks at once,
  which is every Saleor slot (`maxConcurrent` 12 in `graphql.ts`); a page render and the deploy's own check queue behind
  them. That is how a 18 s read becomes a 60 s one right after a restart.

Not the cause: Saleor's speed (a page of the walk is ~0.15 s), the size of the shard (6.3 MB is far under Google's 50 MB
and 50 000 URLs; it is built in memory and serialised in milliseconds once the list exists) and the index
(`/sitemap.xml` is one count per market).

**What changed.** `src/lib/seo/sitemap-snapshot.ts` keeps the walk's result (a slug and a date per product) per channel
and language in the process, and `src/lib/seo/product-walk.ts` is the walk behind it.

- A shard is answered from the kept list at once, whatever its age. A list older than an hour, or one a catalogue event
  came after (and at least five minutes old: a CFM publish is hundreds of events, one rebuild covers them), is rebuilt in
  the background and replaces the old one only when the walk is complete. A failed rebuild keeps the old list and waits a
  minute; a list older than a day is not served unless a rebuild succeeds, so a catalogue that cannot be read for a day is
  an error and not last week's list. A short list is still never served.
- Rebuilds run two at a time, not twelve, and outside the request that started them (`runDetached`).
- The walk no longer goes through the data cache (`cache: "no-store"`), so it does not fill the LRU.
- The process builds every live market's list at boot (`prewarmProductWalks`, called from `instrumentation.ts`, about a
  minute of two connections), so the first crawler and the deploy's check usually find them ready. `MAKY_SITEMAP_PREWARM=0`
  switches it off.
- The index counts from the kept list when there is one (no count query and no page), and plans from the count as before
  when there is not.
- `/api/revalidate` marks the channel's list due (`markSitemapStale`) next to the tag it already expires, which still
  serves the categories, the count and the index's first page.

**What it does not change.** The first walk in a process (right after a start, until the boot warm-up has reached that
market) still takes 14 to 18 s, and a request that arrives then joins it. `SitemapCategories` read by the header
(`market-assortment.ts`, 1.5 s deadline) is untouched: the sitemap's `pages` shard reads the same list without a deadline.
The deploy script's `urlopen(timeout=60)` is untouched.

**How to read the result.** After the deploy: the `[sitemap] warm-up: N of 12 product lists built in S s` line at boot;
the nginx `request_time` of `/sitemaps/*-products-1.xml`, which should be tens of milliseconds from the first request
after that line; and the count of `[sitemap] … rebuild failed` lines. Whether Googlebot and Bingbot ever gave up on a cold
shard is not in anything read from here (Search Console's Sitemaps report would say "Couldn't fetch"); Bing's traffic was
healthy at the last reading (952 requests in 40 hours, 936 of them 200, reading the shards).
