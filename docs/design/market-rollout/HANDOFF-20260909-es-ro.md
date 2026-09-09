# ES/RO — handoff

Spanish and Romanian legal copy, implemented from the delivered package. Branch-only.
Nothing is deployed, published, sellable or indexable, and this document does not make it so.

## Where it is

|                            |                                                                   |
| -------------------------- | ----------------------------------------------------------------- |
| Branch                     | `claude/maky-store-es-ro-impl-c025ae`                             |
| Base                       | `b34927a` — the IT/FR tip (`claude/maky-store-it-fr-impl-f1125b`) |
| Last implementation commit | `9dedb63`                                                         |
| Documentation commit       | written after `9dedb63`; a document cannot record its own hash    |

The base needs one word of explanation. The starting prompt named
`55a3d48f68161c9e2f76519e1c8f53a5b5a8f3b4` as the browser-verified IT/FR HEAD. By the time
this thread ran, `git ls-remote` showed that branch at `b34927a` — two commits further on
(`8f84ed0`, the Italian and French VAT bans; `b34927a`, the ES/RO entry point). `55a3d48`
is an ancestor of `b34927a`, so nothing diverged and no work was lost; this branch
fast-forwarded to the newer tip rather than to the SHA in the prompt. No reset, no rebase,
no force.

| Commit    | What                                                                  |
| --------- | --------------------------------------------------------------------- |
| `fca5990` | Spanish and Romanian bodies for the seven static pages                |
| `3ffe6c6` | Register `es`/`ro`; move the negative fixture to `us`/`ca`            |
| `9dedb63` | `copy-es.ts` / `copy-ro.ts`, prepared but not wired, plus their guard |

## State, reported separately

| State            | ES  | RO  | Note                                                           |
| ---------------- | --- | --- | -------------------------------------------------------------- |
| CONTENT_PREPARED | ✅  | ✅  | Delivered package, manifest 86/86 verified                     |
| CONTENT_REVIEWED | ✅  | ✅  | By the package author; not an independent legal certification  |
| ROUTE_READY      | ✅  | ✅  | 8 static routes per market, all 200 from a real build          |
| CMS_PUBLISHED    | ❌  | ❌  | `o-nas` is M's. Bodies handed over in `es-ro/o-nas.{es,ro}.md` |
| BACKEND_READY    | ❌  | ❌  | Returns V2 pins `market: "SK"`. Copy prepared, unwired         |
| DEPLOYED         | ❌  | ❌  | Branch only                                                    |
| SELLABLE         | ❌  | ❌  | K owns prices, VAT, shipping, Stripe                           |
| INDEXABLE        | ❌  | ❌  | Proxy sets `noindex, nofollow` on every non-`sk` market        |

Noindex is not a block on buying, and the number of offline checks in the package is not
evidence about this implementation. The package's own 543 checks and 111 preview checks
are about the editorial bundle; everything below is about the Next.js app.

## Gates — run, with results

| Gate                  | Result                                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle validator      | 543 passed / 0 failed; manifest 86/86 SHA-256 verified independently                                                                                                    |
| `tsc --noEmit`        | clean                                                                                                                                                                   |
| `eslint`              | clean                                                                                                                                                                   |
| Tests                 | **1712 passed**, 9 skipped (1698 before + 14 new)                                                                                                                       |
| i18n 12-locale parity | all 12 identical, 637 keys, missing 0 / extra 0                                                                                                                         |
| Build                 | `npx next build` clean, BUILD_ID `Z9ClKe0uf7e6PDvuiCuTo`                                                                                                                |
| URL matrix            | **80/80** static URLs return 200 (8 routes × 10 legal markets)                                                                                                          |
| CMS page              | `/sk/o-nas` 200; `/es/o-nas` and `/ro/o-nas` 404 — correct, still sk-only                                                                                               |
| Negative control      | `/us/*` and `/ca/*` 404 on all four probes, with `x-robots-tag: noindex`                                                                                                |
| Regression            | **64/64 identical** — eight existing markets × eight routes, byte-for-byte on title, h1, canonical, lang, robots, description, form/submit counts and full visible text |
| Submit capability     | With `WITHDRAWAL_BACKEND_LIVE=true`: `sk` 3 forms / 1 submit, **all nine other markets 2 / 0**                                                                          |
| Viewport              | 360 px and 1280 px, eight screenshots, `scrollWidth == clientWidth` on every one                                                                                        |
| TXT vs print          | `SPANISH_TEXT` and `ROMANIAN_TEXT` byte-identical to the delivered `.txt` files                                                                                         |

The regression compared rendered output, not source. The extractor was checked against a
known page first, so 64/64 is not the vacuous pass an empty extraction would produce.

The two search forms present on every market are the header and footer search — which is
why submit capability, not `<form>` count, is the measurement.

## What was verified about the copy itself

- **Spain's three clocks stay three clocks**: three years for a lack of conformity to
  appear, a two-year presumption it existed at delivery, five years' prescription from
  when it appears. The Slovak two-year rule is not substituted, and the page says so.
- **Romania's 15 calendar days** for repair or replacement, and the **separate** 30-day
  early-non-conformity replacement right, are distinct and neither is confused with the
  30-day withdrawal benefit. The copy explicitly refuses to use the Slovak 30-day repair
  rule to overrun the Romanian cap.
- **Currency does not cross**: ES says `euros (EUR)` and never mentions RON; RO says
  `lei românești (RON)` and never mentions EUR.
- **Romanian diacritics**: zero cedillas in the rendered output, in `copy-ro.ts`, and in
  the printable form. Now guarded by a test, because nothing else in the toolchain looks.
- Titles carry ` | MAKY.STORE` exactly once on all 80 URLs.
- Three withdrawal states agree: the page body, the terms §6 paragraph and the metadata
  description all describe the preview state, and the description never claims an online
  function.

## Open items, by owner

**M**

1. **Spain's online-withdrawal duty is unresolved** — see `es-ro/PREFLIGHT.md`. Romania's
   is established (OUG 18/2026, in force 19 June 2026); Spain's transposing instrument was
   not. Do not settle it by analogy to Italy, and do not read the missing citation as
   "nothing is required".
2. **`o-nas` for both markets** — bodies are in `es-ro/o-nas.es.md` and `es-ro/o-nas.ro.md`.
   `CMS_PUBLISHED` stays ❌ until Payload holds them.
3. **`<html lang>` is hardcoded `sk` on every market.** Confirmed still true on this branch
   at `/es/*` and `/ro/*` — and equally true on the base, so it is pre-existing and not an
   ES/RO defect. It was recorded in the PL/HU handoff and is still open.
4. **Spanish autonomous communities have their own consumer authorities** alongside the
   national ones. The delivered copy names AEPD and the Centro Europeo del Consumidor and
   no regional body. Per `ZADANIE.md` that is an open item to record, not a gap to fill —
   nothing regional was invented.
5. Romanian provisions effective **27 September 2026** (green transition, harmonised
   guarantee information) are a joint M/K item for a release after that date.

**R**

1. `copy-es.ts` and `copy-ro.ts` are prepared and unwired, guarded by `copy-es-ro.test.ts`.
   Wiring needs Returns V2 to accept the market — `contract.ts` pins `market: "SK"` and
   `locale: "sk"` as literal types. **Never submit `es` or `ro` as `market: "SK"`.**
2. `privacyHref` and the `formExtras` block exist in the delivered JSON but are not fields
   of `WithdrawalCopy`. They were deliberately not bolted onto a shared type this thread
   does not own; they are in the package at `data/ui.{es-ES,ro-RO}.json`.
3. **Times are not a project.** The storefront prints no time at all: `WithdrawalV2Accepted`
   carries no timestamp, `withdrawal-form.tsx` renders none, and `formsTimestampSeconds()`
   is the HMAC replay window, not a business time. Both time labels are dormant in every
   language including Slovak. At integration, an ordinary check that Payload's confirmation
   prints the sending time is enough. No new timestamp model, no millisecond research.
4. The delivered e-mail templates are in `es-ro/email-*.{es,ro}.txt`, and the package's own
   Returns V2 notes in `es-ro/HANDOFF_RETURNS_V2.md`.

**K**

Prices, VAT, shipping availability per address, Stripe. ES is EUR, RO is RON. Cross-border
is prepaid with no cash on delivery. Nothing here changes Saleor, Stripe or any market flag.

## ⚠️ For the US/CA thread: the negative fixture has run out of road

Five assertions across four files stand for "a market with no approved copy still 404s".
The relay went `de` → `pl` → `it`/`fr` → `es`/`ro` → **`us`/`ca`**, and `us` and `ca` are
the last two uncovered markets in `CHANNEL_MAP`. There is nowhere to move them next.

So the next thread cannot do what the last four did. Deleting the list leaves five green
tests looping over nothing; adding a market that has copy inverts what they check. The
assertion has to be **rethought**, and the obvious shape is a synthetic channel wired into
a test-only map — testing the mechanism ("a market absent from `APPROVED_COPY` 404s")
instead of borrowing whichever real market happens to be untranslated this month. That is a
design decision for that thread. It must not be settled by quietly emptying an array.

The exact places, as they stand on this branch:

```
src/lib/route-policy.test.ts     NO_COPY = ["us", "ca"]        + WITH_COPY now 10 markets
src/proxy.test.ts:231            ["us", "ca"]
src/proxy.test.ts:260            /us/kontakt  (noindex)
src/proxy.gate.test.ts:287       /us/kontakt
src/lib/legal/legal-route.test.ts  legalLocaleFor("ca-cad") — NOT "us-usd", which is the
                                   very next line and would have made it a duplicate
```

Falsified before being trusted: adding `us: "sk"` to `APPROVED_COPY` turns exactly six
tests red across those four files — the same signature IT/FR produced by adding `es`.

## Deviations from the delivered package

1. **Recipients table is two columns for ES/RO** — as delivered. `RecipientsTable` emits
   the basis cell only for languages whose copy has one; the seven older tables are
   unchanged. See `PREFLIGHT.md`.
2. **The SOI block uses the shared component**, so its link text is `www.soi.sk` rather than
   the delivered "Web oficial de SOI" / "Site-ul oficial SOI". The address, department and
   URL are identical; only the anchor text differs, and it is shared with eight other
   languages.
3. **The system names in the recipients table are not translated** — `Saleor (api.maky.store)`
   rather than the delivered "Saleor, en api.maky.store". They are system identifiers shared
   across all ten languages.
4. **The cookie marker was replaced** with `PrivacySettingsLink`, as instructed. Shipped
   verbatim it would have been a dead button on a page telling the reader to press it.

## How to reproduce

```bash
cd /opt/storefront/.claude/worktrees/maky-store-es-ro-impl-c025ae
node_modules/.bin/vitest run
node scripts/i18n/check-message-parity.mjs
NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/ \
NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur \
NEXT_PUBLIC_STOREFRONT_URL=https://maky.store npx next build
```

`pnpm build` fails in a fresh worktree on the prebuild codegen hook; `npx next build` skips
it when `src/gql/` exists. `src/gql/` and `src/checkout/graphql/generated/` are gitignored
and absent in a new worktree — copy them from `/opt/storefront` or run codegen. Serve with
`npx next start -p <free port>`, never with `-H 127.0.0.1` (redirect loop), and never build
in `/opt/storefront` itself (CLAUDE.md §13.1).
