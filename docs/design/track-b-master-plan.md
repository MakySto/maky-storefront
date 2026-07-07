# Track B — Master Plan & Handoff (B.4 → B.10)

> **Purpose:** self-contained handoff so a fresh Claude Code thread (possibly on another PC,
> same server) can continue Track B without the originating chat. Read this + the memory
> (`~/.claude/projects/-opt-storefront/memory/`) + the references below. Written 2026-07-07.

## 0. TL;DR — start here (updated 2026-07-08 EOD, adversarially verified vs tip 8e76db9)
- **Everything is pushed to `origin`. Prod is untouched** (`a2db881`, BUILD_ID
  `O-g51KFEjBKKfQKkHcYEL`, PM2 `maky-storefront`+`maky-smtp-app` online — all re-verified
  2026-07-08). Track B is **branch-only** and does **NOT deploy** until after B.9.
- **B.4.1 ✓ and B.4.2 ✓ are DONE.** Current tip = **`origin/track-b/checkout-v2-core @ 8e76db9`**
  (B.4.2 = checkout v2 RSC core: browser urql removed, RSC data layer + server actions live,
  legacy `/checkout` retired). Nothing exists beyond this — **no B.4.3/B.5 branch** (any review
  doc implying B.5 is "done" is wrong; see §1b).
- **Next step = B.4.3** (order-confirmation split `/checkout/complete` + shallow `?step=`),
  branched off `origin/track-b/checkout-v2-core @ 8e76db9`.
- Create a **fresh scratch worktree** off that branch, then `rm -rf node_modules && pnpm install
  --frozen-lockfile` (base carries B.1 deps — a hardlinked `/opt` node_modules mismatches and
  yields 2 spurious tsc errors). See §5.
- **NUMBERING IS LOCKED — do NOT renumber:** `B.4.1–B.4.5` (checkout v2 sub-steps) → `B.5` replay
  → `B.6` truthfulness → `B.7` sk-i18n → `B.8` Stripe enable → `B.9` test matrix → `B.10`
  live+§20a. B.4.3 is NOT the last part of B.4 — B.4.4 (payment registry+Dummy) and B.4.5
  (session mgmt) remain. Truthfulness (B.6) comes **before** i18n (B.7); Stripe is **B.8**. See §3.
- B.4 is a **subsystem replacement** (checkout v2) — the biggest, riskiest step. Do it in the
  sub-steps below, each validated, plan-before-implementation for the risky ones.

## 1. State (2026-07-07) — branches (all on origin, branch-only)
| branch | SHA | what |
|---|---|---|
| `feat/legal-content-pages` | `323c324` | mainline = prod content `a2db881` + **Spec B doc** |
| `track-b/dep-alignment` | `9264ed6` | **B.1** dep align (next 16.2.9, react 19.2.7, next-intl 4.13, +@stripe/*, engines node>=24; TW stays 4.2.2) |
| `track-b/bff-auth` | `fa5e4f6` | **B.2** BFF auth foundation + **set-password leak fix** |
| `track-b/routing-session` | `3eb5eb6` (+this doc) | **B.3** market-aware login redirect fix |

**Prod:** `feat/legal-content-pages` content @ `a2db881` (homepage-truthfulness), BUILD_ID
`O-g51KFEjBKKfQKkHcYEL`, served by PM2 `maky-storefront`. `/opt/storefront` working dir is on
`feat` but its LOCAL feat ref may lag origin by the Spec-B docs commit — **use `git ls-remote` for
ground truth** (shared repo, concurrent sessions).

**Done:** B.0 preflight · B.1 dep align · B.2 BFF auth + set-password fix (4 security tests
passed; #3 success-path needs a real reset token = optional manual verify) · B.3 login redirect.

## 1b. State (2026-07-08 EOD) — B.4.1 + B.4.2 DONE (adversarially verified)

| branch | SHA | what |
|---|---|---|
| `track-b/checkout-v2` | `0323c53` | **B.4.1** session-bridge + `lib/checkout` cookie-name centralize + 2 cart handoffs → `buildCheckoutPath` |
| `track-b/checkout-v2-core` | **`8e76db9`** ← **TIP** | **B.4.2** checkout v2 RSC core — browser urql removed, RSC data layer + 12 server actions live, legacy `/checkout` retired |

**B.4.2 (7 commits `9a76129`→`8e76db9`, 54 files +885/−1844):** static-sk `checkout-locale.ts`;
`lib/checkout` cart-cookie scanners; server fetchers + **`toTypedDocument` bridge** (dep-free,
reuses existing checkout `gql` docs via `.loc.source.body` — NO codegen split); 12 server actions
(`src/checkout/lib/actions.ts`, urql-compatible `{data,error}` returns; payment tx actions call
Saleor but **no gateway** = B.4.4/B.8) + `CheckoutDataProvider`/`CheckoutUserProvider`; adapted RSC
loader (`src/checkout/checkout-session-loader.tsx`) + reduced `checkout-app.tsx`; **atomic cutover**
(`8e76db9`): rewired ~13 urql sites → context/actions, `app/checkout/page.tsx` → RSC entry, deleted
`page-wrapper.tsx`+`root.tsx`+`use-safe-mutation.ts`+`src/_reference/` (25). Validated: tsc/lint/
build 0; **runtime smoke PASSED** (spare :3035 — `/checkout?checkout=<id>` SSRs HTTP 200, ZERO
urql-context/window crash, full RSC pipeline works; `/sk`+CSS 200).

**Key structural choices (differ from the original §3 file-list — spike-driven):**
- **NO `(checkout)` route group** — variant C has no dual-root, so checkout stays at `app/checkout/`
  (nested under the single root layout). The §3 "(checkout) route group" item is MOOT for MAKY.
- **Bounded strategy: B.4.2 KEPT MAKY's own view components** (`src/checkout/views/saleor-checkout/*`)
  and swapped only the data layer (urql→RSC/actions). It did NOT adopt upstream's demo views.

**Verified-true state at tip `8e76db9` (grep/ls-remote, 2026-07-08):**
- ✅ Tip is `8e76db9`; **no branch beyond B.4.2 exists.** Prod untouched (a2db881 / BUILD_ID
  `O-g51KFEjBKKfQKkHcYEL` / PM2 both online).
- ⚠️ **B.5 marketHref replay is effectively ALREADY SATISFIED** (correction to earlier notes AND
  to review docs claiming B.5 is a pending/done *step*): because B.4.2 kept MAKY's views, the
  marketHref "Continue shopping" fix was never overwritten — it is live in
  `views/order-confirmation/order-confirmation.tsx:123` and `views/saleor-checkout/confirmation-step.tsx:116`.
  B.5's TW3.4→4 pass is also likely moot (MAKY kept its own TW4 views; no upstream TW3.4 to reconcile).
  **B.4.3 must PRESERVE these marketHref links** when it activates/rebuilds the confirmation route.
- ❌ **B.6 truthfulness is NOT done** (all offenders live at tip, in MAKY's kept views):
  `views/saleor-checkout/order-summary.tsx` — `saleor10` (:142,:308), `Tax (VAT)`/`Including VAT`
  (:328,:344), `30-day` (:365), `shipping===0?"Free"` (:323); `shipping-step.tsx` `isFree` (:127,:176).
  Any claim that "B.6 is mostly done" is false — verify by grep, not assumption.
- ❌ **B.4.3 NOT done:** `use-order.ts` still on dead urql `useOrderQuery`; no `/checkout/complete`
  route (only the 3 confirmation view files exist); no `checkout-search-params`/`use-checkout-step`
  shallow-`?step=` plumbing.
- ❌ **B.4.4 NOT done:** no `INTEGRATED_GATEWAYS` anywhere.
- 🧹 **Deferred (safe):** `auth-provider.tsx` still ships DEAD urql (`UrqlProvider` + `from "urql"`
  imports; login uses `SaleorAuthProvider.signIn`, so it's inert) — tiny strip follow-up; and dead
  `use-order`/order-confirmation views get activated in B.4.3.

**⚠️ Not yet runtime-tested with a REAL checkout id.** The smoke proved SSR-no-crash + the not-found
path only. The ready-state step forms (Information/Shipping/Payment) are unverified beyond tsc+build
+ SSR. **Recommended before stacking B.4.3/B.4.4: a browser proof of the v2 checkout** — add a
product to cart → open `/checkout?checkout=<real id>` → confirm the steps render + a mutation
(e.g. email/shipping) round-trips via the server action.

## 2. Key decisions already closed (do NOT re-litigate)
- **O1 routing = variant C** — public friendly market prefixes `/sk /cz /at /de /gb …` stay;
  MAKY is ALREADY variant C (`proxy.ts` + `CHANNEL_MAP` + `marketHref`). Do NOT re-root the
  storefront to upstream `(storefront)/[locale]/[channel]`. Checkout is outside the `[channel]`
  tree at `/checkout?checkout=<id>` (no locale in URL).
- **Session-bridge belongs to B.4** (not B.3) — it's a checkout-v2 handoff mechanism; adopt it
  WITH the v2 checkout so it has a consumer + validation. Adapt it to derive market/locale from
  `checkoutId-{channel}` cookie + `CHANNEL_MAP`, NOT the upstream `[locale]` segment.
- **Track A (Stripe app infra) is DONE** — self-hosted `saleor-app-payment-stripe@2.6.9`, config
  `test-sk-eur → sk-eur`, webhook Active, smoke OK. Gateway id `saleor.app.payment.stripe`,
  publishable key from `paymentGatewayInitialize` (not env). Enablement = B.8.
- **Image "myth" corrected:** images work on 16.1.2; the ugly CATEGORY presentation is a separate
  category-grid CSS redesign (parallel track), NOT a Next/Track-B issue.
- **No real orders** until (a) Stripe live path green AND (b) §20a withdrawal (Branch B) live —
  both are hard gates.

## 3. Remaining plan (B.4 → B.10). Source: MIGRATION.md (9 steps), inventory §8, Spec B §4.
### B.4 = Checkout v2 wholesale adoption (MIGRATION.md steps 1–8). Sub-sequence:
- **B.4.1** — MIGRATION 1+2: add `src/app/(checkout)/` route group; adopt `src/session-bridge/`
  (adapt to MAKY market scheme); align `src/lib/checkout.ts` to `checkoutId-{channel}`; replace the
  **2 hardcoded handoffs** (`cart/checkout-link.tsx:15` + `cart-drawer.tsx:317` `/checkout?checkout=`)
  with `buildCheckoutPath`. Validate: cart→checkout link works, session-bridge derives market.
  *(least invasive; no urql touch — good first sub-step.)*
- **B.4.2** — MIGRATION 3+4 (RISKIEST; plan-before-impl): RSC entry (`checkout-session-loader.tsx`,
  `checkout-app.tsx`), client data layer (`providers/checkout-data.tsx`, `actions.ts`); **delete
  urql** (`src/checkout/root.tsx` UrqlProvider), `dynamic(ssr:false)` (`app/checkout/page-wrapper.tsx:6`),
  and **`src/_reference/` (25 files)**; v2 codegen (`generate:checkout` = types/documents only).
- **B.4.3** — MIGRATION 5+6: order-confirmation split (`/checkout/complete?order=`,
  `navigateToOrderConfirmation`→`window.location.replace`); shallow `?step=` (no `router.replace`).
- **B.4.4** — MIGRATION 7: payment registry (`integrated-gateways.ts`, `finalize-checkout-order.ts`,
  `checkout-payment-completion.ts`, `stripe-checkout-completion-host.tsx`) — **registry + Dummy
  gateway only; Stripe stays OFF (B.8).**
- **B.4.5** — MIGRATION 8 session mgmt: **`session-auth-state.ts` + `resolve-session-user.ts` +
  `loginWithBff()` already exist from B.2** — add `revalidate-storefront-chrome.ts` +
  `sync-auth-surfaces-after-sign-in.ts`; wire checkout sign-in to `loginWithBff()`.
### B.5 = MIGRATION step 9 replay: marketHref "Continue shopping" (`order-confirmation.tsx:123` +
  `confirmation-step.tsx:116`), extend `brand.css` shadcn bridge, **TW 3.4→4 class pass + visual
  verify** (v2 checkout ships TW3.4; build does NOT certify tokens — §4.2/§12).
### B.6 = truthfulness cleanup on v2 (inventory §3, Spec B §8): remove free-shipping badge, "30-day
  returns", `shipping===0→"Free"`; order button "Objednať s povinnosťou platby"; drop estimated
  delivery; DPH transitional (neutral "Celková cena", no "vrátane DPH" while non-VAT-payer).
### B.7 = SK checkout i18n catalog (v2 has no `sk` locale) + 13-locale §11 parity. Seed = unused
  19-key `checkout` namespace in `sk-SK.json`.
### B.8 = Stripe enablement: `INTEGRATED_GATEWAYS` + env flags (`NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS`
  + `ENABLE_STRIPE_PAYMENTS` + `NEXT_PUBLIC_ENABLE_STRIPE_EXPRESS_CHECKOUT`), publishable key from
  Saleor. Verify real `data` field shapes from `transactionInitialize` against the installed app 2.6.9.
### B.9 = full test matrix (Spec B §10): success/declined/3DS/insufficient/cancel + Apple/Google Pay;
  browser-closed/webhook-delayed/duplicate/idempotency/price-change/expired; guest+logged-in; routing
  preservation; order+transaction in Saleor. `sk_test`/`pk_test` only.
### B.10 = live keys + first real order (post-green ONLY): new immutable Stripe config → remap sk-eur
  → delete old test config → Marek buys cheapest product with own card → verify. Parallel hard gate:
  **§20a withdrawal (Branch B)** must be live before any real order.

## 4. Constraints (CLAUDE.md) — non-negotiable
- **§10** guarded: Saleor/GraphQL structure, checkout logic, cart logic, CFM, channel/routing/i18n,
  env/secrets, deploy. B.4 IS §10-approved (Spec B) but riskiest — don't break the working legacy
  checkout; keep changes on-branch.
- **§11** validation: lint/tsc/build, 13-locale parity on any copy change, light-only (no `.dark`),
  **`next build` does NOT certify TW tokens** (visually verify components paint).
- **§13** deploy safety: **NEVER `next build` in `/opt/storefront` while PM2 `maky-storefront`
  runs.** Track B is branch-only until after B.9. Deploy (later) = `pm2 stop → checkout → rm -rf
  .next → build → spare-port verify (CSS 200!) → pm2 start → live verify`. Rollback: `a2db881`.
- **Anti-patterns (overview):** no urql Provider in checkout runtime · no `router.replace` for
  step-only nav · don't clear checkout cookie before confirmation nav · storefront must NOT import
  `@/checkout/*`.

## 5. Env / worktree setup gotchas (learned — don't rediscover)
- Work in a **scratch worktree**, NOT `/opt/storefront` (live). Create off the origin branch:
  `git -C /opt/storefront worktree add <scratch>/wt -b track-b/<name> origin/track-b/routing-session`.
- **Turbopack build REJECTS a symlinked `node_modules`** ("points out of filesystem root"). For
  no-dep-change work: `cp -al /opt/storefront/node_modules <wt>/node_modules` (hardlink, same
  `/dev/root` fs, ~instant). For dep changes: fresh `pnpm install` (isolated; do NOT `cp -al` first).
- Copy generated (gitignored) code: `cp -al /opt/storefront/src/gql <wt>/src/gql` and
  `.../src/checkout/graphql/generated`. Copy `.env` and `.husky/_` from `/opt` (husky hook needs
  `_`; else commit fails — or `--no-verify` for a verbatim docs import only).
- **pnpm supply-chain policy** (`pnpm-workspace.yaml`: `trustPolicy: no-downgrade` +
  `minimumReleaseAge: 1440` + `blockExoticSubdeps`) blocks fresh installs on provenance-gapped deps.
  `trustPolicyExclude` already lists `eslint-import-resolver-typescript@3.10.1` + `semver@6.3.1`
  (Marek-approved, dev-only). Add new scoped exceptions ONLY with approval; never disable globally.
- `sharp` works via prebuilt binary (no `pnpm approve-builds` / no lifecycle-script bypass).
- Build writes `.next` in the worktree (isolated). Smoke on a spare port: `next start -p 30XX`,
  `curl --retry ... --retry-connrefused`. Kill with `fuser -k 30XX/tcp` (NOT `pkill` self-match).
  (Note a pre-existing orphan `next-server` on :3032 — not ours.)
- **`git ls-remote` for ground truth** (concurrent sessions mutate origin refs; local `origin/*`
  can be stale).
- Pre-commit hook (lint-staged) runs eslint+prettier on staged files (reorders TW classes —
  cosmetic; expected). `pnpm-lock.yaml` is `.prettierignore`d.
- Small logical commits; commit messages end with `Co-Authored-By: Claude Opus 4.8 …`.

## 6. References (read before/while implementing)
- `docs/design/checkout-v2-stripe-spec-b.md` — **Spec B** (all decisions closed; §4 sequence, §6
  Stripe arch, §8 truthfulness, §9 SK i18n, §10 test matrix). On mainline (`feat`).
- `docs/design/checkout-v2-migration-inventory.md` — §3 exclusions, §7 collision, §8 order, MAKY
  2-file diff.
- `docs/design/o1-routing-inventory.md` · `docs/design/feat-stripe-app-infra-spec.md` (Track A DoD) ·
  `docs/design/known-issues.md` (set-password now fixed; §10 market-gate still open).
- **upstream/main** (read via `git show upstream/main:<path>`):
  `skills/saleor-paper-storefront/migrations/atomic/2026-06-checkout-v2/MIGRATION.md` (+ `detect.md`,
  `verify.md`, `references/checkout-v2-overview.md`) · `src/app/(checkout)/*` · `src/session-bridge/*`
  · `src/checkout/providers/*` · `src/lib/checkout.ts` · `src/lib/auth/revalidate-storefront-chrome.ts`.
- **Memory:** `~/.claude/projects/-opt-storefront/memory/project-stripe-checkout-v2-migration.md`
  (verified infra facts + per-step progress) + `MEMORY.md` index.
