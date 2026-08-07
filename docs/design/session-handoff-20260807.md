# Session handoff — 2026-08-07

**Read this first. It is self-contained: it states the ground truth, what is already proven, the
traps that have already cost time, and the exact next step.**

---

## 1. Ground truth — verify, do not trust

```bash
git ls-remote origin refs/heads/feat/cms-m2      # authoritative; never a tracking ref
cat /opt/storefront/.next/MAKY_DEPLOY_META
pm2 list
```

|                            |                                                                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Production branch**      | `feat/cms-m2`                                                                                                                                                                                   |
| **Deployed artifact**      | commit `bdcc925`, BUILD_ID **`iyLXwmjRqPX0jdVSumaqz`**, built 2026-08-07T06:58:15Z                                                                                                              |
| **`/opt/storefront` HEAD** | `feat/cms-m2` — may be **one docs commit ahead** of the artifact (this file + CLAUDE.md §10.1). The build is unaffected; `MAKY_DEPLOY_META` records the artifact's real sha.                    |
| **PM2**                    | `maky-storefront` restarts=1, up since 06:58 · `maky-smtp-app` restarts=0, untouched                                                                                                            |
| **Rollback**               | `/opt/storefront-rollbacks/.next.rollback-a5e5ff3-JdV9eVV4t2laAlpGhyofM-20260807T065745Z` (verified). `.next.rollback-b6b633da-JAODjLtaigo1DL9m6h614` stays **pinned** via its `.keep` sidecar. |
| **The gate**               | **DEPLOYED BUT OFF.** No `ROUTE_EXISTENCE_*` in `/opt/storefront/.env`.                                                                                                                         |
| **Live markets**           | `MAKY_LIVE_MARKETS=sk` in `/opt/storefront/.env` (durable). Everything else is preview.                                                                                                         |

`fix/seo-hard-404-v1` @ `bdcc925` still exists and points at the same commit — that is what
`MAKY_DEPLOY_META` names as `git_ref`, and it is the branch the artifact was built from.

## 2. What changed on production 2026-08-07

Deployed via `./scripts/ops/deploy-production.sh`, 35 s downtime, exit 0. Behaviour that changed
**with the gate still off**:

- Dotted junk is now a real 404: `/admin.php`, `/wp-login.php`, `/index.php`, `/does.not.exist`,
  `/wp-sitemap.xml`. All were HTTP 200 + `index,follow` with a self-canonical before.
- The seven sk-only legal pages 404 outside `sk`: `/de/kontakt`, `/cz/kontakt`, … They served an
  indexable Slovak `<head>` over a 404 body before.
- Preview markets carry `X-Robots-Tag: noindex, nofollow` and set no sticky cookie. `/sk` carries
  neither header nor any change.
- The root URL can no longer auto-select a preview market by cookie, CF-IPCountry or
  Accept-Language. Verified on live: 9/9 cases land on `/sk`.
- The market switcher lists only live markets (it offered all twelve before).
- The sitemap follows the live set and throws rather than serving a short list.

**Still true and unchanged:** `/sk/<missing-product>` answers **200 + noindex**. That is the
original defect and it closes only when the gate is armed.

## 3. What is already proven — do not re-litigate

Measured on a production build (`next build` + `next start`), recorded in
`docs/design/seo-hard-404-stop-report-20260806.md`:

- **481/481 sitemap URLs return 200 with the gate ARMED.** Zero false positives. This is the test
  that says the gate kills nothing real.
- **Fail-open is real.** Against an unreachable Saleor: 8 consecutive misses all
  `x-maky-gate: product:unknown`, never a 404; categories and collections the same; breaker opened
  after 5 faults. A Saleor outage cannot manufacture 404s.
- **Channel isolation:** one product, 200 in `sk-eur`, 404 in `de-eur`.
- **All 10 migrated product slugs survive** — the gate carries its own `previousProductSlug()`
  fallback ahead of the verdict (`route-existence.ts:221`), and `/sk/products/<old>` 308s 47 lines
  above the gate. Saleor has also converged. Nothing to fix here.
- **Runtime market promotion works with no rebuild**: same BUILD_ID, `MAKY_LIVE_MARKETS="sk,cz"`
  → sitemap 481→483, `/cz` loses its noindex, switcher prop `["sk"]`→`["sk","cz"]`.
- **Gate cost:** ~30 ms on a cold LRU miss, ~1.5 ms warm, against a 400 ms timeout.
- 768/768 tests, 45 files. `tsc` 0. `pnpm lint` 0 errors (6 pre-existing warnings).

## 4. Traps that have already cost time — read before testing anything

1. **`NEXT_PUBLIC_*` is inlined at BUILD time.** Overriding `NEXT_PUBLIC_SALEOR_API_URL` at runtime
   does nothing; the built bundle keeps the baked URL. A fail-open test done that way returned
   404s that looked like the safety property had failed — they were correct answers from the real
   Saleor about products that genuinely do not exist. **Any test that needs a different Saleor must
   build against it from the start.** This is exactly the constraint the future-product test below
   is designed around.
2. **`pkill -f "next start -p 3040"` kills the agent's own shell** — the Bash tool's command line
   contains the same string. Kill by PID: `ss -ltnp | grep :3040`.
3. **`next start -H 127.0.0.1` breaks internal rewrites.** Next proxies rewrites to
   `localhost:3040` and gets `EADDRNOTAVAIL`; every 404 rewrite becomes a 500 and `/sk` a 301. It
   produced a completely bogus first acceptance run. Bind the default, not one interface.
4. **A unit test calling `proxy()` directly is not evidence about a served status.** It sees inputs
   Next's own URL handling rejects first. Acceptance runs against `next build` + `next start`.
5. **Building is safe only in the worktree.** `/opt/storefront/.claude/worktrees/maky-store-indexing-404-70ae01`
   (currently detached at `bdcc925`) has its own `node_modules` and writes its own `.next`. Verify
   `pwd` before every build. Copy `/opt/storefront/.env` in first; delete it after. Its `.next` is
   currently a **black-hole build** (`8KugmAIz6oZNq0kxTAnZB`, Saleor pointed at `127.0.0.1:9`) —
   do not mistake it for a good artifact.

## 5. Premises that keep being restated and are FALSE

- ~~"Arming the gate turns malformed percent-escapes into 500."~~ Backwards. `/sk/%E0%A4%A` never
  reaches the proxy — nginx answers 400 and Next rejects the URL first. The gate is the only thing
  that turns such a URL into a 404. The `safeDecode` guard and the proxy-wide `try/catch` were kept
  anyway, because unreachability is a property of nginx and Next, not of our code.
- ~~"The migrated-slug fallback is behind the gate."~~ The gate carries its own copy, ahead of the
  verdict. Verified 10/10.
- ~~"`feat/cms-o-nas-pilot` is a live branch with 20 155 unmerged lines."~~ It is a **full ancestor
  of production**, 0 commits prod lacks, 30 behind. Nothing to rebase. The +20 155 was PR #1's diff.
- ~~"Making the repo private would fix a leaked secret."~~ It is a **fork**; it cannot be made
  private, and fork-network objects stay reachable by SHA forever. See CLAUDE.md §10.1.

## 6. Security audit — CLOSED, clean

Full detail in the `reference-public-repo-audit` memory. Summary: the repo is public because it is
a fork of `saleor/storefront`; 0 forks of ours; 0 Actions runs ever. gitleaks 8.30.1 over
`--all --full-history` — 299 commits, **zero findings**. No env/credential/key file was ever
tracked. No `sk_live_`/`AKIA`/`ghp_`/`PRIVATE KEY`/credentialed-URL literal anywhere in history.
MAKY-specific secret names appear only as test fixtures. Agent SSH keys live in `~/.ssh`, outside
the repo; `.claude/` has never been tracked.

**Two checks only Marek can do** (both were open at handoff): GitHub → Security → Secret scanning,
and a mailbox search for provider notifications from Stripe / AWS / GitHub about an exposed
credential over the last year. If both are clean, the security question is closed for good.

## 7. THE NEXT STEP — future-product proof, without writing to production

The last unverified item from the original brief. It does **not** need a write to the live
catalogue.

1. In the worktree, build **once** against a local mutable fake Saleor (the URL is baked in, so it
   must be the build's endpoint from the start — trap #1).
2. Fake returns `{"data":{"product":null}}` → arm the gate → the URL must be **404**
   (`x-maky-gate: product:absent`).
3. **Without rebuilding and without restarting**, flip the fake to `{"data":{"product":{"id":"p1"}}}`.
4. After the 60 s negative TTL, the same URL must be **200** (`product:exists`).
5. Also prove channel isolation on the same run.
6. Report exact timings and BUILD_ID parity.

Then, in order:

8. **nginx `gate=` logging + canary.** No custom `log_format` exists today — nginx uses stock
   `combined`, so a new one must be defined, carrying at least method, URI, status, `request_time`,
   `upstream_response_time`, user-agent and `gate=$upstream_http_x_maky_gate`. `nginx -t` before
   `systemctl reload nginx`. **No Node/PM2 restart in this step.** Then five UptimeRobot canaries:
   a known-valid product, a known-missing product, category `stresne-boxy`, `/checkout`,
   `/sitemap.xml`. **The alarm is "a known-valid URL returned 404", not "the 404 rate rose"** — the
   404 rate is supposed to rise. Pick one canary product that is published but absent from listings
   and the sitemap; that proves the authority-vs-listing property in practice.
   Expect `gate=` to be **empty** while the gate is off. That is correct, not a broken log.
9. **STOP report** written from those outputs, then **Marek's GO**.
10. **Arm `product` + `sk`** — add to `/opt/storefront/.env` and
    `pm2 restart maky-storefront --update-env`. **No build, no deploy.**
    ```
    ROUTE_EXISTENCE_GATE=on
    ROUTE_EXISTENCE_MARKETS=sk
    ROUTE_EXISTENCE_FAMILIES=product
    ```
    Rollback is the same three lines emptied plus the same restart. No rebuild.
11. **60 minutes of active watching**: PM2 restarts, any `product:unknown`, breaker opening, Saleor
    latency, a known-valid product, checkout, and the page in a real browser. 24 h of idling is not
    required. Then add `collection`, `category`, `saleor-page`.

## 8. After the gate — in this order

12. **Navigation caches a Saleor fault as empty content.** `nav-links.tsx` and the homepage
    featured section sit inside `"use cache"` and turn `!result.ok` into an empty list; the
    navigation profile is _hours_. One blip strips every category link from every page for hours,
    with no 404 and no alert. Same root cause as the C2 data-semantics work, simply not converted.
    **This is the largest remaining instance and it is worth more than anything left in the SEO
    branch.**
13. **Navigation must not link to categories that are empty in the market.** Twelve of thirty
    categories hold no products and four of those are in the main nav. No market can launch with
    that.
14. **Withdrawal form — named item, not a footnote.** `feat/withdrawal-form-v1` @ **`83b37a5`**,
    DIVERGED from production (20 commits prod lacks, 14 of prod missing), still based on `a5e5ff3`.
    PR #2 (`codex/returns-v2-storefront`) was **opened and self-merged one minute later on
    2026-08-02 21:19 by the MakySto account, with no review**, on the branch that carries a legal
    obligation which is already past its deadline. Its body claims the Returns V2 backend is live;
    the 2026-08-01 note says the Payload endpoint answers "Route not found". **One of the two is
    stale — settle it with a fresh smoke test against the production Payload endpoint, not from
    either document.** Then decide state, rebase onto the production tip, deploy.
15. **`main` @ `be64a69` is a full ancestor of production, 213 commits behind.** Fast-forward it and
    adopt the rule: `main` = the last accepted production tree; feature branches are work on top.
16. **PR #1** is an open draft, `feat/cms-m2` → `feat/cms-o-nas-pilot`, head auto-advanced to
    `bdcc925`. It now proposes merging 30 commits of already-live code into an ancestor of
    production. Close it. **Claude Code cannot** — `gh` is not installed and no token exists on the
    box; this needs Marek or a token.
17. **Repository visibility as a deliberate decision.** The security question is closed; this one is
    commercial. Read what is actually in `docs/` — master plans, supplier notes, pricing, market
    launch plans, CLAUDE.md as institutional memory. Paths and PM2 process names are worthless to an
    attacker; business context is not. If `docs/` is purely technical, staying a fork is convenient
    for pulling upstream Saleor. Not to be done between the gate and the monitoring.

## 9. Open question for Marek, unrelated to the gate

An Italian screenshot showed Google sending people to `/it` via product listings. **`noindex` does
not affect that** — product listings are fed from Merchant Center, not the search index. Is there a
Google Merchant Center feed pointing at markets that are not live? If yes it must be fixed in the
feed, not on the site. If no, those links are stale and will die on their own.

## 10. Hard deadline still standing

VAT registration took effect 2026-08-04 (IČ DPH SK2122890660). The `maky-smtp-app` order-email
audit and the invoicing decision were due before it and are still not recorded as done.
