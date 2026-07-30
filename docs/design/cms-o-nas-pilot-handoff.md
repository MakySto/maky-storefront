# CMS pilot `/sk/o-nas` — handoff

Status: **DEPLOYED to production 2026-07-30. Acceptance COMPLETE — step 7 passed twice, cache verified by measurement.**

```
production base   b6b633da6b4969967cdc3244b9eab2fce3a206ea   BUILD_ID JAODjLtaigo1DL9m6h614
rollback          007f75e6be3110ff3df26826b6ff9f95fdabbb32   BUILD_ID WRxB8lq9Ps8OmdZq-oBbR
downtime          53 s
```

`/sk/o-nas` is now served from Payload. The rollback build is retained as a hardlink at
`/opt/storefront/.next.rollback-007f75e-cmspilot`; restoring it is `rm -rf .next && cp -al
.next.rollback-007f75e-cmspilot .next && git checkout --detach 007f75e && pm2 restart
maky-storefront`, about fifteen seconds.

This document is the truthful record of what the pilot does, what it deliberately does
not do, and what has to be true before a second page follows it. Where it describes a
limitation, the limitation is real — none of it is worked around elsewhere.

## Cutover record, 2026-07-30

| Check                         | Result                                                                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CMS document cleaned          | 4 paragraphs, all 9 company-identity markers absent, `updatedAt` 19:26:24.111Z                                                                                                                                                                                     |
| Release candidate on `:3032`  | accepted before production was touched                                                                                                                                                                                                                             |
| Routes                        | `/sk`, `/sk/o-nas`, `/sk/obchodne-podmienky`, a real PDP — all 200 via Cloudflare                                                                                                                                                                                  |
| CSS / JS chunks               | 200, utilities present in the served stylesheet                                                                                                                                                                                                                    |
| `CompanyDetails`              | exactly once in the visible DOM; `IČO` once, seat once                                                                                                                                                                                                             |
| Secrets in HTML / RSC payload | none                                                                                                                                                                                                                                                               |
| `[cms] served`                | `outcome: found`, `documentId 019fb008-…`, `blocks 1`                                                                                                                                                                                                              |
| contract-violation            | 0                                                                                                                                                                                                                                                                  |
| **Step 7** — publish an edit  | run twice. Add: webhook `[cms-revalidate] ok` with tags `cms:collection:pages` + `cms:page:o-nas`, `updatedAt` `19:26:24.111Z` → `20:05:32.363Z`, new wording live. Remove: same, `updatedAt` → `20:53:35.835Z`, wording gone, `CompanyDetails` still exactly once |

### The stale-while-revalidate window, caught on production

The first two step-7 runs did not catch the stale first view: the background refresh had
already finished before the first measuring request, because the SWR window is one request
wide and the site has real traffic — including this session's own probes. That is a
measurement problem, not a fault, and it was recorded as such.

The third run caught it. Marek published without opening the page himself, so no request
had consumed the stale entry:

```
view 1  STALE   (previous revision)
view 2  NEW
view 3  NEW
view 4  NEW
```

with `[cms-revalidate] ok` carrying both tags and `updatedAt` at `20:58:20.786Z`. So the
behaviour measured against the mock is the behaviour on the live site: one visitor after a
publish may still see the previous revision, and the next one sees the new one.

The practical note for the next gate: **do not treat a missing stale view as a failure.**
Seeing it requires that nobody — no crawler, no colleague, no earlier curl — touched the
page between the publish and the first measurement. On a live site that is luck, not a
property you can require.

### Two things the cutover taught, both worth keeping

**The build bakes the CMS document in.** The first release-candidate run on the spare port
rendered the company block **twice** — the build had captured the pre-cleanup document in
`.next/cache/fetch-cache`, and `next start` served it. Rebuilding after the cleanup fixed
it. So `rm -rf .next` before the production build is load-bearing, not hygiene, and the
content cleanup must precede the build rather than merely the deploy. Had the candidate
not been run on a spare port first, the duplicate would have shipped.

**The cache works — and the first report that it did not was a measurement error.** Worth
keeping in full, because the mistake is easy to repeat.

On cutover day `[cms] served` was seen twice per HTTP request and read as two round trips
to Payload, i.e. "nothing is cached". That inference is invalid: `logCmsServed()` runs
after every `fetchCmsPage()` call regardless of whether Next's patched `fetch` hit the
network or the Data Cache, and the route calls it twice — once from `generateMetadata`,
once from the page component. **Two lines per request is the healthy steady state.** The
log is a consumer-read signal; only the far end of the wire can count origin traffic.

Measured properly at the deployed SHA, in an isolated worktree against a mock Payload with
a request counter, `next build` + `NEXT_PRIVATE_DEBUG_CACHE=1 next start`, production mode:

| Measurement                                    | Result                                              |
| ---------------------------------------------- | --------------------------------------------------- |
| build                                          | 1 origin request                                    |
| 5 page requests after resetting the counter    | **0** origin requests                               |
| `[cms] served` lines for those 5 requests      | 10                                                  |
| mock switched A→B with no revalidation, 1 view | still A, 0 origin requests                          |
| signed publish webhook                         | `200`, `[cms-revalidate] ok`, both tags             |
| view 1 after invalidation                      | still A — **1** origin request (background refresh) |
| views 2–5                                      | B                                                   |
| 5 further warm views                           | origin counter unchanged                            |

So the whole chain is real: publish → webhook → tag invalidation → exactly one origin
refresh → new cached document → render. `next: { revalidate: 900, tags }` does create a
Data Cache entry under `cacheComponents` in Next 16.2.9.

Two corrections follow from it, both applied:

- `route.ts` claimed `revalidateTag(tag, "max")` means immediate expiry. It means
  **stale-while-revalidate**. The runtime call was always right; only the comment was
  wrong. This is also why the gate says "by the second view" — that is the semantics, not
  slack.
- `client.ts` said a `[cms] served` line implies a cache miss. It does not, and now says
  so.

Nothing in the runtime was changed on the strength of the wrong reading — no `"use cache"`,
no `force-cache`. The audit harness lives at `docs/design/cms-cache-audit-20260730.md`.

## How to read a SHA in this document

Four different things have been called "the SHA" across these threads, and mixing them up
has already cost a round of confusion — a handoff table naming an implementation commit
while the branch tip was the docs commit written on top of it. Each one is spelled out
here, and every SHA elsewhere in this document says which kind it is.

| Term                                 | Meaning                                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **production base**                  | What `maky.store` is serving now. Since 2026-07-30 that is `b6b633d`, `BUILD_ID JAODjLtaigo1DL9m6h614`. The branch was _based on_ `007f75e`, which is now the rollback target rather than the base.                |
| **implementation tip**               | The last commit that changed runtime behaviour. Moves only when code moves.                                                                                                                                        |
| **branch / handoff tip**             | The actual tip of the branch, which is often a docs-only commit sitting above the implementation tip. This is what a deploy checks out and what `git ls-remote` reports.                                           |
| **deploy candidate**                 | A branch/handoff tip that has passed validation and is offered for deployment. Not yet deployed; it becomes the new production base only after a cutover.                                                          |
| **consumed provider / contract SHA** | The commit in the OTHER repository whose contract this branch was built against — `MakySto/maky-cms @ 704381d` for the vendored pack. It is recorded, never inferred, and it does not move when this branch moves. |

Two rules that follow from the table and are worth stating separately:

- **A document never contains its own commit SHA.** Asking for one produces either a lie
  or an amend loop. Report the branch tip from `git ls-remote` at the moment you need it.
- **Verify every SHA with `git ls-remote`, not with a tracking ref.** This repository has
  concurrent sessions; a stale `origin/*` has already produced a confidently wrong claim
  that a merge "never took".

---

## 1. Provider contract

|                     |                                                                     |
| ------------------- | ------------------------------------------------------------------- |
| provider repository | `MakySto/maky-cms`                                                  |
| provider branch     | `codex/storefront-cms-contract-v1`                                  |
| provider commit     | `704381d`                                                           |
| contract            | `storefront-cms-o-nas-v1`, version `1`                              |
| manifest status     | `candidate`                                                         |
| Payload             | `3.86.0`, release `20260718T113448Z-91dc302982a1`, schema `91dc302` |
| `depth`             | `1`                                                                 |
| locale / market     | `sk` / `SK`                                                         |
| supported blocks    | `richText` only                                                     |
| preview             | not supported in V1                                                 |

Request the storefront makes:

```
GET {PAYLOAD_CMS_URL}/api/pages
  ?where[slug][equals]=o-nas
  &where[_status][equals]=published
  &locale=sk
  &depth=1
  &limit=1

CF-Access-Client-Id: …
CF-Access-Client-Secret: …
```

No Payload `Authorization` header is sent. The Cloudflare Access service token opens the
network boundary only; Payload's own access rules still decide what an anonymous caller
may read, and an anonymous caller sees published documents only. The provider fixture
`page-anonymous-draft-request.sk.json` is the recorded evidence — the request was made
with `draft=true` forced on and returned a published document anyway.

The thirteen fixtures are vendored at `src/lib/cms/__fixtures__/provider-v1/` with a
`PROVENANCE.md`, and `provider-conformance.test.ts` re-verifies all thirteen SHA-256
digests from the manifest on every run. Tests touch no network and no second checkout.
Payload's generated `payload-types.ts` is not vendored: it describes fourteen block
types and a `type: any` Lexical tree, so it would type-check against anything.

### Forward compatibility: the `legalMetadata` group

The Payload Forms migration adds an optional group to **every** Page document:

```json
"legalMetadata": { "documentType": "editorial", "legalVersion": null, "effectiveFrom": null }
```

It is inert for this pilot — `/sk/o-nas` is editorial and the storefront renders
`richText` blocks only. But this pilot rejects an entire candidate document on anything it
cannot render faithfully, and Payload has no way to discover whether that rule would fire
on an additive field. If it did, the CMS migration would take a healthy `/sk/o-nas` back
to its bootstrap copy on the day it landed, and — since §3 and §6 expect the two render
paths to be byte-identical after cleanup — nobody would see it happen.

It does not fire, and that is now pinned rather than assumed:

| Question                                   | Answer                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Does the candidate stay valid?             | Yes. `parsePagesResponse` names the eight fields it wants and rebuilds a `CmsPage` from them; it has never enumerated the incoming key set. |
| Does the group reach the renderer?         | No. The parsed `CmsPage` is **deep-equal** to the one parsed from the same response without the group, so nothing downstream can differ.    |
| Is a `contract-violation` logged?          | No. `console.error` is not called at all; `[cms] served … "outcome":"found"` is.                                                            |
| Does the route fall back to the bootstrap? | No — proven by invoking the real route component, not by inspecting a status field.                                                         |
| Was validation weakened to achieve this?   | No. See below.                                                                                                                              |

Two qualifications, because the table is tidier than the truth. `content` is passed through
whole rather than rebuilt — a Lexical tree is not something that layer can usefully
reconstruct — so a key sitting _inside_ a rich-text value does reach the block object,
unlike every other unnamed field. It is never read and never emitted, and the gate pins
that at four placements inside the tree. Separately, the revalidation webhook is covered
too: Payload's `afterChange` hook echoing document fields into that body is a plausible
next move, and the derived cache tags are unchanged when it does.

The last row is the one that matters. Tolerance here is **narrow and pre-existing**, not a
new exemption: `createdAt`, `hasNextPage` and `totalDocs` already arrive and are already
read past. `legalMetadata` joins them. No parser rule changed, no unknown-field passthrough
was added, and the parsed page still has exactly its eight fields. The fail-closed rules
are re-run in the gate **with the group present** — an unsupported `blockType` and a
content-bearing unknown Lexical node both still reject the whole document.

The gate lives in `src/lib/cms/legal-metadata-compat.test.ts` (33 tests) and measures
everything against a fixture pair, so none of it rests on a hand-written guess at what
Payload sends:

```
__fixtures__/provider-v1/…/page-o-nas.sk.published.depth-1.json   vendored provider recording
__fixtures__/forward-compat/…legal-metadata.json                  the same document + group
```

The second file is storefront-authored and deliberately **not** inside the vendored pack,
whose `PROVENANCE.md` says not to edit a fixture and whose integrity test would have
ignored an extra file in silence. Its derivation is enforced, not claimed: the gate deletes
`docs[0].legalMetadata` and asserts the remainder is deep-equal to the vendored response,
so it cannot drift away from the recorded document without failing. That equality is
structural, not byte-for-byte: the two files are indented differently, deliberately.

`page-schema.ts` now carries the matching warning in prose — rejecting unknown keys reads
as symmetry with the all-or-nothing rule and is the opposite of it.

Verified by mutation: adding strict unknown-top-level-key rejection to `parsePagesResponse`
turns 13 tests red; making `CmsBlocks` render nothing turns 3 red; rejecting a group whose
`documentType` is not `editorial` turns 5 red; and copying the group through into `CmsPage`
turns 8 red. The gate gates.

What is pinned is the FIELD, not the editorial literal. `/sk/o-nas` sends
`editorial / null / null`, but the legal pages M.2 brings into the CMS will send a
populated group, and a gate that only knew the one literal would stay green on the day the
first populated one arrived — the same class of miss this file exists to prevent, one level
up. A populated `legal / 1.2 / 2026-08-04` group, an explicit `null`, an empty group and
two malformed shapes all parse to the identical page and reach no markup.

**Settled at cutover — an earlier note here got the conclusion wrong.** The vendored base
fixture is a provider-side recording rather than a copy of the live document:
`page-o-nas.sk.published.depth-1.json` holds four _shortened_ paragraphs, while the live
document held the long ones plus a company block. That looked like a contradiction of
`1e62961`, and it was reported as one. It is not.

Reading the live document through the reader's own request path on 2026-07-30 settled it:
after the cleanup, its four paragraphs are **character-for-character** `o-nas-static.tsx`
— checked by string equality, not by eye. `1e62961` was right about the live document; the
fixture is simply a different one. `provider-conformance.test.ts` calling it "the real
production response" is the only loose wording left, and it is the provider pack's framing
to fix, not this branch's.

So the byte-identical warning stands at full strength: the CMS path and the bootstrap path
now render the same HTML, and `[cms] served` is the only thing that tells them apart.

Nothing in this gate rests on it — every assertion renders from the frozen fixture — but
two things elsewhere do. `§6`'s claim that the paths become byte-identical after cleanup is
about the LIVE document and cannot be checked against this pack, and the pack's own
"tests what the CMS actually sends" framing is weaker than it reads. Worth one look at
cutover; it does not change step 7, which is right either way and is the check that does
not depend on any of this.

### Known divergence, owned by the CMS repository

`fixtures/lexical/unsupported-node.synthetic.json` contains the sentence _„Tento node sa
vo V1 preskočí a zaloguje."_ That describes the behaviour removed by this hardening pass.
The fixture is kept byte-identical because it is the contract; the prose in
`lexical-richtext-contract.md` on the provider side needs the matching correction. This
is a documentation change on the Payload side, no schema and no hook change.

---

## 2. Failure-state matrix

The single most important distinction: **an upstream fault is not an absence.** A CMS
that cannot answer gets the bootstrap copy. A CMS that answers "not here" is obeyed.

| State                                              | Result                                       | Indexing                          |
| -------------------------------------------------- | -------------------------------------------- | --------------------------------- |
| timeout / DNS / network error                      | bootstrap JSX fallback                       | normal, canonical set             |
| Cloudflare Access `302` (HTML login)               | bootstrap JSX fallback                       | normal, canonical set             |
| upstream `4xx` / `5xx`                             | bootstrap JSX fallback                       | normal, canonical set             |
| non-JSON content type                              | bootstrap JSX fallback                       | normal, canonical set             |
| malformed JSON                                     | bootstrap JSX fallback                       | normal, canonical set             |
| contract violation (any)                           | bootstrap JSX fallback                       | normal, canonical set             |
| `_status: draft` from the public endpoint          | bootstrap fallback + error log               | normal, canonical set             |
| CMS not configured (env missing)                   | bootstrap JSX fallback                       | normal, canonical set             |
| **`docs: []`** (unpublished / deleted)             | **404**                                      | `noindex, nofollow`, no canonical |
| **page `markets` excludes SK**                     | **404**                                      | `noindex, nofollow`, no canonical |
| non-Slovak channel                                 | 404                                          | `noindex, nofollow`, no canonical |
| block `markets` excludes SK                        | that block is omitted, page renders          | normal, canonical set             |
| unsupported `blockType`                            | whole document rejected → bootstrap fallback | normal, canonical set             |
| unknown content-bearing Lexical node               | whole document rejected → bootstrap fallback | normal, canonical set             |
| unknown inert Lexical node (e.g. `horizontalrule`) | skipped, structured warning                  | normal, canonical set             |
| unsafe link protocol                               | link text kept, `href` dropped               | normal, canonical set             |
| unknown text-format bit                            | plain text                                   | normal, canonical set             |

### All-or-nothing rendering

A CMS document renders whole or not at all. An unsupported `blockType`, or a Lexical node
carrying content that the renderer has no case for, invalidates the **entire candidate**
and the route serves its bootstrap copy.

The rejected alternative — drop the offending part, render the rest — produces a page
that looks complete, a publish that reported success, and an editor who never learns a
paragraph is missing. A page that visibly reverts is the uglier failure and the far safer
one, because somebody notices it.

**The editorial cost is real and must be stated:** adding an image, a table, a horizontal
rule with content, or any new block type to `/sk/o-nas` in Payload takes the route back to
its bootstrap copy until the storefront learns to render it. Every such rejection emits
one structured line naming the document id, slug and the offending block or node type:

```
[cms] contract-violation {"slug":"o-nas","locale":"sk","reason":"…",
      "documentId":"019fb008-…","documentSlug":"o-nas","blockType":"bannerGrid","nodeType":null}
```

"Content-bearing" means: the node has text, or children, or a `fields` object, or a
relationship (`value` / `relationTo`). That covers `upload` — a published photograph has
no text at all, and a text-only test would let it vanish in silence. A bare marker such as
`{ type: "horizontalrule" }` stays inert, because skipping a separator loses no content.
The limit worth knowing: a future node holding text in a field this rule does not inspect
would be judged inert. There is no way to recognise content in a shape nobody has
described yet; the structured warning is what makes that case findable.

---

## 3. The fallback is a bootstrap, not a snapshot

Three layers keep `/sk/o-nas` serving, and only one of them survives everything:

1. **Next ISR entry** (`.next/server/app/sk-eur/o-nas.html`) — survives `pm2 restart` and
   the deletion of `.next/cache`. A deploy (`rm -rf .next`) destroys it.
2. **Next stale-while-revalidate** — on a failed refetch, the last good render keeps
   serving. Useful in production, and actively misleading during testing: it masks
   failure modes. Testing the fallback requires deleting the ISR entry **and** restarting
   the server; Next holds the cache in memory too, so deleting files alone is not enough.
3. **The JSX in `o-nas-static.tsx`** — the only layer that survives a deploy, a restart
   and a git rollback, because it is code.

Layer 3 is what "the fallback" means in the matrix above. It is a **bootstrap code
fallback**, not a durable last-known-good CMS snapshot. Concretely:

```
July       CMS content = version A, storefront ships JSX = version A
August     editor publishes version B
September  deploy while Payload is unreachable
result     storefront shows JSX version A — not the last published version B
```

For `/sk/o-nas` this is an accepted trade: the page is non-transactional, the bootstrap
copy is safe and accurate, and the visitor gets neither a 500 nor a blank page.

### Handoff rule for further pages

> The bootstrap JSX fallback is approved for **editorial** pages.
> **Versioned legal documents with an effective date are not migrated** until a durable
> last-known-good layer exists.

The reason is specific, not general caution: a legal document's content is coupled to a
date it took effect. Silently serving September's deploy the July text is a compliance
problem in a way that serving July's "about us" copy is not.

A durable snapshot design is deliberately **not** attempted here, and is scheduled after
M.2 rather than before it — it will be designed better once there is more than one page
to observe and it is clear what actually needs caching.

### Migration order after this pilot (agreed 2026-07-30)

1. **M.2** — core renderers for `hero`, `richText`, `image`, `gallery`, `cta`, `faq`,
   `mediaText`, plus a second page `/sk/poradna`. The second page is the point: it proves
   the reader is not quietly hard-wired to `o-nas`, and it exercises media, CTA, FAQ and
   several blocks at once.
2. **Durable last-known-good snapshot.**
3. **Legal pages** — only after both, and only once Payload has an effective-date field.
   For terms and conditions a stale version is not a cosmetic defect; it is the document a
   customer bought under.

   > **Read this before treating step 3 as unblocked.** The Payload Forms migration ships
   > `legalMetadata.effectiveFrom`, so the literal wording of that last condition is about
   > to be satisfied — by a field that arrived for an unrelated reason. It does not unblock
   > anything. Steps 1 and 2 are still open, the storefront deliberately does not read the
   > field (see §1, "Forward compatibility"), and the real precondition was never the
   > field's existence but the durable last-known-good layer that keeps a stale legal
   > version off the site. A field appearing in a schema is not a decision. This one is
   > still a human one.

4. **Homepage, banners, globals** — after that. It is the most-visited page, so a silent
   fallback costs most there; globals (Header, Footer, AnnouncementBar) touch every page
   on twelve markets; and part of the homepage is commerce blocks anyway.
5. **Commerce blocks** — last, and blocked until the Saleor collections/brand-attribute
   track is done.

---

## 4. Revalidation

```
POST /api/revalidate/payload
Authorization: Bearer <PAYLOAD_REVALIDATE_SECRET>
```

The Authorization header is the **only** accepted carrier. `?secret=` and custom headers
are rejected even when the value is correct: a secret in a query string ends up in nginx
access logs, proxy logs, APM traces, `Referer` headers and browser history, and it leaks
by being transported. `extractBearerToken` from `src/lib/api-auth.ts` — which does accept
both — is deliberately not reused here; that helper belongs to Saleor.

Only `POST` is exported, so Next answers every other method with 405 before any handler
code runs.

| Request                                               | Result |
| ----------------------------------------------------- | ------ |
| `Authorization: Bearer <valid>` + valid event         | `200`  |
| `Authorization: bearer <valid>` (lowercase scheme)    | `200`  |
| `?secret=<valid>`, no Authorization header            | `401`  |
| `X-Revalidate-Secret: <valid>`                        | `401`  |
| `Authorization: Basic <valid>`                        | `401`  |
| `Authorization: <valid>` (no scheme)                  | `401`  |
| no Authorization header                               | `401`  |
| any secret while `PAYLOAD_REVALIDATE_SECRET` is unset | `401`  |
| authenticated + malformed JSON                        | `400`  |
| authenticated + `source` other than `maky-cms`        | `400`  |
| authenticated + unknown event name                    | `400`  |
| `GET` / `PUT` / `DELETE`                              | `405`  |

The secret is never logged. Authentication happens before the body is read, so an
unauthenticated caller causes no work.

Tags are always **derived** from the event, never taken from the body. A body carrying
`tag`, `path` or `tags` is ignored — a caller able to name its own tag could purge the
whole site. A rename arrives as one `update` carrying both `slug` and `previousSlug`, and
both are invalidated so the old URL stops serving.

HMAC is **not** added in this pass. Both sides are aligned on Bearer V1; a strong random
secret, header-only transport, POST-only and an event allowlist are proportionate here.
HMAC is a V2 conversation, not a reason to reopen a finished contract.

### Publish is not instant, and should not be described as such

```
webhook arrives  → tag invalidated
first request    → still serves the previous render, and triggers a refresh
second request   → serves the new content
subsequent       → served from cache, no further CMS hits
```

This is stale-while-revalidate working as designed, not a bug. "Publish takes effect on
the next-but-one request" is the honest description.

---

## 5. Not-found is a soft 404 — the documented PPR limit

Under `cacheComponents`, the shell (including `<head>`) is flushed before the page
component can call `notFound()`. The response is therefore **HTTP 200** with the not-found
body. A real 404 is not reachable at page level without either abandoning PPR on this
route or adding a CMS lookup to `src/proxy.ts` — the latter would put a network call to
Payload in front of every request on the site, which is not a trade worth making for one
page.

The minimum conditions are met instead, in `generateMetadata`:

- `robots: { index: false, follow: false }`
- **no canonical at all** — a self-canonical would actively nominate the absent URL for
  indexing, which is worse than emitting nothing
- no title of its own; the channel layout supplies the site name

`generateMetadata` and the page component evaluate the same three conditions in the same
order. A disagreement between them is exactly how a 404 acquires a self-canonical, so any
change to one must change the other.

A definitive status model is required before generic or legal pages migrate. Not before
`/sk/poradna`, which is editorial.

What the visitor actually sees in that state was captured rather than assumed: an English
"Page Not Found" with no header and no footer, because the boundary that catches
`notFound()` here is the root `src/app/not-found.tsx`, which sits outside `[channel]` and
therefore has neither the channel chrome nor a locale. Acceptable for a state that only
occurs when an editor unpublishes the page, and recorded in §7 rather than fixed here.

---

## 6. Cutover — avoiding a visible duplicate company block

The CMS document currently still contains a duplicate company paragraph. Legal identity
belongs solely to `src/config/company.ts` and is rendered by `<CompanyDetails />` on both
the CMS and the fallback path — so deploying before the CMS text is cleaned would show
the company details twice.

Deploy-first is therefore the wrong order. The correct sequence:

1. ~~Confirm a failing webhook does not block publish.~~ **Already established empirically
   on 2026-07-30:** `o-nas` was published twice while the endpoint did not exist, the hook
   returned `404` both times, and both publishes went through — the hook wraps
   revalidation in `try/catch` and only logs the failure. No need to re-test.
2. Remove the duplicate company paragraph from `o-nas` in Payload and publish the clean
   content.
3. Production is **visually unchanged** — it is still serving the JSX version.
4. The webhook returns `404` once more. Expected, and harmless.
5. Deploy the storefront pilot.
6. The first request reads the clean CMS content; `<CompanyDetails />` appears exactly
   once.
7. **The gate — see below. Until this passes, the deploy is not finished.**

### Step 7 is not an extra check. It is the only proof.

After the cleanup in step 2, the CMS document and `o-nas-static.tsx` contain the **same
four paragraphs, character for character** — verified against the live document, not
assumed. The two markers that distinguish the paths today, the duplicate company block and
the `info@maky.store` autolink, both live in the paragraph being deleted.

So from step 2 onward the CMS path and the bootstrap path render **byte-identical HTML**.
A silent fallback — `PAYLOAD_*` missing from the production process, a rotated Cloudflare
service token, Payload simply down — would look exactly like success. Nobody would notice,
possibly for months. That is not a cutover risk; it is a permanent property of this route
until its content diverges from the JSX.

Two things follow.

**At cutover:** make a small content edit in Payload, publish, and confirm it appears on
the second view. The first view may still be stale; that is the documented SWR contract,
not a failure.

**At any time afterwards**, the objective check is the server log — the CMS reader emits a
positive line on every successful fetch, not only on failure:

```bash
pm2 logs maky-storefront --nostream --lines 200 | grep '\[cms\]'
```

```
[cms] served {"slug":"o-nas","locale":"sk","outcome":"found",
  "documentId":"019fb008-504b-779e-ad3f-1ff353267c88","updatedAt":"2026-07-29T22:46:10.035Z","blocks":1}
```

`updatedAt` is the useful field: it names **which revision** is live, so "did my edit
land?" is a fact rather than an eyeball comparison. Absence of `[cms] served` alongside a
normal-looking page is the signature of a silent fallback. A fetch only happens on a cache
miss, so this is a few lines an hour, not one per request.

After a successful cutover the provider manifest moves to `status: accepted` with
`contentCleanupRequired: false`, recording the deployed storefront SHA and BUILD_ID.

### Rollback

Production before this pilot: `007f75e` (`BUILD_ID WRxB8lq9Ps8OmdZq-oBbR`). Restore by
checking that SHA back out, rebuilding, and restarting `maky-storefront`, or by swapping
in the retained `.next.rollback` directory. Removing the four `PAYLOAD_*` variables from
`.env` is **not** a rollback path in itself — it makes the reader return "not configured",
which is an upstream fault, so the route serves the bootstrap copy rather than breaking.

---

## 7. Deliberately out of scope

Recorded here so they are not lost, and not fixed on this branch:

- **`en-CA` message parity** — `en-CA.json` is missing 211 keys against `en-US.json`,
  mostly `checkout.*` and `cart.*`. Verified identical on production `007f75e`, so this is
  **pre-existing, not a regression from the CMS work.** next-intl is not type-augmented,
  so these fail silently at runtime rather than at build.
- **Global `src/app/not-found.tsx`** — this is what a visitor sees if `/sk/o-nas` is
  unpublished or market-excluded, and it was captured at 360/390/412/1440 to be sure.
  It renders **in English** ("Page Not Found"), with **no header and no footer**, because
  it sits outside `[channel]` and so gets neither the channel layout nor a locale; its
  two links point at `/` and `/products` **without the market prefix**. It carries no
  `robots` metadata of its own either — the `noindex` on this route comes from the page's
  own `generateMetadata`, which is why that had to be the fix rather than touching the
  boundary.

  It does paint correctly: the shadcn token bridge described in CLAUDE.md §4.2 as missing
  has since landed in `src/styles/brand.css` (lines 245–263), so `bg-primary` and friends
  resolve. §4.2 is stale on that point.

  A localized `[channel]/(main)/not-found.tsx` would fix the language, chrome and links
  for every page under that segment at once. That blast radius — products, categories,
  every 404 on twelve markets — belongs to the route-safety track, not to a CMS pilot.

- **Dotted-route firewall** and **reset-password `redirectUrl`** — separate urgent
  hotfixes, to land on their own branch before or after this one, not mixed into it.
- **Preview / draft** — requires a read-only preview principal and a signed preview
  session. Not V1.
- **Durable last-known-good snapshot** — scheduled after M.2.
