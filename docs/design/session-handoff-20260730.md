# Storefront session handoff — 2026-07-30

Self-contained. Read this first; it tells you the state, the next move and the things
that will waste your afternoon if you rediscover them yourself.

---

## 1. Ground truth

```
production        fix/container-width @ 007f75e   BUILD_ID WRxB8lq9Ps8OmdZq-oBbR
                  /opt/storefront is detached on it, working tree clean
```

**Never build, install or restart anything in `/opt/storefront`.** `next build` there
replaces the hashed chunks the live `next start` is still serving and takes the site down
(CLAUDE.md §13). Work in a worktree.

Three branches are in flight. Verify every one with `git ls-remote` before trusting a
SHA — this repo has concurrent sessions and stale tracking refs have lied before.

| Branch                                          | Tip       | State                                                |
| ----------------------------------------------- | --------- | ---------------------------------------------------- |
| `feat/cms-o-nas-pilot`                          | `b6b633d` | hardened + legalMetadata gate, **waiting to deploy** |
| `feat/withdrawal-form-v1`                       | `1c6f43b` | consuming vendored contract `1.1.0`, branch-only     |
| `codex/payload-provider-v2-forms-v1` (maky-cms) | `459146a` | contract `1.1.0`, PostgreSQL CI green, PR #3 draft   |

Every tip above is a **branch/handoff tip** — what `git ls-remote` reports and what a
deploy checks out. That is not always the last commit that changed behaviour, and an
earlier version of this table said `45a4344` (the implementation commit) while the branch
tip was the docs commit above it. Both pilot handoffs now define the four terms;
`docs/design/withdrawal-form-v1-handoff.md` is the shorter one.

---

## 2. What is on each branch

### `feat/cms-o-nas-pilot` — /sk/o-nas served from Payload

Six commits over prod. Reader with Cloudflare Access, runtime validation, React Lexical
rendering, `/api/revalidate/payload` with Bearer-only auth, all-or-nothing document
rendering, 439 tests. Provider pack v1 vendored with all 13 checksums re-verified per run.

Full detail: `docs/design/cms-o-nas-pilot-handoff.md` on that branch.

**The thing not to forget:** after the duplicate company paragraph is cleaned out of the
CMS document, the CMS path and the JSX bootstrap render **byte-identical HTML** — verified
against the live document, all four paragraphs match character for character. A silent
fallback therefore looks exactly like success. The only signal is
`pm2 logs maky-storefront --nostream | grep '\[cms\] served'`, whose `updatedAt` names the
live revision. Cutover step 7 (publish an edit, see it on the second view) is the gate,
not an optional extra.

### `feat/withdrawal-form-v1` — the § 20a online withdrawal function

Ten commits over prod. Guest + account modes, structured partial withdrawal, server-side
order ownership, HMAC-signed transport, printable receipt, 367 tests.

Full detail: `docs/design/withdrawal-form-v1-handoff.md` on that branch.

It was converged on Codex's real Forms V1 contract after three mismatches were found, each
of which would have failed **100 %** of requests: millisecond timestamp (Payload wants
Unix seconds, 10–11 digits), `noticeSnapshot` in the body, and `customer.phone`. Payload
now owns the snapshot, the submission number, the timestamp and both e-mails.

---

## 3. Do this next

**Step 1 — the legalMetadata compatibility gate on `feat/cms-o-nas-pilot`.**

The Payload Forms migration adds an optional, inert group to every Page response:

```json
"legalMetadata": { "documentType": "editorial", "legalVersion": null, "effectiveFrom": null }
```

The CMS pilot rejects a whole candidate document on anything it cannot render faithfully,
which is deliberate — so it must be proven that this additive field does **not** trip that
rule. Add an official fixture/test where a valid published `o-nas` document carries it and
assert: candidate stays valid, field ignored for editorial rendering, no
`contract-violation` log, no bootstrap fallback, and **no weakening of unknown-content
validation**. Support this field explicitly; do not start ignoring unknown fields in
general.

If the current code already passes, make it a test-only commit and say so. Run typecheck,
lint, tests and a production build. Return the new deploy SHA and the rollback SHA. Stop
before deploying.

**Step 2 — Marek deploys the CMS pilot** (cleanup in Payload first, then deploy, then the
step-7 gate).

**Step 3 — then, in order:** M.2 (seven core block renderers + `/sk/poradna`, needs
Codex's provider pack v2), and rebasing the withdrawal branch onto the new production tip.
Do not rebase before step 2 — you would land on a base that is about to move.

---

## 4. Environment, so you do not rediscover it

- **Worktrees:** `/home/ubuntu/wt-cms` (CMS pilot) and `/home/ubuntu/wt-withdrawal`
  (withdrawal). Both have `node_modules` and the gitignored `src/gql` codegen. To make a
  new one off the same base: `git worktree add`, then
  `cp -al /home/ubuntu/wt-cms/node_modules ./node_modules` and copy `src/gql`. Do **not**
  run `pnpm install` — the repo's supply-chain policy blocks fresh installs.
- **Husky is not set up in a fresh worktree** (`.husky/_/` is gitignored). Run
  `npx husky install` rather than reaching for `--no-verify`; the hook has caught real
  problems.
- **The pre-commit hook runs prettier over staged JSON.** Anything whose bytes matter —
  checksummed fixtures, recorded responses — needs a `.prettierignore` entry in the same
  commit, and verify with `diff -r` _after_ committing. This already silently corrupted 13
  vendored fixtures once.
- **Headless browser, no dependency:** Node 24 ships a `WebSocket`, so
  `~/.cache/ms-playwright/chromium-1228/chrome-linux/chrome` can be driven over CDP
  directly. A working driver and smoke harness are in the previous session's scratchpad
  pattern; rewriting them takes ten minutes. Two traps: the page has **more than one
  `<form>`** (the header search box is first in the document), and React replaces nodes on
  hydration — scope your selectors and wait, or you will get convincing false results.
- **Ports:** always check a port is free and that the process answering is _yours_ before
  believing a result. A stale `next-server` on `:3037` from an old session has already
  invalidated one test run.
- **Baselines:** eslint is `0 errors, 6 warnings` — the six are pre-existing, do not
  "fix" them. `en-CA` is missing 211 i18n keys; that is pre-existing on production, not
  your regression.
- **`export const dynamic` is rejected under `cacheComponents`.** The opt-out is
  `await connection()`.

---

## 5. Blocked on other people

|                            |                                                                                                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Payload Forms release      | `459146a` — fresh-DB and upgrade PostgreSQL acceptance are now **green**; the migration `20260730_111111_forms_backend_v1` is still unapplied, and PR #3 is still a draft                                                                                                      |
| Human submission numbers   | still `WDR-<uuid>`; approved format is `ODS-YYYY-NNNNNN`                                                                                                                                                                                                                       |
| Approved Slovak legal copy | `LEGAL_COPY_APPROVED = false`. **This line used to be false:** the flag gated nothing until 2026-07-30, because `assertLegalCopyApprovedForProduction()` had zero callers. It gates now — the route 404s and the action refuses in production builds while the copy is a draft |
| Provider pack v2           | needed before M.2; Codex is splitting it into a docs-only branch                                                                                                                                                                                                               |

**HMAC is done** (2026-07-30). Same secret on both hosts, verified by comparing SHA-256
prefixes rather than moving the value anywhere: `53719b235c27`. Payload reads it from SSM
`/maky/prod/payload/runtime/`, the storefront from `/opt/storefront/.env` (0600,
gitignored). Both clocks NTP-synced; the signature window is ±300 s. The running
`maky-storefront` process started before the write and does not have it yet — Next reads
`.env` at process start, so it arrives on the next restart.

---

## 6. How to work here

Marek is technical, decides quickly, and would rather you act than ask. Concretely:

- **Do not stop between commits to check in.** Once the scope is agreed, finish it and
  give one report at the end. Commit count does not matter.
- **Verify load-bearing claims empirically.** Three of the most valuable findings in the
  last two sessions came from checking something that "obviously" held: the byte-identical
  fallback, the millisecond timestamp, and `customer.phone`. Reports from the other agents
  are usually right and occasionally are not — read the contract, do not take the summary.
- **A permissive mock is worse than no mock.** One written from the same assumptions as
  the client will happily accept every mistake the client makes.
- **When a test result surprises you, suspect the harness first.** A "broken honeypot", a
  "broken idempotency test" and an "empty delivery run" were all the harness; the last one
  was the rate limiter doing its job.
- **Say plainly what is not done.** Skipped steps, unverified assumptions and blockers go
  in the report, unhedged. Nobody here wants a green summary over a yellow reality.
- Slovak in conversation, English in code and commits. No time estimates.
