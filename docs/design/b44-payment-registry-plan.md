# B.4.4 — Payment Registry + Dummy Capability (Stripe INERT) — APPROVED PLAN

> **Purpose:** self-contained, git-tracked handoff so a fresh Claude Code thread (another PC,
> same server) can execute B.4.4 without the originating chat. Plan APPROVED by Marek 2026-07-08.
> Read this + `track-b-master-plan.md` (§0, §1c) + `checkout-payment-gateways.md` (upstream rules)
> + the memory `~/.claude/projects/-opt-storefront/memory/project-stripe-checkout-v2-migration.md`.
> Written 2026-07-08. Produced via ultracode: 4-agent read-only inventory + 6-agent adversarial
> verify (all load-bearing claims HOLDS_WITH_CORRECTIONS; every correction folded into this plan).

## 0. Status & start-here

- **APPROVED, zero code written.** No worktree for implementation created yet, prod untouched.
- **Base branch (STEP-0 expectation):** this plan doc is committed docs-only ON TOP of the former
  tip `41248d4`. After this commit the new tip of `origin/track-b/checkout-v2-confirmation` is the
  SHA recorded in `track-b-master-plan.md` §0 LATEST — **use `git ls-remote --heads origin
  track-b/checkout-v2-confirmation` for ground truth** (shared repo, concurrent sessions). Branch
  B.4.4 off whatever that tip is (it will include this plan doc; that is fine/better).
- **Prod (re-verify unchanged before starting):** `/opt` HEAD `a2db881`, BUILD_ID
  `O-g51KFEjBKKfQKkHcYEL`, PM2 `maky-storefront` + `maky-smtp-app` online. Track B is **branch-only**
  and does NOT deploy until after B.9.
- **Shared box, foreign process:** a `next-server` on **:3032** belongs to another session — NEVER
  kill it (no `pkill next`, no `fuser -k 3032`). For smoke use **:3037** or any free port ≠ 3032.
- **Proposed impl branch:** `track-b/checkout-v2-payment`, 5 commits (§11).

## 1. Goal & the browser-observable WIN

Wholesale-adopt the upstream payment registry (MIGRATION step 7) onto the MAKY variant-C server-
action model. Stripe compiled but **INERT** (never activates; B.8 enables it). Dummy = code
**capability** only (gated OFF in prod; the app is NOT installed anywhere). Delete the legacy mock
card/PayPal/iDEAL UI (sanctioned E9).

**WIN (runtime proof of B.4.4):** a real Stripe-only `sk-eur` checkout, on a **production build**
with no payment flags, resolves to a graceful **"Unsupported payment gateway"** alert instead of
today's dead-end *"This checkout UI currently only supports test payments…"*. Dummy stays gated OFF
in prod.

## 2. Ground truth captured (so you need not re-run the 10 inventory agents)

### 2.1 Upstream `src/checkout/lib/payment/` (ref `upstream/main`, 33 files, 22 non-test)

- **ZERO `"use client"`, ZERO `@stripe/*` imports, ZERO direct `@/app/(checkout)/actions` imports**
  anywhere in the dir. All Saleor calls go through the `getCheckoutTransport()` seam
  (`src/checkout/lib/checkout-transport.ts`, module-level set/get; throws if not installed).
- **Registry** `integrated-gateways.ts`: `INTEGRATED_GATEWAYS` priority = array order **stripe
  (submitMode "client") → dummy (submitMode "server")**; each with `{type, submitMode, findGateway,
  isEnabled, matchesGateway}`. `IGNORABLE_GATEWAY_IDS = ["saleor.io.gift-card-payment-gateway"]`.
  `hasUnsupportedPaymentGateway` = any gateway neither ignorable nor an **enabled** integrated match.
  `findEnabledIntegratedGateway` returns first def that is `isEnabled()` AND present.
- `resolve-provider.ts`: `resolvePaymentProvider(gateways)` → `{type:"stripe"|"dummy",gateway,
  submitMode}` | `{type:"none"}` | `{type:"unsupported",gateways}` | `{type:"dummy_missing"}`.
  In prod it **filters dummy out** of the list before classifying. `usesClientPaymentSubmit` (true
  only for stripe/dummy with submitMode "client") + `canSubmitPayment` (true only for dummy+server).
- `providers/dummy.ts`: `DUMMY_GATEWAY_IDS = ["saleor.io.dummy-payment-app","mirumee.payments.dummy"]`;
  `isDummyPaymentAllowed()` = `ALLOW_DUMMY_PAYMENT==="true" || NEXT_PUBLIC_ALLOW_DUMMY_PAYMENT==="true"
  || NODE_ENV==="development"`; `getDummyPaymentGuardError`; `DUMMY_PAYMENT_NOT_ALLOWED_MESSAGE`.
- `providers/dummy-pay.ts`: `executeDummyPayment` = transport `initializeTransaction` with
  `paymentGateway.data = {event:{includePspReference:true, type:"CHARGE_SUCCESS"}}` then
  `completeCheckoutOrder` — exactly 2 server actions.
- `providers/stripe.ts`: **entirely pure, no @stripe SDK**. `STRIPE_GATEWAY_ID =
  "saleor.app.payment.stripe"`; `isStripePaymentEnabled()` = `ENABLE_STRIPE_PAYMENTS==="true" ||
  NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS==="true" || NODE_ENV==="development"` ⇒ **dev auto-ON** (verify
  Stripe-OFF against a PROD build, never the dev server). Predicates the registry needs:
  `STRIPE_GATEWAY_ID, STRIPE_PAYMENT_NOT_ENABLED_MESSAGE, isStripeGateway, findStripeGateway,
  isStripePaymentEnabled, isStripeExpressCheckoutEnabled, getStripePaymentGuardError`. Config parsers
  (`parseStripeGatewayConfig, getStripeClientSecret, resolveStripePaymentMethodForInitialize,
  getStripeTransactionError, SUCCESSFUL_TRANSACTION_EVENT_TYPES, StripeGatewayConfig*`) are used ONLY
  by non-adopted `components/payment/stripe/*` and `stripe.test.ts` → deferred to B.8.
- `execute-payment.ts`: `amount===0 → completeCheckoutOrder`; `"dummy" → executeDummyPayment`;
  `"stripe" → {ok:false, error: messages.stripeUseCardForm}` (Stripe never submits through this
  switch — so Stripe unwired = already a graceful message, no SDK); `"none"/"unsupported"/
  "dummy_missing"` → their messages.
- `gateway-messages.ts`: `buildCheckoutGatewayMessages(translate)` takes an **injected translator**
  (no next-intl) + `getUnsupportedGatewayMessage/getTransactionInitializeError/formatGatewayList`.
- Shared pipeline: `complete-order.ts`, `finalize-checkout-order.ts` (single-flight; calls
  `navigateToOrderConfirmation`), `checkout-payment-completion.ts` (sessionStorage keys
  `checkout:payment-completing`, `checkout:payment-completion-error`; only next/* edge = a **type-only**
  `ReadonlyURLSearchParams` import), `checkout-pay-amount.ts` (ε `CHECKOUT_TOTAL_CHANGE_EPSILON=0.01`,
  `getCheckoutPayAmount`, `hasMaterialCheckoutTotalChange`), `checkout-payment-status.ts`
  (`isCheckoutReadyToComplete = authorizeStatus==="FULL"`), `update-billing.ts`,
  `should-show-payment-method-area.ts`, `format-checkout-complete-error.ts`.
- **Nothing in lib/payment clears the checkout cookie** (upstream clears it server-side in
  `runCheckoutComplete` via `after()`; that is B.4.5 for MAKY).

### 2.2 MAKY tip `origin/track-b/checkout-v2-confirmation` @ `41248d4` — payment surface today

- `views/saleor-checkout/payment-step.tsx` (~430 lines): hardcodes `dummyGatewayId =
  "mirumee.payments.dummy"` (line 17); branches on `hasDummyGateway`/`hasRealGateway` (lines 111-113);
  only the dummy path works (`transactionInitializeAction` → `checkoutCompleteAction` →
  `navigateToOrderConfirmation(order.id)`). **Dead-end string at :293** (real non-dummy gateway
  present): *"This checkout UI currently only supports test payments. Please use the standard checkout
  for real payments."* — stuffed into `errors.streetAddress1` (billing field), not `errors.payment`.
- `components/payment/`: only `billing-address-section.tsx` (real, KEEP), `index.ts` (barrel),
  `payment-method-selector.tsx` (100% mock card/PayPal/iDEAL — **DELETE target**; sole importers =
  payment-step + barrel, grep-verified incl. type imports).
- `lib/actions.ts` (`"use server"`, 13 exports, urql-shaped `{data?,error?}` via `toResult()`):
  `transactionInitializeAction` + `checkoutCompleteAction` are **`executePublicGraphQL`** (per
  `c0fcfa1`, checkout-id-is-credential). **No env guards anywhere in src/** (`isStripePaymentEnabled`
  / `ENABLE_STRIPE_PAYMENTS` / `ALLOW_DUMMY_PAYMENT` appear ONLY in docs). `paymentGatewaysInitialize`
  + `transactionProcess` mutations exist in `payment.graphql` (byte-identical to upstream) but are
  referenced by ZERO code. Generated docs `PaymentGatewaysInitializeDocument` /
  `TransactionProcessDocument` already emitted (gitignored `generated/`; rebuilt by
  `pnpm generate:checkout` in prebuild).
- `lib/navigate-to-order.ts`: `navigateToOrderConfirmation(orderId: string)` =
  `window.location.replace(buildOrderConfirmationPath({orderId}))` via `@/session-bridge`; **does NOT
  clear the cookie** (documented deferral to B.4.5). Exact name+signature match for upstream callers.
- `hooks/use-checkout.ts` → `{checkout, fetching:false, refetch: refreshCheckout, hasCheckoutId}`;
  `providers/checkout-data.tsx` → `refreshCheckout(): Promise<ServerCheckout|null>` (zero-arg call-
  compatible with upstream's `(options?)` variant). `CheckoutFragment` HAS `channel{id slug}`,
  `authorizeStatus`, `chargeStatus`, `availablePaymentGateways{...PaymentGatewayFragment(id name
  currencies config)}`, `totalPrice.gross`, `subtotalPrice.gross`, `discount`. **Lacks** upstream's
  `problems{CheckoutProblemDeliveryMethodInvalid/Stale}` (payment-step's `hasInvalidDelivery` banner
  must be dropped or MAKY-guarded) and upstream's `delivery{}` shape.
- `checkout-app.tsx` (`"use client"`): nests `AuthProvider > CheckoutUserProvider >
  CheckoutDataProvider > ErrorBoundary(PageNotFound) > Suspense(CheckoutSkeleton) > SaleorCheckout`.
  Its doc-comment names the omitted upstream pieces: **"the payment single-flight transport +
  StripeCheckoutCompletionHost (B.4.4/B.8)"** → that is the seam this step fills (module-scope
  `setCheckoutTransport(nextCheckoutTransport)`, exact upstream pattern; legal client→"use server"
  action-proxy). Imported only by `checkout-session-loader.tsx` (RSC), itself only by
  `app/checkout/page.tsx`.
- `tsconfig` paths: only `@/*→./src/*`, `@ui/*→./src/components/*`. **No import-boundary lint rules**
  (eslint = `eslint-config-next/core-web-vitals` + ignores). Vitest `4.0.17`, config
  `{globals, environment:"node", include:["src/**/*.test.ts"], @→./src}` — **no `setupFiles`**.
- Checkout is **100% hardcoded EN** (`git grep useTranslations src/checkout/` → 0). 13-locale parity
  script reads ONLY `src/i18n/messages/` → checkout EN additions cannot break parity (13/13 stays).
- `@stripe/react-stripe-js@6.6.0` + `@stripe/stripe-js@9.8.0` installed since B.1 (unimported today).

## 3. File list (NEW / CHANGED / DELETED)

### NEW — adopt BYTE-IDENTICAL (20)
`src/checkout/lib/payment/`: `types.ts`, `integrated-gateways.ts`, `resolve-provider.ts`,
`execute-payment.ts`, `gateway-messages.ts`, `providers/dummy.ts`, `providers/dummy-pay.ts`,
`complete-order.ts`, `checkout-pay-amount.ts`, `checkout-payment-status.ts`,
`checkout-payment-completion.ts`, `format-checkout-complete-error.ts`, `update-billing.ts`,
`should-show-payment-method-area.ts` · `src/checkout/lib/`: `payment-gateways.ts` (shim),
`billing-addresses.ts`, `shipping-address-submit.ts` · `components/payment/`: `payment-method-area.tsx`,
`payment-error.tsx` (already hardcoded EN) · repo root: **`vitest.setup.ts`** (sessionStorage
MemoryStorage polyfill — REQUIRED; without it `checkout-payment-completion.test.ts` throws
`sessionStorage is not defined` on node env; empirically confirmed node v24).

> ⚠️ `payment-method-area.tsx` value-imports `./integrated-payment-ui` (which we adapt) — so it is
> "byte-identical source" but only compiles once `integrated-payment-ui.tsx` (adapted) is present.

### NEW — adopt with EXACT stated adaptation (8)
- `providers/stripe.ts` → **PREDICATES-only trim**: keep `STRIPE_GATEWAY_ID,
  STRIPE_PAYMENT_NOT_ENABLED_MESSAGE, isStripeGateway, findStripeGateway, isStripePaymentEnabled,
  isStripeExpressCheckoutEnabled, getStripePaymentGuardError`. Drop config parsers → B.8. (Constraint:
  `integrated-gateways.ts` value-imports `findStripeGateway/isStripeGateway/isStripePaymentEnabled`;
  those + `STRIPE_GATEWAY_ID` + `getStripePaymentGuardError` MUST survive.)
- `finalize-checkout-order.ts` → repoint `@/checkout/lib/payment/navigate-to-order` →
  `@/checkout/lib/navigate-to-order` (MAKY's B.4.3 file).
- `lib/payment/index.ts` → drop re-exports of trimmed stripe symbols.
- `lib/checkout-transport.ts` → repoint `@/checkout/graphql/generated/operations` →
  `@/checkout/graphql` (MAKY codegen emits only `generated/index.ts`); fix stale `(checkout)`
  doc-comment. (Type-only imports; needed for tsc, not vitest.)
- `lib/checkout-action-types.ts` → drop `DeliveryOptionsActionResult` (MAKY `checkout-types` has no
  `DeliveryOption`).
- `components/payment/integrated-payment-ui.tsx` → stripe case renders MAKY
  `StripePaymentPlaceholder` instead of `StripePayment` (removes the sole `./stripe/*` import → ZERO
  `@stripe/*` edges in the adopted set, grep-verified).
- `components/payment/payment-gateway-alerts.tsx` + `dummy-payment-placeholder.tsx` → D1: remove
  `useTranslations`, inline EN verbatim from upstream `messages/en.json` `checkout.gateways.*` /
  `checkout.payment.*` (e.g. `"Unsupported payment gateway"`, `"This checkout does not support the
  available payment gateway(s): {gateways}."`, none / dummy_missing variants).
- `hooks/use-checkout-payment.ts` → repoint navigate-to-order (2 call sites: :25/:169 and via
  finalize); imports the two message hooks from their upstream paths (we author them, below).

### NEW — MAKY-authored (4)
- `hooks/use-checkout-gateway-messages.ts` + `hooks/use-checkout-payment-messages.ts` — same export
  names + paths as upstream, body = memoized EN maps (D1). B.7 later swaps the body to next-intl
  without touching consumers.
- `components/payment/stripe-payment-placeholder.tsx` — inert EN info box ("Stripe payment UI is not
  available in this storefront yet."). B.8 deletes it.
- `src/checkout/checkout-transport-next.ts` — `nextCheckoutTransport` mapping the 6 transport methods
  to server actions (`fetchCheckout: refreshCheckoutAction` is shape-exact today; the rest wrap the
  new `{ok}`-shaped actions incl. orderId extraction).

### NEW — tests (9)
Byte-identical: `resolve-provider.test`, `execute-payment.test` (installs fake transport via
`setCheckoutTransport` — API matches), `checkout-pay-amount.test`, `checkout-payment-status.test`,
`checkout-payment-completion.test` (needs `vitest.setup.ts`), `format-checkout-complete-error.test`,
`should-show-payment-method-area.test`, `shipping-address-submit.test` + **predicate-only subset of
`providers/stripe.test`** (trim parser/resolver blocks; keep `isStripeGateway/findStripeGateway/
isStripePaymentEnabled/isStripeExpressCheckoutEnabled/getStripePaymentGuardError`).

### CHANGED (7 + docs)
`lib/actions.ts` (§4), `checkout-app.tsx` (install transport), `views/saleor-checkout/payment-step.tsx`
(E9 rewire, §5), `components/payment/index.ts` (barrel: drop selector exports, add area/alerts/etc.),
`lib/navigate-to-order.ts` (doc-comment only — references old action name), `vitest.config.ts`
(+`setupFiles: ["./vitest.setup.ts"]`), `.env.example` (+4 commented flags, docs only) · docs:
`known-issues.md` + `track-b-master-plan.md`.

### DELETED (1)
`components/payment/payment-method-selector.tsx` (+ its exports from the barrel). Old urql-shaped
`transactionInitializeAction` + `checkoutCompleteAction` are removed from `lib/actions.ts` in the
rewire commit (sole consumer = payment-step).

### DEFERRED to B.8 (NOT adopted now)
All `components/payment/stripe/*` (15 files) **including `stripe-checkout-completion-host.tsx`** —
⚠️ this OVERRIDES `track-b-master-plan.md` §3, which listed the completion-host under B.4.4. Marek-
approved boundary shift (the host also needs `providers/checkout-session` +
`checkout-payment-return-error`, which MAKY lacks). Also deferred: `stripe-transaction-storage.ts`,
`format-stripe-pay-error.ts`, `reconcile-checkout-session-storage.ts`, `complete-free-order-checkout.ts`
(+ their tests), `payment-trust-signals.tsx` (needs `@/lib/content`; trust copy = B.6-adjacent).

### DO NOT TOUCH (hard boundary)
`order-summary.tsx` (saleor10 / Tax(VAT) / 30-day / "Free" → B.6), `express-checkout/*` (E8, not
sanctioned), `confirmation-step.tsx`, information/shipping steps, `flow.ts`, `mobile-sticky-action.tsx`,
`src/i18n/messages/*` (13/13 parity), `.env` (no flags set anywhere), Saleor config, **Dummy app not
installed**.

## 4. Server actions (guards — defense in depth)

Add 4 new `{ok}`-shaped actions to `lib/actions.ts`, all `executePublicGraphQL` (c0fcfa1 LOCKED;
upstream uses authenticated — deliberate divergence, add a doc-comment):
- `initializePaymentGatewaysAction` — no guard. ⚠️ operation is `paymentGatewaysInitialize` (plural)
  but the payload FIELD is `paymentGatewayInitialize` (singular) — extract `data.paymentGatewayInitialize`.
- `initializeCheckoutTransactionAction` — `getDummyPaymentGuardError` + `getStripePaymentGuardError`
  + amount-tamper re-verify (`fetchCheckoutOnServer(checkoutId)` → `getCheckoutPayAmount` →
  `hasMaterialCheckoutTotalChange`, ε 0.01). EN error constants (D1).
- `processCheckoutTransactionAction` — mirror guard `!isStripePaymentEnabled() &&
  !isDummyPaymentAllowed()` → EN "Payments are not enabled in this environment."
- `runCheckoutCompleteAction` — returns `{ok:true, orderId}` from `payload.order.id` (selection has
  `order{id}`); **NO cookie-clear / NO revalidation** (B.4.5; upstream's `after()` deliberately
  omitted). Note: B.4.5 will need `order.channel{slug}` added to the selection (regen) for the cart/
  chrome revalidation.

## 5. E9 — safe mock-UI removal (sanctioned)

Rewire `payment-step.tsx`, **keeping** MAKY billing UI + state (billingData/sameAsBilling shape is
what `use-checkout-payment` expects), CheckoutSummaryContext, back-nav, MobileStickyAction.
- **Out:** `dummyGatewayId` const, `hasDummy/hasRealGateway` branching, `PaymentMethodSelector` +
  card/PayPal/iDEAL state, `isCardDataValid` gate, manual amber/blue banners, the dead-end string,
  direct action calls.
- **In:** `useCheckoutPayment()` (submit pipeline: billing update → live refetch → price-change notice
  → `markPaymentCompleting` → `executePayment` → `navigateToOrderConfirmation`), `<PaymentGatewayAlerts>`,
  `shouldShowPaymentMethodArea` → `<PaymentMethodArea>`, `<PaymentError>` (payment errors now in the
  payment block, not the billing field), EN price-change amber banner. Pay button + sticky bar gate on
  `!usesClientPaymentSubmit`; disable = `isLoading || (!canSubmit && !isFreeOrder)`.

## 6. Decisions

- **D1 (LOCKED)** — hardcoded EN placeholders for all new copy; SK i18n → B.7 (13/13 parity intact).
- **D2 (DONE)** — "Method —" fix already landed (`6e07357`, fragment-free local fix). known-issues has
  a STALE "deferred to B.4.4" entry → move it to resolved during commit 5.
- **D3 (APPROVED)** — `saveAddress` flag DROPPED in the MAKY transport. MAKY's
  `checkoutBillingAddressUpdate` mutation has no `$saveAddress`; no `.graphql` change. Authenticated
  users won't save billing into the address book (= today's MAKY behavior; guests unaffected).
  Re-orderable into B.4.5/B.7 if desired (mutation change + regen).
- **D4 (APPROVED)** — `payment-trust-signals.tsx` NOT adopted (content-catalog dep + trust copy is B.6).
- **D5 (APPROVED)** — completion-host + entire `stripe/` tree → B.8 (overrides master-plan §3).
- **D6 (APPROVED)** — keep `isStripeExpressCheckoutEnabled` predicate in the trimmed `stripe.ts`
  (pure env predicate; holds a test block; shrinks the B.8 diff).
- **Stripe OFF until B.8; Dummy app NOT installed.**

## 7. §10 touches (Spec-B pre-approved; enumerated)

Checkout logic: payment-step rewire, 4 new / 2 deleted server actions + guards, transport seam +
install in `checkout-app.tsx`. **Saleor/GraphQL structure: 0 changes** (no document/fragment/codegen
edits). Cart, channel/routing/i18n locale, CFM, deploy: 0. Env/secrets: only `.env.example` comments,
no runtime values.

## 8. Validation

Worktree per `track-b-master-plan.md` §5 (fresh `rm -rf node_modules && pnpm install --frozen-lockfile`
— base carries B.1 deps, no `cp -al` from /opt; copy gitignored `src/gql` + `src/checkout/graphql/
generated` or let prebuild regen; copy `.env` + `.husky/_`). Then: **tsc 0 · lint 0 · `pnpm test:run`
green** (5 existing + 9 adopted test files; the WIN scenario is unit-covered — `resolve-provider.test`
has the identical `[stripe]`→unsupported input) · **build 0** · **parity 13/13** (run to prove, though
messages untouched) · light-only visual + desktop/mobile screenshots of the payment step.

**Runtime smoke (PROD build only — dev auto-enables Stripe; port 3037, NEVER 3032, clean env):**
1. `next start -p 3037` → `/sk` 200 + CSS 200.
2. Real sk-eur checkout (browser add-to-cart) → `/checkout?checkout=<id>` → Information→Shipping
   regression intact → **Payment: "Unsupported payment gateway" alert with Stripe, no mock card UI,
   no dead-end string, Pay disabled, billing section intact.** = runtime proof of B.4.4.

## 9. Rollback

Branch-only. Prod + the base tip stay untouched. Rollback = don't merge / delete
`track-b/checkout-v2-payment` + `git worktree remove`. No deploy, no PM2, no Saleor change.

## 10. What B.4.4 is NOT (do not lose)

- **NOT the last part of B.4.** B.4.5 (MIGRATION 8 session mgmt) remains entirely:
  `revalidate-storefront-chrome` + `sync-auth-surfaces-after-sign-in` + wire checkout sign-in →
  `loginWithBff()` + deferred cookie-clear/revalidate in complete (`after()`, needs `order.channel
  {slug}`). **Nothing from B.4.5 was done en route** (grep-verified: zero revalidate/sync-auth hits in
  the checkout tree; `navigate-to-order` clears no cookie; sign-in still on client auth-sdk).
- **Does NOT close the B.4.3 order-confirmation caveat.** Real order → `/checkout/complete` render
  stays UNVERIFIED (only graceful not-found proven; anonymous `order(id)` readability unproven).
  Closes only via (i) Dummy app in a controlled non-sk-eur channel WITH explicit Marek OK, or (ii) B.8
  Stripe test order.
- **Dummy app not installed** on any channel; B.4.4 = code capability + graceful unsupported only.
- Known benign residue (record in docs): a successful dummy payment leaves sessionStorage
  `checkout:payment-completing` set (no MAKY reader — latent, resolved when a completion-screen is
  adopted in B.8); the unsupported message would cosmetically also list a gift-card gateway if one
  existed (MAKY has none); a €0 checkout would bypass the disable (MAKY has no €0 SKUs).

## 11. Commit plan (5, each green)

1. `test(checkout)`: `vitest.setup.ts` + `setupFiles` config (infra for payment tests).
2. `feat(checkout)`: adopt payment lib closure (lib/payment/* + 5 lib files + 9 tests) — inert, nothing
   imports it yet.
3. `feat(checkout)`: `{ok}`-shaped payment actions + guards + `CheckoutTransport` impl + install in
   `checkout-app.tsx`.
4. `feat(checkout)`: payment components + `use-checkout-payment`; **rewire payment-step, delete mock
   selector (E9)** + delete old actions — runtime smoke gate.
5. `docs`: known-issues (move stale "Method —" entry to resolved; ADD launch-tracking (b) "unsupported
   copy is EN" — master-plan claims it's there but it is not) + master-plan §0/§1c.

## 12. Upstream source pointers (read verbatim while implementing)

- Rules: `git show upstream/main:skills/saleor-paper-storefront/rules/checkout-payment-gateways.md`.
- Registry + providers + pipeline: `git show upstream/main:src/checkout/lib/payment/<file>`.
- UI + step + hook: `git show upstream/main:src/checkout/components/payment/<file>` /
  `.../views/saleor-checkout/payment-step.tsx` / `.../hooks/use-checkout-payment.ts`.
- Server actions reference: `git show upstream/main:src/app/(checkout)/actions.ts` +
  `.../checkout-transport.ts` (adapt to MAKY variant C — no route group).
- EN copy source: `git show upstream/main:messages/en.json` (`checkout.gateways`/`checkout.payment`).
- Test infra: `git show upstream/main:vitest.setup.ts` + `vitest.config.ts`.
- MIGRATION step 7 + verify gate: `.../migrations/atomic/2026-06-checkout-v2/MIGRATION.md` +
  `verify.md` (payment gate: "Dummy or Stripe payment completes → lands on /checkout/complete?order=").
