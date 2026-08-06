# Market launch — what `live` means, and how to get there

Companion to `seo-hard-404-analysis-20260806.md`. That document explains why the
status code has to move to the proxy. This one is the operational half: how a
market goes from "we know the slug" to "Google may index it".

---

## 1. The three facts, kept separate

| | Where it lives | Question it answers |
|---|---|---|
| **routable** | `src/lib/channel-map.ts` | Do we recognise `/de` as a URL prefix? |
| **live / preview** | `src/lib/market-state.ts` | May a crawler index it? |
| **sellable** | Saleor + Stripe + shipping config | Can someone actually buy? |

They used to be one fact, which is why twelve markets currently answer
`index, follow` with a self-canonical while eleven have no catalogue.

**`preview`** — reachable at its URL, `noindex, nofollow`, absent from the
sitemap, absent from every hreflang cluster. This is a tool, not untidiness: it
is what lets you switch a channel on in Saleor, import products and translations,
and check the result on production with real data, days before a crawler sees it.

**`live`** — in the sitemap, in the hreflang cluster, `index, follow`.

Default is `sk` alone. Everything else is `preview` until you say otherwise.

---

## 2. Flipping a market

No rebuild. Set the env var and restart:

```bash
MAKY_LIVE_MARKETS="sk,cz"
```

```bash
pm2 restart maky-storefront --update-env
```

Deliberately **not** a `NEXT_PUBLIC_` variable — those are inlined at build time,
which is the rebuild this is designed to avoid.

Guards, so a mistake here cannot take the site down:

- names that are not markets are dropped, with a warning in the PM2 log
- an override that resolves to nothing falls back to `sk` — a typo must never
  `noindex` the whole site
- order follows `CHANNEL_MAP`, not what you typed, so the sitemap and the
  hreflang cluster are stable across restarts

Verify after the restart — note it is a response **header**, not a meta tag:

```bash
curl -sI https://maky.store/cz | grep -i x-robots-tag
```

```bash
curl -s https://maky.store/sitemap.xml | grep -c '/cz'
```

### What follows the env var immediately, and what waits for a deploy

| | when |
|---|---|
| the `noindex` header | **instant** — decided in the proxy, per request |
| the sitemap | **instant** — a dynamic route, re-read per request |
| hreflang | **at the next build** |

hreflang is emitted from `generateMetadata`, which under `cacheComponents` has no
request-time input and is baked into the prerendered shell. This was measured, not
assumed: the first attempt put the `noindex` in metadata too, and with
`MAKY_LIVE_MARKETS="sk,cz"` the sitemap picked `cz` up on the next request while
`/cz` went on serving the `noindex` from build time. That is why the header exists.

The asymmetry is safe in the direction that matters. **Promoting** a market by env
reveals nothing prematurely — hreflang simply stays quiet until the next deploy, a
missing annotation rather than a wrong one. **Demoting** is instant for the header
and the sitemap, but a hreflang cluster baked while the market was live keeps
naming it, so follow a demotion with a deploy.

---

## 3. The checklist

A market goes `live` when every line is true. It is a checklist, not a date.

### Blocks selling — nothing to do with SEO, but do not go live without it

- [ ] products assigned to the channel, with prices in that currency
- [ ] shipping zones configured for the destination country (today only `sk-eur`
      has any; without it checkout cannot complete)
- [ ] Stripe configured for that channel — the Stripe App is mapped to `sk-eur`
      and nothing else, so payment on `/de` will not complete today
- [ ] cross-border VAT confirmed with the accountant before the first order from
      that country, not after — distance selling over the EU-wide threshold means
      destination-country rates and an OSS registration

### Blocks indexing — this is the SEO gate

- [ ] catalogue is not empty in that channel
- [ ] product names and descriptions translated (a Slovak name under
      `hreflang="de-DE"` is not thin content, it is *wrong* content, and Google
      applies that judgement to the whole domain, not the page)
- [ ] category names translated
- [ ] **the UI message file is complete.** Measured on `a5e5ff3`, unrelated to
      any change here: `en-CA.json` is missing **211 of 437 keys** against
      `en-US.json`, while the other eleven files are identical. next-intl is not
      type-augmented, so a missing key fails silently at runtime rather than at
      build. Harmless while `ca` is `preview`; a blocker before it goes live.
      Re-run the parity script in CLAUDE.md §11 before flipping any market.
- [ ] the seven legal pages exist for that market — VOP, reklamácie, odstúpenie,
      ochrana údajov, cookies, doprava a platba, kontakt. Today they are Slovak
      only and `notFound()` for every other channel. Selling into DE on Slovak
      terms is a compliance problem before it is an SEO one.
- [ ] navigation links only categories that hold products in that channel
- [ ] the 404 gate is live (see §5) — see the warning below

### Order

Turn the market on as `preview` first. Import, translate, configure, check on
production. Flip to `live` last. There is no reason to do it in the other order
and one good reason not to.

---

## 4. Ground truth — what is actually built

Read this before assuming anything downstream is safe.

| | state | notes |
|---|---|---|
| dotted-path matcher fix | **DONE** | `5e85cff` |
| market state (`live` / `preview`) | **DONE** | `cd301c5`, `eb8d031` |
| sitemap follows live markets, fails loud | **DONE** | `cd301c5` |
| empty-category `noindex` | **DONE** | `cd301c5` |
| preview markets direct-access only | **DONE** | |
| durable + validated live-market config | **DONE** | |
| **data semantics** (`found`/`not-found`/`upstream-error`) | **NOT DONE** | prerequisite for the gate |
| **route classifier + curated market policy** | **NOT DONE** | |
| **localized market-aware 404** | **NOT DONE** | |
| **hard-404 gate** | **NOT DONE** | ships OFF, activated separately |

**`/sk/neexistujuci-produkt` still returns HTTP 200 + `noindex`.** Nothing on this
branch changes that yet. The soft-404 that started this work is still there; what
has changed is the surface it applies to, and the fact that turning it into a real
404 is now a matter of finishing the remaining four rows rather than redesigning
anything.

### Still to write

- navigation filtered by per-channel product count
- `public/llms.txt` still says Slovakia is the only stocked market — prose, so a
  content edit, but it lives in the repo rather than the CMS

### Content — yours

- translations, product data, prices, channel listings
- localized legal pages in Payload
- shipping zones, Stripe, VAT

---

## 5. The warning that matters

**Twelve indexable markets without the 404 gate is a worse state than one
indexable market without it.**

Today the soft-404 surface is one market. After the flip it is twelve, and the
missing-resource pages under each of them will answer HTTP 200. Indexed junk
takes months to clear, not days.

So the sequence is not negotiable:

```
matcher fix  ──▶  market state  ──▶  data semantics  ──▶  route classifier
   DONE              DONE              NOT DONE            NOT DONE
                                            │
                                            ▼
                             404 gate  ──▶  flip markets to live
                             NOT DONE
```

Code and content can run in parallel. They have to meet in that order.

The dotted-path fix and the market-state layer are already in; the gate is the
one still outstanding, and it is gated on measuring today's 404 rate per market
so there is a baseline to alarm against.
