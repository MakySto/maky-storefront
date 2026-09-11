# Content-readiness, SEO availability and the Contact form

Written 11 September 2026, on top of the M3 handoff. Branch-only. Nothing is deployed,
published, sellable or indexable, and this document does not make it so.

## Where it is

|            |                                                                                     |
| ---------- | ----------------------------------------------------------------------------------- |
| Branch     | `claude/maky-store-integration-abcd-4e54c6`                                         |
| Base       | `2f8aed0` — the reference SHA, confirmed on the remote                              |
| Commits    | `cc7d2ab` 2A · `005ef58` 2B · `9e9a7cc` 2C · `4aa2324` contract · `52195c3` Contact |
| Tests      | **1884 passed**, 9 skipped                                                          |
| Regression | 96 routes vs `2f8aed0`, one explained change                                        |

Provider artefacts, both verified against the SHAs P reported:

|                                      |                                            |
| ------------------------------------ | ------------------------------------------ |
| P0 `codex/o-nas-provider-handoff`    | `daf94f3e23c1a9ce8f0e6336ec687ccf4ce02bb6` |
| P1 `codex/contact-provider-delivery` | `f2b8163ce9aa148007f1e1026e0858eadc4db370` |

The Payload machine's filesystem is not reachable from this box; the artefacts came
from GitHub, read-only, and both branch tips matched P's report exactly.

## ⚠️ First: a production write I made, and did not intend to

The brief asked me to establish where previous mutations went. They went to production.

The M3 journey walkthrough clicked "Pridať do košíka" against a local `next start`
configured with `NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/`. There is
no sandbox guard in the code — `checkoutCreate` is a real mutation and it ran against
the live Saleor. So **one or more draft Checkout objects exist in production Saleor**,
on `sk-eur`, containing one line of the Peruzzo adapter.

What it is not: not an order, not a payment, no stock reserved, nothing charged. A
Saleor checkout is a draft cart. I never reached the payment step.

I have **not deleted anything** — the brief says not to tidy production records away,
and I agree: a silent cleanup would destroy the evidence of what happened.

Everything in this session used either a local mock or an isolated fixture. No further
mutation was sent anywhere. Before the next add-to-cart or form test there should be
either a sandbox Saleor or a code-level guard; I would not rely on remembering.

## 2A — a published page with no body for this market

`parsePagesResponse` filters `layout[]` by market and then reports `ok` whatever is
left, including nothing. `fetchCmsPage` turned that into `found`, and the route
rendered an `<h1>` plus the company block and called it a page.

Reproduced on the reference SHA with **P's four synthetic fixtures**, all four checksums
verified independently: `ok`, `layout: []`, rendered.

It is reachable exactly through the two shared-locale pairs, which is why it survived
M2. DE and AT both read `de`; a document carrying only the Austrian paragraph answers a
German request with a page-level "yes" and no German text. Same for US/CA on `en`.

Now an authoritative absence — 404, `noindex`, no canonical, out of navigation, the
sitemap and hreflang — and never the Slovak bootstrap, because an absent German
paragraph is not an outage. It logs `[cms] content-not-ready` under its own name: "is
the CMS down?" and "did someone forget the German paragraph?" are different questions.

The rule is deliberately narrow. It sits beside the route rather than inside
`parsePagesResponse`, and names `o-nas` alone — the only slug with a body contract.
`poradna` shares the factory and is excluded.

> My own market fixture used `hero` blocks, which the new rule correctly rejects: the
> contract requires a `richText` body. The fixture was unrealistic; it is now
> `richText`, and the rule was not weakened to accommodate it.

## 2B — the sitemap and hreflang follow publication

Both read `route-policy` alone, which answers "does this market support the route", not
"does it serve one". So an unpublished page kept its sitemap entry and its hreflang
alternate while the navigation correctly dropped it — and hreflang is the more expensive
mistake, because a non-reciprocal annotation gets the whole cluster discarded rather
than the bad entry.

Both now use the same cached read the page and navigation use, keyed by (slug, locale)
and carrying `cms:page:<slug>`, so one webhook invalidates all of them together.
`publishedCmsMarkets` asks only about markets the static policy already allows: one
question today, at most ten when all twelve open, because the shared-locale pairs
collapse. Not a second availability table, not twelve uncached requests per page.

> The sitemap test kept its own copy of `staticPathsFor`. A mirror agrees happily with
> a stale original, which is how the availability step could be added without a single
> test noticing. It calls the real function now.

## 2C — measured, and deliberately not changed

`/sk/o-nas`, real build per row, `.next/cache` cleared between runs:

| CMS answer            | HTTP | `robots`            | body served            |
| --------------------- | ---- | ------------------- | ---------------------- |
| published, with body  | 200  | `index, follow`     | the CMS document       |
| unpublished           | 200  | `noindex, nofollow` | not-found page         |
| market-mismatch       | 200  | `noindex, nofollow` | not-found page         |
| **content-not-ready** | 200  | `noindex, nofollow` | not-found page         |
| upstream 500          | 200  | `index, follow`     | the approved bootstrap |

Every page-level outcome is HTTP 200 — `cacheComponents` commits the status line before
any component's lookup resolves.

**The risky path does not exist today.** An already-indexed page answering `200 +
noindex` during a transient outage needs a market that has the route AND no in-code
bootstrap. With the CMS down, `/sk/o-nas` serves the approved bootstrap (200, no
noindex) and `/cz`, `/de`, `/us` get a **real 404** from the proxy before the CMS is
consulted. So this is a precondition on opening a market for a CMS route, not a live
defect, and it does not block staging work.

Three options with their real costs are in
`ANALYSIS-20260911-cms-outage-status.md`. Recommendation: make D-a (serve last
known-good) or D-b (`503` from the proxy, reusing the deployed gate pattern) a named
precondition recorded next to the `route-policy.ts` edit, so the two cannot be
separated. Neither is implemented; the brief asked for a measured proposal first.

> The measurement nearly voided itself: the fetch Data Cache survives a rebuild, so the
> first run showed all five modes returning the first mode's answer.

## O nás — what is and is not verified

P is explicit and correct: `CMS_STAGING_PUBLISHED = BLOCKED_ENV`,
`CMS_PROVIDER_STAGING_VERIFIED = NOT_RUN`, staging URL `null`. **There is no staging
provider to connect to**, so the joint lifecycle test cannot be run yet.

What was done instead: P's four negative fixtures are vendored and drive a consumer
test. They are labelled `synthetic-not-http-capture` by the provider and **this does
not upgrade that claim** — it is a consumer test against synthetic envelopes.

The approved content source (`o-nas.markets.json`, checksum `fccf5300…`, verified) was
deliberately **not** turned into a mock provider: it carries
`"notPayloadImportSchema": true` and is an editorial exchange format, not the REST
shape. Fabricating a provider from it and calling the result acceptance would prove
something about my transformation, not about Payload.

| gate                            | state                                                                       |
| ------------------------------- | --------------------------------------------------------------------------- |
| `CMS_CONSUMER_READY`            | ✅ — including content-not-ready, both shared-locale pairs, both directions |
| `O_NAS_STAGING_E2E_VERIFIED`    | **NOT_RUN** — no staging provider exists                                    |
| `CMS_AVAILABILITY_SEO_VERIFIED` | ✅ against fixtures; NOT_RUN against a provider                             |

## Contact — UI and BFF against contract 1.3.0

P's pack re-vendored, revision 1.1.0 → 1.3.0, 38 artefacts. The manifest SHA-256
matches P's reported value and the existing conformance test verifies every artefact
digest, so the bump is checked rather than asserted.

**The storefront reads the contract instead of restating it.** Endpoint, body limit,
clock skew, nine topics, two sources, twelve market/locale pairs — every constant is
read back out of the vendored manifest by the test and must agree with it. The signing
vector is reproduced three ways, including through the shared `signFormsRequest` the
transport actually calls.

| requirement                                  | how                                                                                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| no secret in the browser                     | Server Action, server-only path; **verified: no client chunk contains the secret or its name**                                      |
| market/locale from a trusted source          | derived from the route's channel; validated as a PAIR — `{DE, sk}` is two valid values and one invalid request                      |
| serialize once, sign and send the same bytes | one `JSON.stringify`, shared with the withdrawal path                                                                               |
| stable id across retries                     | minted once by the form, sent unchanged; no well-formed id ⇒ nothing filed                                                          |
| a timeout is not "nothing stored"            | classified `unavailable`; the UI says the message may already be saved and to retry, not to start again                             |
| truthful states                              | a confirmed persist says RECEIVED and shows the reference; it never says an e-mail arrived — both delivery channels start `pending` |
| rate limit, body limits, origin              | two buckets (IP, address) checked **before** validation; per-field bounds; the action's built-in Origin/Host check                  |
| input survives a failure                     | uncontrolled form, never reset; nothing to storage or the URL                                                                       |

**Default OFF in every market, including development.** `isWithdrawalFormServable()`
returns true whenever `NODE_ENV !== "production"`, which offers a live form on staging
without anyone choosing to; this does not copy that. `/kontakt` is untouched and still
renders in all twelve markets with the address, e-mail, phone and statutory
identifiers — only the form is gated, and its absence is logged with a reason.

The submission id is minted on the client, not the server: `randomUUID()` in a
prerendered Server Component is a build error under `cacheComponents`, and making the
page dynamic for it would be a large cost for a value that must be unique, not secret.

`CONTACT_UI_BFF_READY` ✅ · `CONTACT_STAGING_E2E_VERIFIED` **NOT_RUN** — no provider
was contacted.

## Gates

| Gate                    | Result                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`          | clean                                                                                                     |
| `eslint`                | 0 errors, the same 6 pre-existing warnings                                                                |
| `vitest run`            | **1884 passed**, 9 skipped                                                                                |
| i18n parity             | 12 locales, **715 keys, identical**                                                                       |
| `pnpm build`            | exit 0, with the prebuild hook                                                                            |
| Regression vs `2f8aed0` | 96 routes — title, canonical, lang, robots, description, h1 and footer **96/96 identical**; content 95/96 |

The single content change is `/sk/kontakt` gaining the form, in a build where the gate
was set to `sk`. **With the gate unset — the default — the form is absent in every
market and `/sk/kontakt` matches the base exactly**, measured on its own build.

### Falsified, not asserted

| deliberate defect                                 | result |
| ------------------------------------------------- | ------ |
| restore the pre-fix content-readiness behaviour   | 14 red |
| count chrome (an image, a CTA) as a body          | 2 red  |
| apply the body rule to `poradna` too              | 1 red  |
| sitemap ignores publication again                 | 1 red  |
| trust the form's `market` field                   | 1 red  |
| mint a fresh submission id when the form's is bad | 1 red  |
| return the provider envelope to the browser       | 1 red  |

### Two build failures the unit tests could not see

next-intl reads a dot as a namespace separator, so flat `topic.*` keys were missing at
render; and once nested, `t("topic")` resolved to an object. Both only appear in a real
build. Verified afterwards in a browser: every visible field has a `<label for>`, 360 px
and 1280 px free of sideways scroll, form present on `sk` and nowhere else.

## Still open

- **The joint staging lifecycle** — publish → update → unpublish → republish, cold and
  warm cache, both directions of DE↔AT and US↔CA — waits on a provider P can reach.
- **2C** must close before indexation opens for a CMS route.
- **Contact delivery** (`CONTACT_EMAIL_DELIVERY_MODE`, operator retry, alerting) is R's
  and P's; nothing here turns it on.
- **The rest of M3**: configurator year/generation/roof, Garage test-vs-save, PDP
  set/BOM and stock wording, a real sandbox checkout run.
- **A sandbox Saleor or a mutation guard**, before any further add-to-cart test.
- **D**, Returns, and the CFM export — unchanged owners.
