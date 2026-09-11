# 2C — outage is not unpublication: what the wire actually says

Measured on 2026-09-11 against a real build, with a wire-level mock CMS standing in for
the provider. **The mock is not a provider staging** and nothing here is provider E2E —
it answers a question about our own consumer: what status does the route return.

This is a measured proposal, not an implementation. Per the brief, the status change is
not made blind.

## What was measured

`/sk/o-nas`, real `pnpm build` per row, `.next/cache` removed between runs.

| CMS answer            | HTTP | `robots`            | body served                | log                             |
| --------------------- | ---- | ------------------- | -------------------------- | ------------------------------- |
| published, with body  | 200  | `index, follow`     | the CMS document           | `[cms] served`                  |
| unpublished           | 200  | `noindex, nofollow` | not-found page             | `[cms] page-unpublished`        |
| market-mismatch       | 200  | `noindex, nofollow` | not-found page             | `[cms] page-filtered-by-market` |
| **content-not-ready** | 200  | `noindex, nofollow` | not-found page             | `[cms] content-not-ready`       |
| upstream 500          | 200  | `index, follow`     | **the approved bootstrap** | `[cms] upstream-status`         |

Two things this confirms:

1. **The 2A fix works at the wire, not only in unit tests.** A published document with
   no body for the market now answers exactly like an unpublish, under its own log line.
2. **Every page-level outcome is HTTP 200.** Real status codes are not available to a
   page under `cacheComponents` — the status line is committed before any component's
   lookup resolves. This is the constraint already recorded for the hard-404 work.

### A trap worth recording

The first run of this measurement showed all five modes returning the _same_ answer. The
fetch Data Cache in `.next/cache` survives a rebuild, so every build after the first
replayed the first CMS response. `rm -rf .next/cache` between builds is what makes the
measurement mean anything — the same fact CLAUDE.md §13.2 records about the deploy
script's `mv` giving the build a cold cache.

## The risky path is currently unreachable

With the CMS down:

| URL         | HTTP | `x-robots-tag` | body                    |
| ----------- | ---- | -------------- | ----------------------- |
| `/sk/o-nas` | 200  | none           | the approved bootstrap  |
| `/cz/o-nas` | 404  | `noindex`      | — (proxy, route policy) |
| `/de/o-nas` | 404  | `noindex`      | —                       |
| `/us/o-nas` | 404  | `noindex`      | —                       |

So the case the brief is concerned about — an already-indexed page answering `200 +
noindex` during a transient outage, which Google says can _remove_ the URL — **does not
exist today**. It needs a market that has the route AND no in-code bootstrap. SK has a
bootstrap; the other eleven get a real 404 from the proxy before the CMS is consulted.

It becomes reachable at exactly one moment: when `route-policy.ts` opens `o-nas` to a
market with no bootstrap. That is the same edit that opens a market after P's staging is
verified — so this is a **precondition for opening a market**, not a live defect, and it
does not block staging work.

## The three options, with their real costs

### D-a. Serve the last known-good content (the brief's preference)

Preferred where the cache can hold it safely. It cannot today: `fetchCmsPage` catches the
transport failure and returns `{ status: "error" }` from _our_ code, so Next's Data Cache
is never asked — there is no stale entry to fall back to, only a fresh failure. Making
this work means caching the last good **parsed outcome** separately from the fetch, with
its own age bound and its own invalidation, and deciding how old is too old for a legal
page. That is a design, not a patch.

### D-b. A true `503` from the proxy

Correct per Google, and the mechanism already exists — `proxy.ts` returns a real `404`
for a route a market does not have, and has a second, flag-gated existence gate for
upstream-dependent 404s. A 503 for a CMS outage would be the same pattern.

The cost is that the proxy would have to know the CMS state, which means an upstream call
in middleware on every CMS-route request. The existing existence gate makes exactly that
trade and is therefore **off by default behind `ROUTE_EXISTENCE_GATE`**. Extending it
touches routing, so it is CLAUDE.md §10 and needs approval on its own terms.

### D-c. Leave `200 + noindex`, and gate the market opening on D-a or D-b

What stands today. Defensible _because the path is unreachable_: no indexed page can be
harmed by it yet.

## Recommendation

Do nothing to the status now, and make D-a or D-b a **named precondition on the first
market opening for a CMS route** — recorded next to the `route-policy.ts` edit, so the
two cannot be separated.

If it has to be chosen now, D-b is the smaller change and reuses a deployed mechanism,
but it is §10 and pays an upstream call per request. D-a is better behaviour and a larger
design. Either needs a decision from M/Marek; neither should be inferred from this
document.

## Not claimed here

No provider staging was involved. No production request was made. The mock serves the
REST envelope shape only so the consumer's own behaviour can be observed; it is not
evidence about Payload, about the approved content, or about any market's readiness.
