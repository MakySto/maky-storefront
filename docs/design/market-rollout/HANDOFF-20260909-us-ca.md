# US/CA — handoff

English legal copy for the United States and Canada, implemented from the delivered
package. Branch-only. Nothing is deployed, published, sellable or indexable, and this
document does not make it so.

This is the **last language pair**. After it, every market in `CHANNEL_MAP` has approved
legal copy — which is why the negative test fixture had to be rebuilt rather than moved,
and that is the one genuinely new piece of engineering here.

## Where it is

|                            |                                                                   |
| -------------------------- | ----------------------------------------------------------------- |
| Branch                     | `claude/maky-store-us-ca-impl-4bb201`                             |
| Base                       | `8bd1c6c` — the ES/RO tip (`claude/maky-store-es-ro-impl-c025ae`) |
| Last implementation commit | `07115e0`                                                         |
| Documentation commit       | written after `07115e0`; a document cannot record its own hash    |

The base was confirmed with `git ls-remote` at the start of this thread: the ES/RO branch
still stood at `8bd1c6c`, the SHA the brief named and the same one the bundle records as
its `referenceGitHubHead`. This worktree started at `578c33b`, an ancestor, so it
fast-forwarded. No reset, no rebase, no force.

| Commit    | What                                                                        |
| --------- | --------------------------------------------------------------------------- |
| `ccadc6f` | English bodies for the seven static pages, both markets                     |
| `e053fc9` | Register `us`/`ca`; rebuild the 404 fixture; ban the English VAT negations  |
| `07115e0` | `copy-en-us.ts` / `copy-en-ca.ts`, prepared but not wired, plus their guard |

## State, reported separately

| State            | US  | CA  | Note                                                           |
| ---------------- | --- | --- | -------------------------------------------------------------- |
| CONTENT_PREPARED | ✅  | ✅  | Delivered package, manifest 90/90 verified independently       |
| CONTENT_REVIEWED | ✅  | ✅  | By the package author; not an independent legal certification  |
| ROUTE_READY      | ✅  | ✅  | 8 static routes per market, all 200 from a real build          |
| CMS_PUBLISHED    | ❌  | ❌  | `o-nas` is M's. Bodies handed over in `us-ca/o-nas.{us,ca}.md` |
| BACKEND_READY    | ❌  | ❌  | Returns V2 pins `market: "SK"`. Copy prepared, unwired         |
| DEPLOYED         | ❌  | ❌  | Branch only                                                    |
| SELLABLE         | ❌  | ❌  | K owns prices, import costs, shipping availability, Stripe     |
| INDEXABLE        | ❌  | ❌  | Proxy sets `noindex, nofollow` on every non-`sk` market        |

Noindex is not a block on buying. The number of offline checks in the package is not
evidence about this implementation: the package's own 414 checks are about the editorial
bundle, and everything below is about the Next.js app.

## Gates — run, with results

| Gate                  | Result                                                                                                                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle validator      | 414 passed / 0 failed; manifest 90/90 SHA-256 verified independently; ZIP checked for traversal and symlinks before extraction                                                                                                                                         |
| `tsc --noEmit`        | clean                                                                                                                                                                                                                                                                  |
| `eslint`              | clean — 0 errors, 6 pre-existing warnings, none in a file this branch touches                                                                                                                                                                                          |
| Tests                 | **1731 passed**, 9 skipped (1712 before + 19 new)                                                                                                                                                                                                                      |
| i18n 12-locale parity | all 12 identical, 637 keys, missing 0 / extra 0                                                                                                                                                                                                                        |
| Build                 | `npx next build` clean, BUILD*ID `a*-uYacXvYrfzPXX58qIW`                                                                                                                                                                                                               |
| URL matrix            | **96/96** static URLs return 200 (8 routes × 12 legal markets)                                                                                                                                                                                                         |
| CMS page              | `/sk/o-nas` 200; the other **eleven** markets 404, `us` and `ca` included — correct, still sk-only                                                                                                                                                                     |
| Regression            | **80/80 identical** — the ten pre-existing markets × eight routes, on status, title, h1, canonical, lang, robots, description, form and submit counts, `x-robots-tag` and full visible text                                                                            |
| Submit capability     | With `WITHDRAWAL_BACKEND_LIVE=true`: `sk` 3 forms / 1 submit, **all eleven other markets 2 / 0**                                                                                                                                                                       |
| Viewport              | 360 px and 1280 px, ten screenshots, `scrollWidth == clientWidth` on every one, opened and read                                                                                                                                                                        |
| TXT vs print          | Both printable forms byte-identical to the delivered `.txt`, and neither carries the other market's line                                                                                                                                                               |
| Content rules         | 16 rendered pages scanned for "all sales final", "as is", restocking fees, arbitration, exclusive Slovak courts, COD, free shipping, a local warehouse, an unqualified "we never sell", and 14 days asserted as federal law — none found; required disclaimers present |

`pnpm build` is not what ran. It fails in a fresh worktree on the prebuild codegen hook, so
the build used `npx next build` with the three public env vars, which skips the hook when
`src/gql/` exists. That is a bypassed hook and is not called a standard build.

The 23 `[GraphQL] … Network error` lines in the build log are the known pre-existing
`cacheComponents` prerender aborts, not a fault of this change.

### The regression number is not vacuous, and the first attempt was

The first extractor scoped visible text to `<main>…</main>` and reported a **flawless
80/80 while extracting nothing from 50 of the 96 pages**. Under PPR the shell flushes with
only a Suspense placeholder and the body arrives later in the same response inside
`<div hidden id="S:…">` blocks. Comparing empty string to empty string passes.

It was caught by a sanity line printing the minimum compared text length, which read `0`.
The extractor now takes the whole document minus `<script>` and `<style>` — which also
drops the RSC flight payload, a second escaped copy of the same content that would
otherwise double-count every page. The harness now refuses to report at all if any 200 page
yields under 400 characters, and self-checks against a known long page before comparing
anything.

The final run compared **574,820 characters** of visible text across the 80 URLs, minimum
1,457 per page.

## What was verified about the copy itself

- **14/30 days stay a MAKY benefit.** Both markets' pages say in terms that this is our
  policy under the agreed Slovak framework and _not_ a claim that every US or Canadian
  online purchase carries a federal 14-day cooling-off period. The scan above checks for
  the assertion while excluding that denial, and was itself checked against both forms.
- **The FTC Cooling-Off denial appears on the US page only** (1 occurrence), and **Quebec
  appears on the Canadian page only** (1 occurrence). Neither leaks.
- **Currency does not cross**: `US dollars (USD)` twice on `/us/doprava-a-platba` and zero
  mentions of CAD; the mirror image on `/ca`. Header currency comes from `CHANNEL_MAP`.
- **The brand suffix appears exactly once** in the `<title>` of all 96 URLs.
- **Mandatory local rights are kept separate from the voluntary return** on every page that
  mentions both, and the manufacturer's warranty is stated as additional to — never a
  substitute for — the seller's responsibility.
- **The import undertaking is stated as ours**: customs clearance and import charges are in
  the quoted price with no doorstep surprise. The copy does not claim this has been proven
  end to end; that is K's item.

## Open items, by owner

**M**

1. **`o-nas` for both markets** — bodies are in `us-ca/o-nas.us.md` and `us-ca/o-nas.ca.md`.
   `CMS_PUBLISHED` stays ❌ until Payload holds them. The two are not interchangeable: the
   Canadian text says _travelling_ and _holiday_ where the US text says _traveling_ and
   _vacation_, and each links to its own market's pages.
2. **The privacy-settings control has three names.** The package calls it "Privacy choices"
   for the US and "Privacy preferences" for Canada; the footer renders "Privacy settings"
   in both English catalogues. The pages as implemented use the footer's real label, so
   nothing points at a control that does not exist — but one shared control being given two
   different names for two English markets is an editorial decision to make, not a bug to
   patch from here. The same mismatch already exists on the Spanish and Romanian pages,
   which name controls their footers also do not render; it was left alone.
3. **US state privacy scope is unresolved, deliberately.** The delivered copy conditions
   every state right on "the state law that applies and whether its coverage conditions are
   met". Closing the actual scope — which statutes apply, whether advertising transfers are
   a "sale" or "share", and whether a dedicated opt-out link or Global Privacy Control
   handling is required — is M's, and the page must not be read as having settled it. Do
   not add an unqualified "we never sell or share".
4. **Quebec is not banned and fr-CA does not exist.** The package is en-CA only and does not
   pretend to satisfy a French contract-language requirement. M owns the actual scope of the
   Charter of the French language §55 and the Consumer Protection Act rules, including the
   cross-border exceptions. An English checkbox does not resolve it.
5. **`<html lang>` is `sk` in the served HTML for every market — and this is more specific
   than previously recorded.** The root layout is static, so the response really does carry
   `<html lang="sk">` on `/us`, `/ca` and everywhere else; a client component,
   `HtmlLangUpdater`, then corrects it after hydration via `useEffect`. So a browser ends
   up with `lang="en"` on both English markets, and anything reading the raw HTML — a
   crawler, a `curl`, a validator — sees `sk`. It is pre-existing, equally true on the base,
   and untouched here. Note also that both English markets resolve to `en`, not `en-US` or
   `en-CA`, so the two are indistinguishable to a consumer of that attribute.
6. **CASL is not addressed by translation.** The delivered Canadian newsletter paragraph is
   the same as the US one. Real consent, identification and a working unsubscribe are an
   integration fact, not a copy fact.

**R**

1. `copy-en-us.ts` and `copy-en-ca.ts` are prepared and unwired, guarded by
   `copy-en-us-ca.test.ts`. Wiring needs Returns V2 to accept the market — `contract.ts`
   pins `market: "SK"` and `locale: "sk"` as literal types. **Never submit `us` or `ca` as
   `market: "SK"`.**
2. **Routine change-of-mind pickup is not offered for either market.** `showPickupInterest`
   is false in `form-capabilities.en-{US,CA}.json`. Do not render `pickupInterest` as an
   offer, and **do not record a customer's own shipment as `returnMethod: merchantPickup`**
   — that writes a false method into a legal record. `collection_offered` belongs only to a
   real, separately evidenced offer in a specific case; `quote_requested_only` promises
   nothing.
3. **Times are not a project.** The storefront prints no time at all: `WithdrawalV2Accepted`
   carries no timestamp, `withdrawal-form.tsx` renders none, and `formsTimestampSeconds()`
   is the HMAC replay window, not a business time. Both time labels are dormant in every
   language including Slovak. At integration, an ordinary check that Payload's confirmation
   prints the sending time is enough. No new timestamp model, and never fill
   `receivedTimeLabel` by copying another field.
4. `privacyHref` and the `formExtras` block are in `data/ui.en-{US,CA}.json` but are not
   fields of `WithdrawalCopy`, so they were not bolted onto a shared type this thread does
   not own.
5. The delivered e-mail templates are in `us-ca/email-{confirmation,internal}.{us,ca}.txt`,
   the four shipping states in `us-ca/shipping-states.{us,ca}.json`, and the package's own
   Returns V2 notes in `us-ca/HANDOFF_RETURNS_V2.md`. The internal authorisation link must
   never appear in a customer e-mail.

**K**

Prices, VAT, shipping availability per address, Stripe. US is USD, Canada is CAD, both
prepaid with no cash on delivery. The import undertaking — customs clearance and import
charges inside the quoted price, with no doorstep surprise — is the one commercial promise
the copy makes that only K can evidence; the text is not proof that it works. Quebec's
advance-payment rule points at credit card for covered distance sales, which is a
method-selection question for the existing Stripe integration and not a reason to disable
Canada. Product eligibility, regional versions, approvals and the territorial scope of a
manufacturer's warranty are open: a European catalogue is not automatically sellable in
North America. Nothing here changes Saleor, Stripe or any market flag.

## ⚠️ The negative fixture: what the next thread inherits

There is no next language pair, but there will be other work touching these tests, so this
matters.

Five assertions across four files stand for "a market with no approved copy still 404s, and
its 404 is not indexable" — the original bug, where `/de/kontakt` answered HTTP 200 with an
indexable Slovak `<head>` over a 404-ed body. They used to borrow whichever market happened
to be untranslated: `de` → `pl` → `it`/`fr` → `es`/`ro` → `us`/`ca`. **That relay is over.**

The fixture now synthesises a market in a test-only mock
(`src/lib/legal/uncovered-market.testkit.ts`). It re-derives `FRIENDLY_SLUGS`,
`SALEOR_SLUGS` and `REVERSE_MAP` — overriding `CHANNEL_MAP` alone leaves the derived sets
disagreeing with it, and the proxy gate reads the sets, not the map — and dependents are
re-imported under the mock because each caches its view of the market list at load. Nothing
synthetic was added to the production `CHANNEL_MAP`.

The genuinely unknown channel stays a separate case, because it fails at a different place:
`REVERSE_MAP` rather than `APPROVED_COPY`, and in the proxy the invalid-first-segment gate
rather than the missing-route gate. `gb-gbp` is used for it — a real channel until the en-GB
market was removed on 2026-07-20, so it is how this is actually reached.

Positive controls were added next to each negative one, because a synthetic case would
still pass if the policy 404-ed everything.

**Falsified in both directions, then restored and checksum-verified byte-identical:**

| Deliberate defect                         | Result                         |
| ----------------------------------------- | ------------------------------ |
| Grant the synthetic market approved copy  | 5 tests red across all 4 files |
| Revoke `us` from `APPROVED_COPY`          | 6 tests red across all 4 files |
| Each of the 8 new English VAT negations   | fires individually, 8/8        |
| Flatten Canadian spelling to American     | 2 tests red                    |
| Advertise a return pickup                 | 2 tests red                    |
| Import the prepared copy from `submit.ts` | 1 test red (the tripwire)      |

## Deviations from the delivered package

1. **The SOI block uses the shared component**, so its link text is `www.soi.sk` rather than
   the delivered "Official SOI website". Address, department and URL identical; only the
   anchor text differs, and it is shared with ten other languages. Same as ES/RO.
2. **The Slovak data-protection authority and the SOI ADR body are rendered as the delivered
   sentence, not as address blocks.** The delivered English copy gives a sentence with a
   link where the older languages give a full block; following the delivered copy means not
   using `Adr` and `DpaAuthority` on these two pages. Nothing was invented either way.
3. **System names in the recipients and storage tables are the existing shared identifiers**
   — `Payload CMS (cms.maky.store)`, `FedEx, Slovenská pošta`,
   `Google (Tag Manager, Analytics)`, `checkoutId-<kanál>` — not the delivered per-language
   spellings. They are shared across all twelve languages. Same as ES/RO.
4. **The storage inventory renders four columns and four rows**, like the other nine
   languages, where the delivered markdown used three columns and five rows. The shared
   `InventoryTable` carries the technology type as its own column and keeps the two Saleor
   tokens on one row with a combined duration. Same facts, different split; no content was
   added or dropped.
5. **The cookies page names the footer control "Privacy settings"** — what
   `footer.privacySettings` actually renders — rather than the delivered "Privacy choices"
   (US) / "Privacy preferences" (CA), which name a control the footer does not have. See
   `PREFLIGHT.md` §4 and M item 2.

## How to reproduce

```bash
cd /opt/storefront/.claude/worktrees/maky-store-us-ca-impl-4bb201
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint
node_modules/.bin/vitest run
NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/ \
NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur \
NEXT_PUBLIC_STOREFRONT_URL=https://maky.store npx next build
```

`pnpm build` fails in a fresh worktree on the prebuild codegen hook; `npx next build` skips
it when `src/gql/` exists. `src/gql/`, `src/checkout/graphql/generated/`, `node_modules`
and `.husky/_` are all gitignored and absent in a new worktree — copy them from
`/opt/storefront` (`node_modules` with `cp -al`, never a symlink) or run codegen. Serve with
`npx next start -p <free port>`, never with `-H 127.0.0.1` (redirect loop), and never build
in `/opt/storefront` itself (CLAUDE.md §13.1).

For the regression, build the base commit in a second worktree and diff the rendered output
of the ten pre-existing markets. Check the extractor against a long PPR page first — see the
warning above.

Local test runs are not GitHub CI. No production SHA or BUILD*ID is claimed here; the
`a*-uYacXvYrfzPXX58qIW` above is this branch's local build, not a deployment.
