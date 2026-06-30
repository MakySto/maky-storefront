# Branch B — Functional Withdrawal Function (§20a) — implementation spec — v1

**Status:** design intent (written spec = design source per `CLAUDE.md §2`). **Date:** 2026-06-30.
**Branch:** `feat/withdrawal-function` (off `feat/legal-content-pages` — needs the `/sk/odstupenie-od-zmluvy`
page + footer that Branch A shipped). **Execution: a fresh thread (browser Claude + CC).** This doc is
**analysis + brief only**; no code is written here.
**Companion:** `legal-content-pages-spec.md` (Branch A, deployed 2026-06-30) · `feat-stripe-checkout-spec.md`.

## Why (legal mandate — not optional)

Act **310/2025 Z. z.** added **§20a** to the consumer-protection act **108/2024 Z. z.**: an e-shop that
concludes distance consumer contracts must provide a **functional online withdrawal function**
("Odstúpiť od zmluvy tu") — **effective 19. 6. 2026**. A plain e-mail address / downloadable PDF is **not
enough**. Non-compliance = SOI penalty €200 – 2 % of turnover.

This is **not a Stripe blocker** (the account activates on the legal pages), but it **must be live before
real consumer sales begin** — same gate as the Stripe checkout integration.

## What the law requires (hard requirements)

1. A **functional online function** to withdraw, clearly labelled (e.g. "Odstúpiť od zmluvy tu"),
   reachable on the site and **available throughout the withdrawal period**.
2. **Works for guests** — must NOT require a login. A guest identifies the contract by **order number +
   e-mail**.
3. **Not more complex than buying** (anti-dark-pattern); not hidden in navigation.
4. After submission, the system **automatically sends the consumer a confirmation of receipt on a durable
   medium (e-mail)** — **including the date and time of submission** (§20a ods. 3).
5. The law does **NOT** require automatic approval or automatic refund — only the simple electronic
   submission + the acknowledgement. **Marek approves + refunds manually** (outside this form).
6. **B2B excluded** — withdrawal is consumer protection; B2B orders are generally out of scope (relevant
   when a B2B track is added; keep the function for B2C).

## Step-0 verification findings (read-only, 2026-06-30)

- **Storefront sends NO e-mail today.** No mailer dependency (`nodemailer`/`postmark`/`sendgrid`/`resend`),
  no `SMTP_*`/`MAIL_*` env vars. The only "email" code is checkout **input fields** (customer e-mail).
  Auth e-mails (password reset, e-mail confirm) are sent by **Saleor**, delivered by the separate
  **`maky-smtp-app`** (Saleor SMTP app, PM2 — `CLAUDE.md §13` says never touch it).
- **`ExternalNotificationTrigger` mutation exists** in the generated GraphQL (`src/gql/graphql.ts:8356`),
  i.e. Saleor *can* trigger a notification e-mail via the SMTP app — but it needs (a) a configured e-mail
  template/event and (b) a **staff/app-permissioned token**, which the **public storefront token does not
  have**. So it is not directly callable from the public storefront as-is.
- **Server actions are the established pattern** (`"use server"` in `src/app/actions.ts`,
  `account/actions.ts`, `cart/actions.ts`, `ui/components/cart/actions.ts`) — they call Saleor GraphQL. A
  withdrawal submit handler fits this exactly.
- **Branch A shipped** the static `/sk/odstupenie-od-zmluvy` page (notice + verbatim model form) + the
  footer link. Branch B turns that page's static section into the **functional form**.

## ⭐ The crux: how to send the e-mail (decision — confirm at execution)

§20a ods. 3 requires an **acknowledgement e-mail with date + time** to the consumer, plus we want a
**notification to `info@maky.store`** so Marek can process it. The storefront currently has no e-mail
path. Three options:

- **Option A — Saleor `externalNotificationTrigger`** (reuse `maky-smtp-app`). Pros: no new infra, uses
  the existing deliverability. Cons: needs a custom Saleor e-mail **template** for the event, an
  **app/staff token** in the storefront (the public token can't call it), and templating arbitrary
  per-submission data (date+time, order no., IBAN) is awkward. More moving parts; touches Saleor/app
  config.
- **Option B — server action + direct SMTP (RECOMMENDED for v1).** A `"use server"` withdrawal action
  uses a minimal mailer (e.g. `nodemailer`) over the **same SMTP relay `maky-smtp-app` already uses**
  (creds from SSM/env, **never the repo**). Sends **two** mails: (1) consumer acknowledgement (date+time),
  (2) `info@maky.store` notification with all fields. Pros: self-contained, full control of content
  (exactly what §20a needs), reliable, no Saleor-permission entanglement. Cons: **new dependency**
  (`nodemailer`) → flag for approval (`§10`/§10 "no new deps without approval"); SMTP creds added to
  storefront env/SSM.
- **Option C — a tiny internal API/endpoint on the existing mail app.** `maky-smtp-app` is "never touch"
  (§13) and is event-driven, not a custom-mail endpoint → **rejected** unless it already exposes a safe
  endpoint (verify; likely not).

**Recommendation:** **Option B.** Confirm at execution: the SMTP host/credentials `maky-smtp-app` uses
(so Branch B reuses the same verified relay), and get Marek's OK for the `nodemailer` dependency. If
Marek prefers no new dep, fall back to Option A (configure a Saleor template + an app token in SSM).

## Architecture / flow (Option B)

```
/sk/odstupenie-od-zmluvy  (Branch A static page)
   └─ <WithdrawalForm>  (client component)
        fields: meno · číslo objednávky · e-mail · (voliteľne) IBAN · honeypot
        submit → server action  withdrawFromContract(formData)
                    1. validate (required, e-mail format, honeypot empty, basic rate-limit)
                    2. stamp submittedAt = server timestamp (date + time)  ← §20a ods. 3
                    3. send mail #1 → consumer: acknowledgement incl. submittedAt + order no.
                    4. send mail #2 → info@maky.store: full details (the archive/record)
                    5. return { ok } → show success state ("Prijali sme…")  /  recoverable error
```

- **Guest-first:** no auth; identification = order number + e-mail (NOT validated against Saleor in v1 —
  Marek verifies manually). Do not gate behind login.
- **Record/archive (§20a):** the `info@maky.store` e-mail **is** the record for v1 (no DB needed — the
  storefront has none of its own; Saleor is the backend). Optional later: also write a Saleor order note
  via metadata. Keep v1 simple: e-mail = record.
- **Trigger labelling:** the existing footer "Odstúpenie od zmluvy" link → the page → the form satisfies
  "clearly labelled + available throughout the period." Optionally add a prominent on-page
  "Odstúpiť od zmluvy tu" heading/button anchoring the form.

## Implementation steps (for the execution thread)

- **Step 0 (read-only, report):** confirm the SMTP relay `maky-smtp-app` uses (host/port/auth source in
  SSM) so Option B reuses it; confirm no storefront mailer exists; re-read the Branch-A
  `odstupenie-od-zmluvy/page.tsx` to see where the form slots in; confirm the server-action + Saleor
  GraphQL client setup.
- **Step 1 — Form UI:** a client `<WithdrawalForm>` on `/sk/odstupenie-od-zmluvy` under the existing
  static notice (keep the model form as a downloadable/alternative). Fields meno + číslo objednávky +
  e-mail + optional IBAN + a hidden **honeypot**; 44px controls; clear required-field validation; SK copy;
  accessible. Button **"Potvrdiť odstúpenie od zmluvy"**.
- **Step 2 — Server action `withdrawFromContract`:** `"use server"`; validate; stamp `submittedAt`
  (date+time); send the 2 e-mails via the chosen path; basic anti-abuse (honeypot + light rate-limit);
  return a typed result. Secrets from env/SSM only.
- **Step 3 — Confirmation e-mails:** (1) consumer acknowledgement — SK, durable, includes **date + time**
  of submission + order number + a recap; (2) `info@maky.store` notification — all fields + timestamp.
  No invented promises (no auto-refund language — the law doesn't require it; state the next steps
  truthfully).
- **Step 4 — Texts (coordinate with Branch A content):** when the function is live, update the public
  text + VOP §6.3 to list the **online function** as a withdrawal method (the v4 text currently lists
  e-mail + model form only, because the function wasn't live). Edit
  `docs/design/MAKY_STORE_pravne_stranky_SK.md` + the `obchodne-podmienky` + `odstupenie-od-zmluvy` pages.
- **Step 5 — Validation:** typecheck + lint + `next build` per `§13` (build in a **worktree / spare
  port**, never the live dir); end-to-end test (submit → both e-mails arrive → success UI); guest path
  works without login; honeypot/rate-limit works; deploy per `§13`.

## Truthfulness / legal guard

- The acknowledgement is **receipt of the withdrawal notice**, not approval/refund confirmation — word it
  so (don't promise an automatic refund). Marek processes manually.
- Returns window stays consistent with VOP/Branch A (**14 dní hosť / 30 dní registrovaný**).
- B2B: keep the function for B2C; exclude B2B when that track exists.
- Secrets (SMTP) only in env/SSM — never in repo, docs, or chat.

## Definition of Done

- [ ] `/sk/odstupenie-od-zmluvy` has a **functional** form: meno + číslo objednávky + e-mail (+ optional
      IBAN), "Potvrdiť odstúpenie od zmluvy", **works for guests (no login)**, not hidden, ≤ buying
      complexity.
- [ ] On submit: consumer gets an **acknowledgement e-mail incl. date + time** (§20a ods. 3);
      `info@maky.store` gets a full notification (the record). Both delivered via the verified relay.
- [ ] Validation + honeypot + light rate-limit; clear success + recoverable error states.
- [ ] VOP §6.3 + the public text updated to list the online function as a withdrawal method.
- [ ] typecheck + lint + `next build` per `§13`; e2e e-mail test green.
- [ ] New dependency (if `nodemailer`) approved; SMTP secrets only in SSM/env.
- [ ] Report before commit; deploy per `§13`; **before real consumer sales** (with Stripe checkout).

## Out of scope

Refund/approval automation · order-number validation against Saleor (v1 = manual) · a withdrawal
dashboard / DB · multilingual (SK only for now) · the Stripe checkout integration (separate) ·
PDP/PLP/homepage layout.

## Appendix — kickoff prompt for the `feat/withdrawal-function` thread

```text
We are implementing Branch B — the functional §20a withdrawal function for MAKY.STORE.

First read: docs/design/feat-withdrawal-function-spec.md (this spec),
docs/design/legal-content-pages-spec.md (Branch A context + the /sk/odstupenie-od-zmluvy page already
shipped), CLAUDE.md (§2, §9, §10 [new dep approval], §11, §13).

Base: feat/legal-content-pages. Branch: feat/withdrawal-function.

LAW: §20a (Act 310/2025 amending 108/2024), effective 19 Jun 2026 — a functional online withdrawal
function is mandatory; e-mail/PDF alone is not enough. Must work for GUESTS (order number + e-mail, no
login), be clearly labelled, not more complex than buying, and auto-send the consumer an acknowledgement
e-mail WITH DATE + TIME of submission. No auto-approval/refund required (Marek does that manually).

STEP 0 (read-only, report): the storefront sends NO e-mail today (no mailer, no SMTP env); confirm the
SMTP relay maky-smtp-app uses (so we reuse it); re-read odstupenie-od-zmluvy/page.tsx; confirm the
server-action + Saleor client setup.

EMAIL PATH (decide with Marek): Option B (recommended) = "use server" action + nodemailer over the same
SMTP relay (creds from SSM, never repo); sends 2 mails (consumer acknowledgement w/ date+time +
info@maky.store notification = the record). Needs Marek's OK for the nodemailer dep. Fallback Option A =
Saleor externalNotificationTrigger (needs a template + app token).

BUILD: functional <WithdrawalForm> on /sk/odstupenie-od-zmluvy (guest, fields + honeypot, "Potvrdiť
odstúpenie od zmluvy") → server action (validate, stamp submittedAt, send both e-mails, anti-abuse) →
success/error UI → update VOP §6.3 + public text to list the online function.

VALIDATION: typecheck + lint + next build per §13 (worktree/spare port, never live dir); e2e (submit →
both e-mails → success); guest works without login; secrets only in SSM/env. Report before commit;
deploy per §13. Must be live BEFORE real consumer sales (with the Stripe checkout integration).
```
