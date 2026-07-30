# CMS pilot `/sk/o-nas` — handoff

Status: **hardened, branch-only, not deployed.**
Branch `feat/cms-o-nas-pilot`, based on production `007f75e`.

This document is the truthful record of what the pilot does, what it deliberately does
not do, and what has to be true before a second page follows it. Where it describes a
limitation, the limitation is real — none of it is worked around elsewhere.

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

1. **Payload side first:** confirm that a failing revalidation webhook does not block a
   save or publish. Today the endpoint does not exist in production, so the hook gets a
   `404`.
2. If publish proceeds: remove the duplicate company paragraph from `o-nas` in Payload and
   publish the clean content.
3. Production is **visually unchanged** — it is still serving the JSX version.
4. The webhook returns `404` once more. Expected, and harmless.
5. Deploy the storefront pilot.
6. The first request reads the clean CMS content; `<CompanyDetails />` appears exactly
   once.
7. Make a small approved content edit and verify the live webhook: first request may be
   stale, the second must be fresh, and subsequent ones must not increase the CMS hit
   count.

**If a failing webhook does block publish**, do not knowingly publish a duplicated page.
Have the Payload side make revalidation best-effort and retryable first, then resume at
step 2.

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
