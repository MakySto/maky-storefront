# CMS reader — cache truth audit, 2026-07-30

Run at the deployed SHA `b6b633da6b4969967cdc3244b9eab2fce3a206ea`, after the cutover, to
settle a claim made on cutover day and then withdrawn: that `/sk/o-nas` was not cached at
all. It is cached. This file records how that was established, so the next person can
re-run it in ten minutes instead of re-deriving it.

## The mistake, stated plainly

`[cms] served` was observed twice per HTTP request and read as two round trips to Payload.
It is not. `logCmsServed()` runs after every `fetchCmsPage()` call, whether Next's patched
`fetch` reached the network or the Data Cache, and the route calls `fetchCmsPage()` twice —
`generateMetadata` and the page component each call `loadPage()`. Two lines per request is
the healthy steady state.

**A consumer-side log cannot measure origin traffic.** Only the server at the other end can
count arrivals. Everything below follows from taking that seriously.

## Harness

Isolated worktree, hardlinked `node_modules`, both codegen outputs copied in
(`src/gql` **and** `src/checkout/graphql/generated` — omitting the second fails the build
with a confusing missing-export error):

```bash
git worktree add --detach /home/ubuntu/wt-cache-audit b6b633d
cp -al /home/ubuntu/wt-cms/node_modules ./node_modules
cp -r  /home/ubuntu/wt-cms/src/gql ./src/gql
cp -r  /home/ubuntu/wt-cms/src/checkout/graphql/generated ./src/checkout/graphql/generated
```

`.env` is production's with the three `PAYLOAD_CMS_*` / `PAYLOAD_CF_ACCESS_*` values
replaced so the reader points at `mock-payload.mjs` — a dependency-free node server that
serves the exact `/api/pages` response shape and exposes:

```
/__stats    origin request count, current revision, request log (header NAMES only)
/__reset    zero the counter
/__switch?to=B   change the served document without touching the storefront
```

It records header names but never values, so a CF service token cannot end up in a log.

Production mode only — `rm -rf .next && next build`, then
`NEXT_PRIVATE_DEBUG_CACHE=1 next start -p 3033`. Dev mode does not cache the same way and
would have proved nothing. No `Cache-Control: no-cache`, no DevTools cache-disable.

## Results

| Step                                                                                                  | Origin requests | Rendered  |
| ----------------------------------------------------------------------------------------------------- | --------------- | --------- |
| `next build`                                                                                          | 1               | —         |
| counter reset, then 5 × `GET /sk/o-nas`                                                               | **0**           | A         |
| (those 5 requests produced 10 `[cms] served` lines)                                                   |                 |           |
| mock switched A→B, 1 view, no revalidation                                                            | 0               | **A**     |
| signed publish webhook → `200`, `[cms-revalidate] ok`, tags `cms:collection:pages` + `cms:page:o-nas` | 0               | —         |
| view 1 after invalidation                                                                             | **1**           | A (stale) |
| views 2–5                                                                                             | 1 (unchanged)   | **B**     |
| 5 further warm views                                                                                  | 1 (unchanged)   | B         |

The A→B switch with no revalidation is the load-bearing row: the storefront kept serving
the old document while the origin was already serving a new one, which only a real cache
entry can do.

## What this settles

- `next: { tags, revalidate: 900 }` **does** create a Data Cache entry under
  `cacheComponents: true` in Next 16.2.9.
- `revalidateTag(tag, "max")` is **stale-while-revalidate**: one visitor after a publish
  may still get the previous revision, and exactly one background refresh hits the origin.
  The cutover gate's "must appear by the second view" is that semantics, not slack.
- The page is **not** coupled to Payload's availability per request. A Payload outage
  degrades to the bootstrap copy only once the cache entry is gone, not on every view.
- No runtime change was warranted. No `"use cache"`, no `force-cache`. Two comments were
  corrected — `route.ts` on what `"max"` means, `client.ts` on what `[cms] served` proves.

## Re-running it

The mock is committed beside this document as `cms-cache-audit-mock-payload.mjs`. The whole audit is: build against the mock,
reset the counter, make requests, read `/__stats`. If a future change to the reader is
proposed on caching grounds, this is the measurement that has to move first.
