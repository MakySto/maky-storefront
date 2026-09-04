# Session handoff — 2026-08-01, withdrawal rebase and audit

Continues `session-handoff-20260801-deploy-script.md`, whose §1 is now fully done: the pin
sidecar was fixed, the ops branch merged, and the **first scripted production deploy ran
green** (`a5e5ff3`, BUILD_ID `JdV9eVV4t2laAlpGhyofM`, 32 s downtime, exit 0).

This session ran **on the box**, so everything below is measured here unless marked
otherwise. It did the rebase, validated it, and then audited the feature with five
independent read-only agents plus an adversarial refutation pass.

**Headline: three of the assigned steps rested on premises that turned out to be false.**
Read §3 before planning any work — two of those steps need no code at all.

---

## 1. What is on production

Unchanged by this session. **Nothing was deployed.**

```
branch     feat/cms-m2 @ a5e5ff3
BUILD_ID   JdV9eVV4t2laAlpGhyofM     built 2026-08-01 14:34 UTC
PM2        maky-storefront (:3000), maky-smtp-app — both online, restart count unchanged
rollbacks  .next.rollback-b6b633da-JAODjLtaigo1DL9m6h614   (PINNED, sidecar .keep)
           .next.rollback-unknown-CInTIHi97tjA3HE3gKOY4-20260801T143349Z
```

`/opt/storefront` @ `a5e5ff3` has no `src/lib/withdrawal` at all, and the live `.next`
contains no form. The withdrawal feature is branch-only.

## 2. The rebase — done, validated, pushed

```
feat/withdrawal-form-v1   1c79ed3 → 7a8a652     17 commits onto a5e5ff3
```

One conflict, in `.prettierignore`, exactly as predicted. Resolved as a **union**: the
provider-v2 CMS pack and the forms-backend-v1 pack each need their prettier exemption, and
dropping either would let the pre-commit hook reformat vendored JSON and break its recorded
SHA-256 digests. That is the failure `feedback-vendored-artefacts-vs-formatter` records.

Transplant fidelity, verified rather than assumed:

- `git diff --name-only 1c79ed3..7a8a652` is **exactly** the M.2 delta `b6b633d..a5e5ff3` —
  no file appears that M.2 did not change
- withdrawal's own diff against its new base is byte-identical to its diff against the old
  one: **55 files, +7484, −22** both before and after

Backups, both on origin — the force-push was lease-guarded and is fully reversible:

```
backup/withdrawal-pre-rebase-1c79ed3     (this session, pre-rebase tip)
backup/withdrawal-pre-rebase-ce90034     (previous rebase)
```

### Validation (§11), on the rebased tree

Run in `/home/ubuntu/wt-withdrawal`, never in `/opt/storefront` (§13.7). `.env` is a symlink
to the real one, so these ran against `api.maky.store`, not a demo instance.

| check          | result                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| `vitest run`   | **787/787 passed, 48 files** — M.2's 615 and withdrawal's suite composed with no loss |
| `tsc --noEmit` | clean                                                                                 |
| `eslint`       | 0 errors, 6 warnings — the documented baseline, unchanged                             |
| `i18n:check`   | commerce closure OK, locale matrix OK (12)                                            |
| `next build`   | **exit 0**, both withdrawal routes emitted                                            |

PM2 restart count was unchanged across the build and prod `/sk` stayed 200 throughout.

## 3. Corrections — three assigned premises were wrong

### 3.1 Submission numbers are already `ODS-`; there is no storefront work

The assignment's step 3 ("čísla podaní stále `WDR-<uuid>`") is false. `WDR-` appears in **no
commit of this branch under `src/`** — only in two prose lines, both now corrected
(`withdrawal-form-v1-handoff.md`, `session-handoff-20260730.md`).

The storefront never generates the number. It reads `submissionNumber` from Payload's create
response (`payload-forms-client.ts:201`) and its entire validation is _non-empty string_
(`:205`). The vendored pack — copied verbatim from PR #3's head `459146a`, SHA-256 verified
20/20 — **already specifies `ODS-YYYY-NNNNNN`** from a PostgreSQL sequence, and the canonical
fixture already returns `ODS-2026-000001`. Tests feed `ODS-2026-000042` through the real
parser and pass.

**`ODS-YYYY-NNNNNN` is Payload-only. Zero files in this repo change.** The only thing that
would need work here is a new contract _revision_: re-vendor the pack and update
`MANIFEST_SHA256` in `contract-conformance.test.ts`.

(`01c8a46`, rebased to `e6bb82d`, is intact — but it fixed `orderNumber`, a different field.)

### 3.2 The VAT instruction is inverted — do not apply it

The assignment says _"nie 'vrátane DPH' — MAKY.STORE je neplatca, ceny sú konečné"_.
Production says the opposite, and production is right: `obchodne-podmienky` states
**"Predávajúci je platiteľom dane z pridanej hodnoty"** and _"konečné ceny vrátane DPH"_,
with a passing regression test that bans the non-payer wording outright.

IČ DPH `SK2122890660` takes effect **2026-08-04**. Applying the assignment's instruction
would re-introduce the contradiction fixed on 2026-07-29. The withdrawal copy is silent on
VAT, which is correct and needs no change.

One fact worth a decision, pre-existing and not introduced here: the terms assert VAT-payer
status in the **present tense** and `Cena s DPH` renders on PLP/PDP **today**, three days
before the registration takes effect.

### 3.3 Deploying this branch would not deliver the §20a function

`isWithdrawalFormServable()` returns false in production because `WITHDRAWAL_BACKEND_LIVE`
is unset, so a deploy ships the page with the **online function dark for everyone**, guests
and logged-in customers alike. The legal goal in the assignment's §0 is not met by deploying.

The real blocker is Payload PR #3 and its migration, in `MakySto/maky-cms` — **a different
repo, not checked out on this box**.

## 4. Backend gates — measured, not read from docs

| claim                                     | verdict                                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `WITHDRAWAL_BACKEND_LIVE` off             | **verified** — absent from `.env` _and_ from the live process's kernel environment; `=== "true"` fails closed        |
| PR #3 open, head unmoved                  | **verified** via read-only `git ls-remote` — head still `459146a`, unmerged, `main` = `ddccac74`                     |
| PR #3 "still a draft"                     | **unverifiable here** — the draft flag is GitHub API metadata that git refs do not expose, and `gh` is not installed |
| migration `20260730_111111_...` unapplied | **inferred, not measured** — code exists only on PR #3's branch, but the Payload DB is unreachable from this box     |
| numbers still `WDR-<uuid>`                | **contradicted** — see §3.1                                                                                          |

## 5. Findings that must not be lost

### 5.1 The real fail-open is `NODE_ENV`, not the flag

`contract.ts:295` returns `true` unconditionally when `NODE_ENV !== "production"`, bypassing
**both** interlocks. The live `maky-storefront` PM2 process has **no `NODE_ENV` in its
environment at all** — the gate holds today only because Next's CLI defaults it, not because
anything in the deploy config sets it. Not urgent while the feature is branch-only; it should
not be how a statutory function is gated once it ships.

### 5.2 The anonymous rate limit is trivially bypassable

`actions.ts:130-134` keys the limiter on the **first** element of `X-Forwarded-For`. nginx
_appends_ to the client-supplied chain, and `maky.store` is DNS-only with no Cloudflare proxy
in front, so that first element is fully attacker-controlled. The e-mail bucket rotates just
as easily, leaving the honeypot as the only real spam protection on a public, unauthenticated
endpoint that writes records and sends mail.

### 5.3 The §20a page is correctly guest-reachable, and `1c79ed3` holds

No middleware auth, no auth in `proxy.ts`, no session gate in any layout above the route.
Page and server action both fence every authenticated call behind `hasAuthSession()`, so a
guest never reaches `executeAuthenticatedGraphQL`. The interlock now only selects a JSX
branch (`page.tsx:142`) and is gone from `generateMetadata`; the surviving `notFound()`
(`page.tsx:98`) keys on channel alone and is unreachable for `/sk`. **No flag combination can
404 the legal page.**

The PPR soft-404 risk is real but now confined to non-sitemap markets — demonstrated live:
`https://maky.store/cz/odstupenie-od-zmluvy` answers **HTTP 200 with the English "Page Not
Found" body**.

### 5.4 The build's "Network error" lines are not network errors — case closed

25 during the deploy, 23 in this session's worktree build. They are Next 16's
`HangingPromiseRejectionError` (digest `HANGING_PROMISE_REJECTION`, `name === "Error"`),
thrown when the `cacheComponents` prerender aborts. `cookies()` returns a hanging promise;
`fetchWithRetry`'s inner catch matches the rejection via `message.includes("cookies")` and
falls back to a plain `fetch()`, which Next's patched fetch also rejects because these
queries pass `cache: "no-cache"`. That second rejection contains no "cookies" and is not an
`AbortError`, so the outer catch mislabels it and retries 3× with 1/2/4 s backoff.

**Harmless noise.** The account routes still produced correct partial prerenders
(`isPartial: true`, `postponed` present) with zero logged-out markup baked in, and 43 Saleor
calls returned 200 in the same build.

**Pre-existing since `be64a69` (2026-03-15)**, months before the deploy script — and proven
independently here: the worktree build reproduced it with PM2 **online and untouched**. The
hypothesis that `pm2 stop` caused it is refuted twice, since `.env` also points straight at
`https://api.maky.store/graphql/` with no self-fetch. **The deploy script is exonerated.**

### 5.5 Legal copy — what is actually missing

Checked against all five constraints. **Zero EU ODR references** anywhere in the repo, in any
of the 12 locales, or on live production. 14/30-day windows correct. Formal register, no hype.

Two real gaps, both **pre-existing and untouched by this branch**:

- _"Náklady na vrátenie tovaru znáša spotrebiteľ"_ lives on `obchodne-podmienky:126` and
  `reklamacie-a-vratenie:29` but appears on **no withdrawal surface** — not the page, form,
  receipt or stored notice. The withdrawal page's pointer to the terms is **plain text, not
  a link**.
- Zákon **391/2015 is cited nowhere in shipped code**. An adversarial pass **refuted** the
  stronger reading of this: the ARS obligation is met in substance — `obchodne-podmienky:157-171`
  names Slovenská obchodná inšpekcia with address, `ars@soi.sk` / `adr@soi.sk` and a link to
  `www.soi.sk`. Citing the statute would be an improvement, not a defect being fixed.

Any change here is legal copy and should go past a lawyer, per the assignment's own caveat.

## 6. What this session changed

Docs only. **No code, no deploy, no production change.**

- corrected the two stale `WDR-<uuid>` claims (§3.1)
- this handoff

## 7. Open, in priority order

1. **Payload PR #3 + migration `20260730_111111_forms_backend_v1`** — the only thing between
   today and a working §20a function. Different repo, not on this box.
2. **Then, in one change:** deploy `feat/withdrawal-form-v1` _and_ set
   `WITHDRAWAL_BACKEND_LIVE=true`. Next reads `.env` at process start, so the flag needs a
   restart or deploy to take effect — the deploy provides one. Verify the form renders for a
   **guest in a private window**, which is the legal requirement, not just logged in.
3. `NODE_ENV` fail-open (§5.1) and the XFF rate-limit bypass (§5.2) — decide before the form
   is live, not after.
4. Return-shipping-cost wording on the withdrawal surface + make the terms pointer a link
   (§5.5). Lawyer review.
5. **UptimeRobot** — still the one unfinished infra item. Keyword check on `Strešné nosiče`;
   HTTP 200 alone cannot see the unstyled-site failure.
6. M.2 acceptance (deployed without a gate, PR #1 still a draft), master plan §14.3's stale
   `NEXT_OUTPUT=standalone`, `known-issues.md` IAM/CloudWatch, and what started the 31 Jul
   EBS runaway (`atop` now at 60 s will name it on a repeat).

## 8. Traps

- `main` on GitHub is bare upstream Saleor from March. All real work is on feature branches.
- Verify branch tips with `git ls-remote`, never a tracking ref — a stale `origin/*` already
  produced one wrong diagnosis on this project.
- **Never `pnpm build` in `/opt/storefront` while PM2 runs** (§13.1). Worktree builds are
  fine and were used throughout this session.
- Deploy only via `./scripts/ops/deploy-production.sh`. `MIN_FREE_MEM_MB=6144` for one run if
  an agent is holding memory; do not lower the default.
- `maky-smtp-app` is never part of a storefront deploy.
