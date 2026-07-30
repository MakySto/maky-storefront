# Online withdrawal function V1 — handoff

Status: **branch-only, not deployed, and blocked on three external deliverables.**
Branch `feat/withdrawal-form-v1`, based on production `007f75e`.

One withdrawal process, one backend contract, two UX modes. A guest and a signed-in
customer post the same body to the same endpoint and produce the same kind of record.
The account mode saves typing; it grants no different right, and signing in is never a
precondition.

---

## 1. What is built

| Surface                                          | Route                                                          |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Online function + explanation                    | `/sk/odstupenie-od-zmluvy`                                     |
| Statutory model form, printable and downloadable | `/sk/odstupenie-od-zmluvy/vzorovy-formular`                    |
| Shortcut from an order                           | `/sk/account/orders/[number]` → link, no order data in the URL |
| Footer, on every SK page                         | „Odstúpiť od zmluvy tu"                                        |

Non-SK channels 404 with `noindex, nofollow` and no canonical, matching the existing
legal-page behaviour.

Required fields are name, e-mail, a contract identifier and a scope. Optional: phone,
note, per-line quantities. **Not collected at all:** postal address, IBAN, order date,
delivery date, reason for withdrawal. There is no `receivedAt` field to be missing and
no date arithmetic anywhere, so a notice given before delivery is ordinary input.

---

## 2. Blocked on

Nothing below can be worked around from this repository, and each one is stated
precisely enough to act on.

### 2.1 Payload — `POST /api/forms/withdrawal` does not exist yet

The client is written against the contract below and exercised against a mock. It calls
the signed application endpoint and never the raw collection REST create.

**Request**

```
POST {PAYLOAD_CMS_URL}/api/forms/withdrawal
CF-Access-Client-Id, CF-Access-Client-Secret     ← network gate, existing service token
X-Maky-Forms-Timestamp: <epoch ms, integer>
X-Maky-Forms-Submission-Id: <uuid>
X-Maky-Forms-Signature: <hex sha256>
content-type: application/json
```

Signature is `HMAC-SHA256(MAKY_FORMS_HMAC_SECRET, timestamp + "." + rawBody)` over the
**exact bytes sent**, verified in constant time, with stale timestamps rejected
symmetrically (the storefront's own window is ±5 minutes).

Body:

```json
{
	"submissionId": "uuid",
	"source": "guest | account",
	"market": "SK",
	"locale": "sk",
	"customer": { "name": "…", "email": "…", "phone": null },
	"contract": { "orderNumber": "…", "saleorOrderId": null, "saleorCustomerId": null },
	"scope": "wholeOrder | selectedItems",
	"items": [{ "orderLineId": "…", "productName": "…", "sku": null, "quantity": 1 }],
	"note": null,
	"noticeSnapshot": "ODSTÚPENIE OD ZMLUVY\n…",
	"legalNoticeVersion": "…",
	"privacyNoticeVersion": "…"
}
```

**Response the client parses**

```
201  { "ok": true, "duplicate": false, "submission": {…} }   created
200  { "ok": true, "duplicate": true,  "submission": {…} }   submissionId already existed
4xx  { "ok": false, "error": { "code": "…", "message": "…" } }
5xx  upstream fault
```

`submission` must carry `submissionId`, `submissionNumber`, `submittedAt` (ISO 8601) and
`orderMatchStatus`. A 200 whose body does not match is treated as unavailable, not as
success — a receipt with no submission number behind it would be worse than an error.

Two deltas from the Codex brief, both deliberate:

- **`noticeSnapshot` is sent by the storefront.** Payload cannot reconstruct the exact
  text the customer confirmed, because the wording is rendered here. It is
  server-generated in the sense that matters — never by the browser — and must be stored
  immutably.
- **`sku` is always `null`.** The order query's variant selection does not request it and
  changing a Saleor GraphQL document needs sign-off (CLAUDE.md §10). `orderLineId` plus
  `productName` identify the item. One line of approval would close this.

Also needed: `PATCH /api/forms/withdrawal/:submissionId/email-delivery`, same signing,
permitted to touch **only** the delivery fields.

### 2.2 `maky-smtp-app` — no transactional send exists

This is the structural blocker, not a configuration gap. `maky-smtp-app` is the Saleor
SMTP app; its entire HTTP surface is `/api/manifest`, `/api/register`, `/api/trpc/[trpc]`
(admin configuration, authenticated as a Saleor app) and `/api/webhooks/*`. Each webhook
is bound to one member of a closed union — `MessageEventTypes` in
`apps/smtp/src/modules/event-handlers/message-event-types.ts` — of fifteen
Saleor-originated events (`ACCOUNT_*`, `ORDER_*`, `GIFT_CARD_SENT`, `INVOICE_SENT`).

A withdrawal notice is not a Saleor event, so none of them can carry it, and there is no
generic send.

**The missing contract, exactly:** an authenticated non-webhook endpoint accepting
`{ recipient, templateKey, payload }` and dispatching through the configured SMTP
provider — plus two templates, one for the customer and one for `info@maky.store`.

Rather than invent it, the mailer is an interface whose default implementation reports
`unsupported`. That routes into the delivery-failure path the law already requires us to
handle properly: the withdrawal stays received, the customer gets printable proof, and
delivery is recorded as failed for retry. The customer confirmation must, when it exists,
carry seller identity, submission number, the complete notice, submission date and time,
the order identifier, scope and items, an explanation that the notice was received, and
current return instructions — asserted as a list in `mail.ts` so the requirement cannot
quietly go missing.

### 2.3 Approved legal copy

`LEGAL_COPY_APPROVED` is `false` in `src/lib/withdrawal/contract.ts` and must stay false
until the reviewed Slovak legal-content artifact lands.
`assertLegalCopyApprovedForProduction()` is there for a deploy step to call.

No new legal prose was written here. The explanatory copy and the model form are carried
over verbatim from the previous page; the notice snapshot is assembled from values the
customer typed, company identifiers from `@/config/company`, and the statutory model
phrasing that was already published. Two things for the review thread: the model form
still asks for a postal address and an IBAN that the online function deliberately does
not require, and the „30 dní pre registrovaných" claim is inherited, not verified.

### 2.4 Environment

`MAKY_FORMS_HMAC_SECRET` is not set on the box. Until it is, the reader returns
`notConfigured`, submissions fail closed and the UI says so honestly — it never pretends
a notice was received. Optional: `MAKY_FORMS_TIMEOUT_MS` (default 8000).

---

## 3. Security model

|                           |                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Transport                 | Server Action. Next verifies Origin against Host on every invocation — that is the same-origin check.                         |
| Network gate              | Cloudflare Access service token, the existing pair.                                                                           |
| Application authorisation | Timestamped HMAC. This is what lets the Payload collection refuse anonymous creates outright.                                 |
| Secrets                   | Server-only, `import "server-only"`, never `NEXT_PUBLIC_`. Verified absent from HTML, RSC flight data and every client chunk. |
| Ownership                 | Re-derived from the session via Saleor `me.orders`. An order id in a form field is a claim and is discarded.                  |
| PII in URLs               | None. The receipt renders from action state; the order shortcut passes nothing.                                               |
| Anti-abuse                | Off-screen honeypot, per-IP (12/15 min) and per-e-mail (6/15 min) limits, 64 KB body cap, per-field lengths, max 50 items.    |
| Logs                      | Submission id, submission number, status codes, reasons. Never the notice, the name, the e-mail or a secret.                  |

The limiter shows the e-mail and postal routes on rejection rather than dead-ending a
legal notice, and a tripped honeypot is reported as blocked rather than as a fake
success — a false positive must not silently swallow a real submission.

---

## 4. Order of operations

```
1. validate                     ← authoritative, server-side
2. persist                      ← the moment the notice is "received"
3. take submissionNumber + submittedAt from the server
4. notify the customer          ┐
5. notify info@maky.store       ├ best-effort, cannot undo step 2
6. record delivery status       ┘
```

Failing step 2 shows an honest failure and the alternative routes; no e-mail is sent and
nothing is stored. Failing steps 4–6 leaves the withdrawal received, shows the printable
receipt, records delivery as failed and emits one structured alert.

Idempotency is the database's unique index on `submissionId`, not the UI. The
double-click guard is a courtesy; an in-memory token would not survive a restart, a
second process, or the retry-after-timeout case that matters most.

**The page must not be cached.** Each render mints the `submissionId`; a prerendered page
would hand every visitor the same one and the second submitter would receive the first
person's confirmation as a "duplicate" — their notice never stored, and a receipt that
looks entirely convincing. `export const dynamic` is rejected under `cacheComponents`, so
the opt-out is `connection()`. Verified: three requests, three different ids.

---

## 5. What was proven, and how

Unit and integration tests (83 new) cover validation, the notice snapshot, HMAC signing
and verification, every Payload outcome, ownership, and the full mail/delivery matrix.
On top of that, a real headless Chrome drove the form against a mock Payload endpoint
(no automation dependency — Node 24's built-in WebSocket speaks CDP directly):

| Case                                           | Result                                                       |
| ---------------------------------------------- | ------------------------------------------------------------ |
| Guest, whole order                             | received, `ODS-2026-000004`                                  |
| Retry with the same `submissionId`             | **same submission number, 6 POSTs → 5 stored records**       |
| Missing name, bad e-mail, missing order number | 3 fields flagged, focus on the first                         |
| Honeypot filled                                | blocked, alternatives offered, nothing stored                |
| Payload 500                                    | „neprijali sme" + alternatives                               |
| Payload timeout                                | „neprijali sme" + alternatives                               |
| Mail transport absent                          | received, printable proof, delivery marked failed, one alert |
| Secrets in HTML / client JS                    | none of five needles found                                   |
| Labels                                         | 7 controls, 0 unlabelled                                     |
| Keyboard                                       | submit reachable and activatable                             |
| 360 / 390 / 412 / 1440                         | no horizontal overflow at any width                          |
| Signature on every request                     | valid; no Payload `Authorization` header ever sent           |

Two of those started as false results caused by the test harness, not the product: the
page carries more than one `<form>` (the header search box is first in the document), and
React replaces nodes on hydration. Both were fixed by scoping to the withdrawal form and
waiting for hydration. Worth recording, because the first run reported a working honeypot
as broken and a broken idempotency test as a product bug.

---

## 6. Deferred

- Contact form on the same foundation — a separate follow-up, as agreed.
- A PDF model form. The current download is plain text: a PDF needs a dependency, and
  text is the more accessible artefact anyway.
- Retry of a failed confirmation e-mail. The record carries the failed status and the
  alert fires; the retry mechanism itself waits on 2.2.
- `sku` on withdrawal items — one GraphQL approval away.
