# Stripe Checkout Integration — implementation spec — v1

**Status:** design intent (written spec = design source per `CLAUDE.md §2`). **Date:** 2026-06-30.
**Branch:** `feat/stripe-checkout` (off `feat/token-bridge`). `CLAUDE.md §10` task (touches checkout) →
explicit approval required; no real orders enabled until live + verified.
**Companion:** `legal-content-pages-spec.md` (legal pages name "Stripe" — this spec makes that true) ·
`feat-withdrawal-function-spec.md` (Branch B; must also be live before real consumer sales).

> Authored by Marek's planning advisor; reviewed by CC through the truthfulness lens — its claims about
> the current code (dummy gateway, mockup card form, `src/_reference/` Stripe code, no `@stripe/*` deps)
> **match CC's earlier workflow verification**. Accurate and ready to execute (with §10 approval).

## Why this is the real blocker

Legal pages + Stripe account activation unlock the **account**, not the ability to take money. Checkout
today runs the Saleor dummy gateway (`mirumee.payments.dummy`, fake `CHARGE_SUCCESS`); the card form is a
non-functional mockup; real Stripe code is build-excluded in `src/_reference/`. **No customer can
actually pay until this branch ships.** This is step 4 of the critical path (legal → gtm-consent merge →
account activation → **Stripe checkout integration** → §20a withdrawal → checkout copy cleanup).

## Credentials note (read first)

Writing this spec needs no Stripe secrets. At setup time the keys go into the Stripe App config form in
the Saleor Dashboard (not the storefront env) and the app's own `.env`/SSM — never into the repo, a
committed doc, or chat. Needed at setup (handled by CC/Marek, kept in SSM/app config):

- Stripe Secret Key (`sk_test_…` then `sk_live_…`) — pasted into the Stripe App config form.
- Stripe Publishable Key (`pk_test_…`/`pk_live_…`) — also in the app config; the storefront receives it
  back from `transactionInitialize`/`paymentGatewayInitialize`, so it likely does not need to live in
  storefront env.
- Webhook signing secret — created automatically by the Stripe App; no manual entry.
- ⚠️ The Stripe App does not work with Restricted Keys — use a standard secret key.

## Decisions

**Locked (architecture)**

1. **App-based, Transactions API** — use the official Saleor Stripe App (`app.saleor.stripe`) + Stripe
   Payment Element. NOT the legacy Stripe plugin (deprecated; incompatible with 3.22 features like
   automatic checkout completion).
2. **Self-host the Stripe App.** Saleor here is self-hosted (no Cloud), so the app must be self-hosted and
   installed via its manifest URL — same pattern Marek already used for `saleor-app-smtp` (PM2 process,
   own subdomain e.g. `stripe-app.maky.store`, an APL). Reuse that deployment playbook.
3. **Test-first, then live.** Build + verify end-to-end with `sk_test`/`pk_test` (full card + 3DS matrix,
   order creation, webhook → transaction sync). Only then switch to live keys.
4. **Hard guard:** the store must not accept real customer orders until Stripe is live and verified. The
   legal pages name "Stripe"; until the live path works, a real sale would route through a fake gateway.

**Marek to confirm (sensible defaults below — proceed on these unless he says otherwise)**

1. **Capture mode** (channel `defaultTransactionFlowStrategy`): default = **CHARGE** (immediate capture) —
   simplest, standard for SK e-shops, no auth-expiry to manage. Alternative: AUTHORIZATION (auth at
   checkout, capture on fulfilment) — cleaner for physical goods that ship later and reduces refund
   friction, but adds ops (Stripe auths expire ~7 days; you must capture on dispatch). Recommend CHARGE
   for launch; revisit later.
2. **Payment methods:** default = **cards + Apple Pay / Google Pay** via Payment Element (wallets are
   near-free to enable and lift conversion). Local CEE methods deferred to the cross-border wave.
3. **Checkout completion:** default = **explicit `checkoutComplete`** after payment success (full control
   + easy to verify). Saleor 3.22 `automaticCompletion` (with `cutOffDate`/delay) is an option later; if
   enabled, set `cutOffDate = now` first so only new checkouts auto-complete while you verify the flow.

## Verified grounding (Saleor docs, 2026-06-30)

- **Flow:** fetch `Checkout.availablePaymentGateways` → find `app.saleor.stripe` →
  `transactionInitialize(id, paymentGateway:{id,data}, amount)` returns a `data` blob with the client
  secret + publishable key → mount Stripe Payment Element → `elements.submit()` then
  `stripe.confirmPayment({elements, clientSecret, confirmParams:{return_url}})` → 3DS handled by Elements
  → Stripe webhook → app updates the Saleor Transaction (`CHARGE_SUCCESS`/`AUTHORIZATION_SUCCESS`) →
  `checkoutComplete` creates the Order.
- `transactionProcess` is used only if init returns `CHARGE_ACTION_REQUIRED`/`AUTHORIZATION_ACTION_REQUIRED`
  (additional/3DS steps).
- **App config:** install in Dashboard, paste Secret + Publishable Key; webhooks auto-created; supports
  multiple configs per channel (test/prod) mapped to Saleor channels.
- Capture controlled by `action` arg / `channel.defaultTransactionFlowStrategy` (CHARGE vs AUTHORIZATION).
- **Amounts:** Stripe needs minor units (cents). Currency here is EUR (`sk-eur` channel) → ensure correct
  decimal→cents conversion (the deprecated example hardcoded USD — do not copy that).

## ⚠️ CC must verify against the actually-installed app version (do NOT assume)

- Exact `data` field names from `transactionInitialize`: docs show inconsistency between versions
  (`data.paymentIntent.client_secret` + `data.publishableKey` vs `data.stripeClientSecret`). Verify the
  real shape from the installed Stripe App and type the storefront code to it.
- Manifest / gateway id (`app.saleor.stripe` vs `saleor.app.payment.stripe`) — confirm from the installed
  app's manifest.
- Whether anything reusable already exists in `src/_reference/` (build-excluded Stripe demo) — evaluate,
  don't blindly lift.

## 🟠 Risk: official Stripe App is Preview Mode

May get breaking changes; older preview versions can lose support. Mitigation: pin a specific app
version, test the full matrix on it, and note the version in the deploy doc so an upgrade is a deliberate,
re-tested step (same discipline as the SMTP App TLS patch).

## Work breakdown

**Step 0 — Verify (read-only, report before building)**

- Current Saleor payment config: which payment apps/plugins are installed; confirm the dummy handler
  locations (`payment-step.tsx:20,303-311`), the mockup card form (`payment-method-selector.tsx`), and the
  `src/_reference/` Stripe code.
- How `saleor-app-smtp` is deployed (PM2, subdomain, APL, SSM) — the template for the Stripe App.
- Checkout amount/currency handling (EUR, cents) and where `availablePaymentGateways` is (or isn't)
  queried.
- Storefront Stripe deps present? (`@stripe/stripe-js`, `@stripe/react-stripe-js`).

**Step 1 — Backend: deploy + install + configure the Stripe App**

- Deploy the Saleor Stripe App self-hosted (PM2, `stripe-app.maky.store`, APL), pinned version. Ensure the
  app URL is publicly reachable for Stripe webhooks (Cloudflare: the app endpoint must be reachable;
  confirm proxy/SSL behaviour — webhooks come from Stripe to the app, not through the storefront).
- Install via manifest URL into the Saleor Dashboard; create a test config (sk_test/pk_test) mapped to the
  `sk-eur` channel; confirm webhooks auto-registered in the Stripe dashboard.
- Set the channel `defaultTransactionFlowStrategy` per Decision 5 (capture mode).

**Step 2 — Frontend: real Payment Element flow (replaces dummy + mockup)**

- Add `@stripe/stripe-js` + `@stripe/react-stripe-js` (only new deps; justify in commit).
- Query `availablePaymentGateways`; select `app.saleor.stripe`.
- Implement `transactionInitialize` (typed to the verified `data` shape) → get client secret + publishable
  key.
- Mount `<Elements>` + `<PaymentElement>`; on submit: `elements.submit()` →
  `stripe.confirmPayment({…, return_url})`; handle `*_ACTION_REQUIRED` via `transactionProcess`.
- On the `return_url` summary route: read transaction/checkout status; on success run `checkoutComplete`
  (idempotent — completing an already-completed checkout returns the existing Order); show order
  confirmation; on failure show a clear, recoverable error.
- Remove the dummy-gateway handler + the mockup card form. Pass an `idempotencyKey` to
  `transactionInitialize` (unique per `idempotencyKey`+gateway) to avoid double charges on retries.

**Step 3 — Checkout copy cleanup (bundled — was deferred Decision 6 of the legal spec)**

Same `src/checkout/` surface, so do it here, not separately:

- `order-summary.tsx`: remove the free-shipping badge + `shipping === 0 ? "Free"`; the latent "Tax (VAT)"
  / "Including VAT" lines (gated `tax>0`, fine while neplatiteľ but remove the hardcoded strings); the
  "30-day returns" line (align to 14/30 rule or drop); the dummy `saleor10` promo field.
- Order button must read "Objednávka s povinnosťou platby" (or equivalent) — the legal requirement the VOP
  already states; verify the actual button copy here.

**Step 4 — Test → live**

- Full test matrix: success card, declined card, 3DS-required test card, insufficient funds; verify each
  produces the correct Saleor transaction event + (on success) an Order; verify the webhook updates the
  transaction even if the browser closes after `confirmPayment`.
- Verify amount/currency exactness (EUR cents; no rounding drift) and that totals match the order summary.
- Swap to live keys (new live config in the app) only after the test matrix is green; do a single small
  real-card live smoke test; then the guard lifts.

## Truthfulness guard

- No real orders until the live path is verified — until then keep the store from accepting real consumer
  orders (the legal pages name Stripe). Coordinate with the §20a withdrawal function (must also be live
  before real consumer sales).
- No invented payment methods in copy — show what Payment Element actually offers.

## DoD

- [ ] Stripe App deployed (self-hosted, pinned version), installed, test config mapped to `sk-eur`,
      webhooks auto-registered.
- [ ] Storefront: `availablePaymentGateways` → `transactionInitialize` (typed to verified `data`) →
      Payment Element → `confirmPayment` → `checkoutComplete` creates an Order. Dummy handler + mockup form
      removed.
- [ ] 3DS test card completes; declined/insufficient handled gracefully; webhook-driven transaction update
      verified (incl. browser-closed case); idempotency in place (no double charge on retry).
- [ ] Amounts exact in EUR (cents), totals match summary.
- [ ] Checkout copy clean: no "Free"/free-shipping, no stray "Tax (VAT)" strings, return window consistent
      (14/30), order button = "povinnosť platby".
- [ ] typecheck + lint + `next build` per `§13` (build in worktree / spare port, never live dir).
- [ ] Secrets only in app config / SSM — none in repo, docs, or chat.
- [ ] Report before commit; `§10` approval before merge; live keys only after the test matrix is green; no
      real orders until then.

## Out of scope

Refund/cancel UI in the storefront (handle in Dashboard initially) · saved cards / off-session ·
subscriptions · local non-card CEE methods (cross-border wave) · multi-currency beyond EUR · the §20a
withdrawal form (separate Branch B) · PDP/PLP/homepage layout.

## Appendix — kickoff prompt for the `feat/stripe-checkout` thread

```text
We are implementing Stripe checkout integration for MAKY.STORE (CLAUDE.md §10 — checkout; explicit
approval required; do NOT enable real orders until live + verified).

First read: docs/design/feat-stripe-checkout-spec.md (this spec), docs/design/legal-content-pages-spec.md
(critical-path + the "Stripe named, no real orders yet" guard), CLAUDE.md (§2, §10, §11, §13).

Base: feat/token-bridge. Branch: feat/stripe-checkout.

APPROACH (locked): Saleor Stripe App (app.saleor.stripe) + Transactions API + Stripe Payment Element.
NOT the legacy Stripe plugin. Self-host the Stripe App (PM2 + subdomain + APL — reuse the saleor-app-smtp
playbook), pin its version (it is Preview Mode). Test keys first, live only after the full matrix passes.

STEP 0 (read-only, report back): verify the installed payment config + the dummy handler
(payment-step.tsx:20,303-311) + mockup card form (payment-method-selector.tsx) + src/_reference/ Stripe
code; how saleor-app-smtp is deployed; EUR/cents amount handling; whether @stripe/* deps exist; and the
EXACT transactionInitialize `data` field names + gateway/manifest id from the actually-installed app
(docs are inconsistent across versions — do not assume).

DECISIONS TO CONFIRM WITH MAREK (defaults): capture = CHARGE (immediate); methods = cards + Apple/Google
Pay; completion = explicit checkoutComplete.

BUILD: backend (deploy+install+configure app, test config → sk-eur channel, set defaultTransactionFlowStrategy,
confirm auto webhooks reachable through Cloudflare) → frontend (add @stripe/stripe-js + react-stripe-js;
availablePaymentGateways → transactionInitialize typed to verified data → Payment Element → elements.submit
+ confirmPayment(return_url) → transactionProcess for *_ACTION_REQUIRED → on return_url, checkoutComplete
(idempotent); remove dummy handler + mockup; idempotencyKey to avoid double charge) → checkout copy cleanup
(order-summary free-shipping/Tax(VAT)/30-day/saleor10; order button "Objednávka s povinnosťou platby").

VALIDATION: full test-card matrix incl. 3DS + decline; webhook-driven transaction update (incl. browser
closed); EUR cents exactness; typecheck + lint + next build per §13 (never in live /opt/storefront).
Secrets only in app config/SSM — never in repo/chat. Report before commit; §10 approval before merge;
live keys + real smoke test only after test matrix green; no real orders until then.
```
