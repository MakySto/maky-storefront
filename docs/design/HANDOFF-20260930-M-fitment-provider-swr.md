# HANDOFF 2026-09-30 — fitment provider: answer from memory, refresh behind the read

Branch `claude/pensive-golick-17cb1c`, off production `228590b`. **Not deployed, not pushed.**

| commit    | what                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `654d60e` | `fix(fitment)`: stale-while-revalidate + stale-if-error, detached refresh, conditional GET, one memo per process, boot prewarm, load/refresh log lines |
| `310747f` | `fix(konfigurator)`: without a dataset say "Ponuku sa teraz nepodarilo načítať.", not "Najprv vyberte vozidlo"                                         |

Files: `src/lib/fitment/provider.ts`, `src/lib/async/detached.ts` (new), `src/instrumentation.ts`,
`src/app/[channel]/(main)/konfigurator/page.tsx`, and their tests. No copy change (the configurator
reuses `configurator.lookupFailed`, present in all 12 locales), no dependency, no Saleor/checkout/cart
/routing change.

## 1. What changed

- **A render never waits for a refresh.** The held dataset — fresh or stale — is the answer at once. A
  stale one is refreshed in the background; concurrent readers share one refresh (in-flight dedupe kept).
- **The refresh runs outside the render that noticed it.** `register()` captures a context with no
  request in it (`AsyncLocalStorage.snapshot()`), and `runDetached` runs the refresh there. Inside the
  render's context Next's patched `fetch` would join the prerender's cache signal and add its
  tags/`revalidate` to the shell, and `Date`/`Math.random` can abort a running prerender
  (`patch-fetch.js`, `io-utils.js`, next@16.3.6). `after()` is not an escape: it deliberately binds its
  callback to the render's own context (`after-context.js`, `bindSnapshot`).
- **Stale-if-error.** A failed refresh — timeout, network error, non-OK status, not JSON, failed
  validation — keeps the last good dataset, logs it, and retries after 30 s (not on every read).
- **Every new payload is validated in full**, `datasetHash` recomputation included; one that fails is
  never swapped in. **An unchanged file is not re-parsed**: the refresh asks conditionally
  (`If-None-Match` / `If-Modified-Since`; CFM's nginx sends `ETag` + `Last-Modified` and answers 304),
  and without validators a transport SHA-256 equal to the held dataset's bytes is "same bytes".
  Validation reads no clock (staleness is checked at use time in `resolve.ts`), so identical bytes can
  only get the verdict they already had.
- **One memo per process** (`globalThis`): the page bundles and the sitemap route handlers each had their
  own copy of the module, each holding and reloading its own 8 MB.
- **Boot prewarm**: `register()` loads the dataset before the server takes a request (skipped during
  `next build`). A CFM outage at boot is held and retried in the background; the server starts anyway.
- **Logs** (stdout = `maky-storefront-out.log`, failures on stderr = `maky-storefront-error.log`):
  - `[fitment] loaded <datasetVersion> <datasetHash> (<bytes> B, <ms> ms)` — each dataset taken into use
  - `[fitment] unchanged <datasetVersion> <datasetHash> (304 not modified | <n> B, same bytes, <ms> ms)`
  - `[fitment] provider answered HTTP <status> for <host/path>` — 404/503 used to leave no trace
  - `[fitment] refresh failed (<reason>) from <host/path>; keeping <version> <hash>, next attempt in 30 s`
  - `[fitment] load failed (<reason>) …; no dataset to serve …` — only when nothing is held
  - `[fitment] provider payload warnings: [...]` — unchanged text, now printed only when a NEW payload is
    taken into use (at boot and on a real change), not every five minutes. The Thule §7 post-switch check
    ("the newest warnings block has 96 entries, no `app:ec660c4e…`") still works.

## 2. The 500s: what the evidence says — read before expecting them to disappear

- Production's PM2 error log (to 2026-09-30) holds **45** `NEXT_STATIC_GEN_BAILOUT` occurrences.
  **38 of them** are printed on the line directly after a reload's warnings block; for the log's other
  error lines that happens **~2 %** of the time (GraphQL 2.6 %, `[assortment]` 0 %). The earlier "90–330
  lines after a reload" reading is not the evidence — reload blocks are 58 % of that log, so nearly any
  line is near one; exact adjacency is.
- None of the failing shells reads the dataset (the fitment components sit behind `connection()`, and the
  holes are in the Footer / the homepage body), so the link is the reload's **time on the event loop**:
  a reload stalled it ~240 ms here (p50 236 ms, max 577 ms; production's heap is ~10× larger). The fix
  removes that from steady state (304 → no parse at all).
- **7 of the 45 are NOT reload-adjacent**, including the 04:41 UTC cluster (Orbbot: `/sk/doprava-a-platba`
  04:41:18, `/reklamacie-a-vratenie` :38, `/kontakt` :42, `/o-nas` :46 — nginx `500 21`). Those have
  another cause, not addressed here. Where a page's shell file has not been rewritten since, its mtime is
  the second of the 500 (`/sk/oblubene` 10:37:25, `/sk/doprava-a-platba` 04:41:18, `/sk/login` 23:48:45 on
  29.9.) — Next's error path re-saving the old shell before it throws — so these are **blocking**
  regenerations (shell past `expire`, or its tag expired with `{ expire: 0 }`).
- **I could not reproduce the 500 locally on either build**: 604 forced blocking prerenders against 306
  reloads on the baseline, 712 against 357 refreshes on the fix — 0 bailouts both. So "the 500s stop" is
  a prediction for production, not a local measurement. The check is in §5.

## 3. Proof

**Unit tests** — 3268 passed / 34 skipped (whole suite). New: `provider.http.test.ts` (stale served
while the refresh downloads; one refresh for many readers; refresh cannot see the caller's
AsyncLocalStorage store; failed refresh keeps the old dataset for network error / 503 / 404 / HTML;
30 s retry cadence; recovery; tampered, wrong-instance and wrong-schema payloads never replace a good
one; 304 and same-bytes paths; log format; one memo across module copies; prewarm), `detached.test.ts`,
`instrumentation.test.ts` (capture + prewarm, skipped in build, boot survives an outage), and
`konfigurator/page.test.ts`. Against the original code the new tests fail on behaviour (null dataset
while stale, hang on the refetch, 2 fetches instead of 1, "selectVehicleFirst" for a saved car).

**Real `next start`** (worktree builds, `MAKY_FITMENT_REVALIDATE_SECONDS=1`, local `python3 -m
http.server` as the source, an event-loop stall monitor preloaded, identical load for both builds:
2 request loops over 13 pages + forced blocking prerenders via the app's own `/api/revalidate`, 8 min):

|                                    | baseline `228590b`          | fix                               |
| ---------------------------------- | --------------------------- | --------------------------------- |
| requests / forced prerenders       | 9 685 / 604, all 200        | 11 883 / 712, all 200             |
| dataset reloads                    | 306 full downloads + parses | 357 refreshes, all 304 (p50 9 ms) |
| event-loop stalls ≥ 100 ms         | 309 (p50 236 ms)            | 0                                 |
| `Failed to set Next.js data cache` | 306                         | 0                                 |
| bailouts                           | 0                           | 0                                 |

**Outage, same shopper (Škoda Octavia Combi 5E 2015, raised rails, saved through the app's own selector):**

|                          | baseline                                           | fix                                                                               |
| ------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| source up                | 9 sets                                             | 9 sets                                                                            |
| source down, after TTL   | "Najprv vyberte vozidlo", car gone from the header | 9 sets, `refresh failed (fetch-failed) … keeping 3.0.0-full-20260915.2 af9e6750…` |
| booted during the outage | "Najprv vyberte vozidlo"                           | "Ponuku sa teraz nepodarilo načítať." (desktop + 360 px)                          |
| source back              | (not re-checked)                                   | `loaded …` on the next background attempt, 9 sets                                 |

Also live on the fix: swap to `3.0.0-full-20261001` → `loaded 3.0.0-full-20261001 fd3507de… (7993764 B,
276 ms)` + 96 warnings, no `Failed to set` line (the refresh is not render work); a tampered copy
(content changed, hash kept) → `datasetHash mismatch … recomputed 53195adf…` + `refresh failed
(payload-invalid) … keeping 3.0.0-full-20261001 fd3507de…`; file deleted → `HTTP 404` + kept; original
bytes restored with a new mtime → `unchanged … (7993764 B, same bytes, 20 ms)`, then 304s.

Gates: lint 0 · tsc 0 · build 0 (route table and prerender manifest identical to `228590b`: 36 routes,
same revalidate/expire) · i18n 12/12 parity (missing 0 / extra 0). `pnpm i18n:check` fails on
`checkout.addressForm.delete` — identical on untouched `228590b`, pre-existing.

## 4. Deploy (needs Marek's GO)

Production `.env` was switched to `…3.0.0-full-20261001.json` and PM2 restarted at 13:14–13:15 UTC today
(not by this thread). The deploy keeps whatever `.env` says.

```bash
cd /opt/storefront
./scripts/ops/deploy-production.sh --dry-run
./scripts/ops/deploy-production.sh -m "fitment: answer from memory, refresh behind the read (654d60e, 310747f)"
```

The script builds what `/opt/storefront` has checked out, and the branch itself is checked out in this
worktree, so check out the sha first — `cd /opt/storefront && git checkout --detach 310747f` — as with
earlier worktree branches (it touches sources only; the running server keeps serving its `.next`).
Rollback = the snapshot the script takes.

## 5. After deploy — what to look at

```bash
grep '\[fitment\] loaded' /home/ubuntu/.pm2/logs/maky-storefront-out.log | tail -1     # which dataset, at boot
grep -c '\[fitment\] unchanged' /home/ubuntu/.pm2/logs/maky-storefront-out.log        # ~12/hour with traffic
grep '\[fitment\] \(refresh\|load\) failed\|provider answered HTTP' /home/ubuntu/.pm2/logs/maky-storefront-error.log | tail
grep -c NEXT_STATIC_GEN_BAILOUT /home/ubuntu/.pm2/logs/maky-storefront-error.log      # THE metric: note it now, compare in a few days
```

Not nginx's `" 500 21 "` count as the metric: it counts every bare 500, and on 30.9. (32 by 13:47 UTC) it
also holds `/ca` and `/fr` product pages and a `/sk/products` navigation that are not prerender bailouts.

If bailouts continue, check whether they are still printed right after a `[fitment] loaded` line (a real
dataset change) or not at all near fitment — the latter is the separate cause in §2.

## 6. Open

1. The 7 non-adjacent bailouts (§2): blocking regenerations whose cached reads (`getMarketAssortment`,
   `visibleNavLinks`, scenery) fail or time out — a thrown `"use cache"` is not cached, so the final
   prerender pass misses it outside Suspense. Separate investigation.
2. `src/lib/catalog-content/snapshot.ts` has the same shape: production sets `MAKY_CATALOG_CONTENT_PATH`,
   so each language's ~9.7 MB snapshot is re-read and re-parsed in front of a render every 15 min.
3. A genuinely new dataset is still parsed and validated on the main thread (~250–280 ms here), once per
   change. A worker thread would remove it; not worth it at one change per publication batch.
4. Push after a gitleaks pass (public fork, CLAUDE.md §10.1).
