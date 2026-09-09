# IT/FR — implementation handoff

Branch-only. Nothing was deployed, no market was made sellable, no indexing changed, no
live legal notice was submitted and no production configuration was touched.

## 1. Exactly what this is

|                         |                                                                               |
| ----------------------- | ----------------------------------------------------------------------------- |
| Branch                  | `claude/maky-store-it-fr-impl-f1125b`                                         |
| Base                    | `c9af777` — head of `claude/maky-store-pl-hu-impl-8dd394`                     |
| Last implementation SHA | `f064716` — the last commit that changes shipped code                         |
| Handoff commit          | `6c90255` — this document and the source for M and R; no code                 |
| Commits                 | `3aac356`, `f68f10e`, `c39d152`, `f064716`, `6c90255`                         |
| Package                 | `MAKY_STORE_IT_FR_preklad_a_implementacia_2026-09-09.zip`, SHA256 `0d22eae2…` |

**Why this base, and not the one the prompt named.** The prompt gave PL/HU `74a3709` as a
reference and told me to check the remote. `git ls-remote` put that branch at `c9af777`
(one commit further on — a docs commit), and the worktree I was handed started at `578c33b`
(`release/sk-cs-legal-20260908`). `578c33b` turns out to be an **ancestor** of `c9af777`,
so PL/HU already contains the whole SK/CS release plus DE/AT, PL/HU and the `legalRoute`
`heading` change. Taking `c9af777` therefore adds work rather than discarding any: my
branch fast-forwarded to it and had no commits of its own to lose. No reset, no force-push,
no old SK/CS/garage SHA re-attached.

**Production is untouched and unchanged.** Read from `/opt/storefront/.next/MAKY_DEPLOY_META`,
not assumed: `git_sha=578c33b`, `build_id=buJZ-9DFbOKS9s5akP4-n`, built 2026-09-08. My build
ran in this worktree only.

## 2. The eight states, reported separately

| State            | it                    | fr      | Evidence, or who owns the gap                                                                                              |
| ---------------- | --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| CONTENT_PREPARED | ✅                    | ✅      | 7 static pages + model form, from `pages/*.md` and `data/pages.*.json`                                                     |
| CONTENT_REVIEWED | ⚠️ package-level only | ⚠️ same | The package's own editorial review. No native-speaker or lawyer sign-off, and this thread adds none                        |
| ROUTE_READY      | ✅                    | ✅      | 64/64 static URLs HTTP 200 on a real build, one `<h1>`, correct canonical (§4)                                             |
| CMS_PUBLISHED    | ❌                    | ❌      | O nás is **M's**. `/it/o-nas` and `/fr/o-nas` are 404 by design; content is in the package at `interne/O_NAS_PRE_CMS.*.md` |
| BACKEND_READY    | ❌                    | ❌      | Returns V2 is SK-only. **R**                                                                                               |
| DEPLOYED         | ❌                    | ❌      | Branch-only                                                                                                                |
| SELLABLE         | ❌                    | ❌      | Prices, tax, shipping, Stripe per channel. **K** — and the online withdrawal function, see §5                              |
| INDEXABLE        | ❌                    | ❌      | Both carry `noindex, nofollow` from the preview-market gate. A separate SEO decision                                       |

Noindex is not a block on buying, and none of these follow from the other. In particular
ROUTE_READY is not SELLABLE: the pages serve correctly and the market still cannot lawfully
take an order until §5 is closed.

## 3. What is in the code

Two separate bodies per page, per market — Italian and French share no prose, exactly as
Polish and Hungarian do not, and unlike `de`/`deAt` which share one German text. There is no
`german-market.tsx`-style shared profile for them.

What they _do_ share is the company, which is what was asked: `companyInfo`, the address,
seat and SOI blocks, the recipients table, the storage inventory and the ADR block are the
existing shared components, extended by two languages. Three of them gained an optional
`country` so the new blocks can name Slovakia in their own language. No second seller
configuration exists.

One deliberate deviation from the delivered text: the package prints the IČO as `57704627`;
the code renders `companyInfo.ico`, which is `"57 704 627"`. Sharing the company config beats
matching the package's spacing, and `sk` renders the identical string.

Internal links all go through `marketHref`; a test forbids a hardcoded `/it/…` or `/fr/…`
href. No new language route slugs, no HUF/PLN, no cash on delivery, no 35 kg claim.

`h1` and `metaTitle` are mapped separately from the delivered JSON, using the `heading` that
`12e30e3` already added. No second helper was written. The title passed to `formatPageTitle`
has the ` | MAKY.STORE` suffix **stripped**, because that helper appends it — every one of the
64 URLs carries the brand exactly once.

Both terms pages keep all 10 sections and both privacy pages all 10, verified in the source
markdown and in the rendered code.

## 4. Gates actually run

| Gate                       | Result                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Package validator          | 328 passed / 0 failed / 0 warnings; manifest 84/84 — re-run, matched                                                                                         |
| `tsc --noEmit`             | 0 errors                                                                                                                                                     |
| `pnpm lint`                | 0 errors, 6 warnings (all pre-existing, none in touched files)                                                                                               |
| `pnpm test:run`            | **1698 passed**, 9 skipped (baseline was 1684 → 14 added)                                                                                                    |
| Key/variable parity IT↔FR | `ui` 79 = 79, `component-copy` 28 = 28, 0 template-token mismatches, no shared long prose                                                                    |
| E-mail template tokens     | identical between languages (11 and 8 occurrences)                                                                                                           |
| 12-locale message parity   | OK — 12 locales, 637 keys, identical                                                                                                                         |
| Real build                 | Succeeded, `BUILD_ID 5lzp3Zr_t3jZZBY9Ih3pR`, in this worktree                                                                                                |
| URL matrix                 | 64/64 supported URLs HTTP 200; **32/32 negative-control URLs 404** on `es`/`ro`/`us`/`ca`                                                                    |
| CMS control                | `/sk/o-nas` 200; the other seven markets 404                                                                                                                 |
| Regression vs the base     | **48/48 identical** — all six pre-existing markets, visible text + title + h1 + canonical + description                                                      |
| 360 / 1280 px              | 32 page/viewport combinations: no horizontal overflow, exactly one `<h1>`, all 8 tables inside scroll wrappers                                               |
| Print / TXT                | Served `.txt` byte-identical to the delivered `formulare/vzor-odstupenia.*.txt`; print media hides the form's own controls, identically to the `sk` baseline |

**Not run, and why.** No deploy, no PM2 change, no `.env` change, no Stripe, no HMAC, no live
submission, no paid audit, no CMS publish. No native-speaker or legal certification. The
staging build used three `NEXT_PUBLIC_*` values only — the API URL, default channel and
storefront URL, all already committed in `.env.example` and in `scripts/`. `NEXT_OUTPUT` was
left unset throughout.

**Falsification, because a green test that checks nothing is worse than no test.** Three
guards were deliberately broken and confirmed to fail, then restored: granting `es` legal copy
turned all six moved fixtures red; reintroducing the "two timestamps" wording failed the
acknowledgement guard; importing the prepared copy into `withdrawal-form.tsx` failed the
tripwire. The regression harness was checked the same way — pointed at `it`, it reports 8
differences, so 48/48 identical is a real result.

## 5. Open items, with an owner

### R — Returns V2

`copy-it.ts` and `copy-fr.ts` are **PREPARED and NOT WIRED**, generated verbatim from
`data/ui.{it-IT,fr-FR}.json`. Nothing imports them and a test enforces that. The contract
still pins `market: "SK"` / `locale: "sk"` as literal types.

- No new API field, enum or endpoint was invented from the Slovak file names.
- `privacyHref` and the whole `formExtras` block are in the delivered JSON but not in
  `WithdrawalCopy`. They are recorded here rather than bolted onto a shared type.
- **Timestamps: what this branch actually does is nothing, and that is the whole point.**
  An earlier draft of this section asserted that `submittedAt` "is the database write,
  which is neither sending nor receipt". That overclaimed — this repository cannot see
  what Payload sets it from, so the correct statement is that the storefront does not
  know and does not use it. Checked before writing this: `WithdrawalV2Accepted` carries
  no timestamp at all (`submissionNumber`, `duplicate`, `printConfirmationHTML`,
  `parcelSlipHTML`), `withdrawal-form.tsx` renders no time, and the only clock in the
  submit path is `formsTimestampSeconds()`, which is the HMAC replay window and not a
  business time. `submissionTimeLabel` and `receivedTimeLabel` are therefore both
  dormant labels for a UI that does not exist yet, in every language including Slovak.
- What R owns is one concrete thing, not a research task: the acknowledgement is rendered
  by Payload from the stored snapshot, and `acceptedBody` promises it will carry the date
  and time the notice was **sent**. Both statutes ask for that specific time. So when a
  market is wired, confirm the value Payload prints is the sending time and not something
  materially later, and label it accordingly. In normal operation the gap is sub-second
  and of no practical consequence; it only bites at a boundary, such as a notice sent just
  before midnight on the last day of the period. Do not mint a second timestamp in the
  storefront and do not fill `receivedTimeLabel` by copying another field — those are the
  two things that would turn a non-issue into a false statement.
- `unknownBody` points at no case-status view, because none exists.
- The four shipping states in `formulare/pokyny-podla-zvozu.*.json` (`self_shipping`,
  `quote_requested_only`, `collection_offered`, `not_specified`) are editorial. Mapping them
  to real stored events is R with K. Interest in a price is not an order, not an offer and
  not a completed transport.

Proven, not assumed: with `WITHDRAWAL_BACKEND_LIVE=true` on a real build, `sk` renders
**3 forms / 1 submit** and every other market including `it` and `fr` renders **2 / 0**. The
two remaining forms are the header and footer search boxes, which is why the negative proof
is submit-capability and never a `<form>` count. The global flag cannot open a foreign locale;
`servesOnlineFunction()` ANDs it with `legalLocaleFor(channel) === "sk"`.

Switching a market on also needs a **rebuild**: the body obeys the flag at request time via
`connection()`, but the metadata is baked at build time under `cacheComponents`. Confirm the
cache/build contract with M before flipping anything.

### M — integration, CMS, release

- **O nás** for both markets: `interne/O_NAS_PRE_CMS.{it-IT,fr-FR}.md` in the package. Until
  a document is published the route 404s, which is correct and is reported separately from
  ROUTE_READY.
- **`<html lang>` is hardcoded `sk` for every market** (`src/app/layout.tsx:22`). Pre-existing,
  confirmed still true on this build — all 64 URLs report `lang="sk"`. It belongs in the real
  root layout, not in a nested `<html>` inside a language body. Not touched here.
- **FR guarantee box — formal conformity is NOT certified.** § 7 of the French terms carries
  the complete box in MAKY's own words. Covering the same ground as the model in Annexe A to
  article D211-2 is not formal conformity with it. Choosing the model that fits the goods
  actually sold, and settling the box's formal shape, must be closed before the terms are
  published for real selling. Flagged in a comment at the point of use so it cannot vanish
  under "texts are done".
- **FR out-of-court dispute resolution.** SOI is kept as the seller's ADR body and CEC France
  is offered as cross-border assistance — with the copy saying plainly that CEC is not a
  mediator and that approaching it does not by itself suspend any time limit. Evidencing which
  ADR route is actually competent for a Slovak trader and a French consumer, with the
  mandatory contact details under L612-1/L616-1, is open. **No MAKY membership of any French
  mediation body is claimed, and none may be invented.**

### K — commerce

Prices, VAT, shipping methods and Stripe per channel; oversized return and re-delivery costs
before an order can be taken.

## 6. The fixture that had to move, and did not get deleted

`it` and `fr` were the standing "market with no approved copy" fixture in six assertions
across four files. Both now have copy, so all six would have passed while checking nothing.
They now name `es` and `ro`. The relay is `de` → `pl` → `it`/`fr` → `es`/`ro`, and it is
recorded in the comments.

`route-policy.test.ts` also now records that `ca` carries the role in `proxy.test.ts`, so
whoever adds English can see that both files run out of uncovered markets at the same moment —
at which point the assertion needs rethinking, not quiet deletion.

One guard changed subject rather than scope. The h1/title check asserted **per page** that
kontakt and cookies carry no `heading` — true only because, under the languages approved then,
`h1` and `metaTitle` happened to coincide there. The delivered Italian and French copy
distinguishes them (`Contatti` / `Contatti e assistenza`), so a per-page assertion would have
forced a choice between deleting the guard and refusing the delivered copy. It now asserts
**per locale entry**, which is what it always meant, and still pins that sk, cs, de and at
carry no heading at all.

## 7. Legal points this thread did not invent

Both markets have required an online withdrawal function since **19 June 2026** — Italy via
art. 54-bis Codice del consumo (D.lgs. 209/2025 art. 4), France via art. D221-5 (décret
2026-3 art. 20). The preview state is therefore a gap for R and M to close, not a settled
position, and `noindex` does not address it: the duty attaches to serving those consumers.

Italy keeps the Slovak 30-day remedy rule with its objective-cause exception, and separately
names the 26-month period for bringing an action — which is not the same thing as the two-year
period within which a defect must appear. France does **not** get that exception: its
conformity remedy is capped at 30 days from the request and the copy says outright that the
Slovak carve-out is not raised against it. `rétractation`, `résolution` and `résiliation` are
kept distinct throughout, and a test enforces it in the prepared form copy.
