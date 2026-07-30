# Online withdrawal function V1 — handoff

Status: **branch-only, converged on the Payload Forms V1 contract, not deployed.**
Branch `feat/withdrawal-form-v1`, based on production `007f75e`.

One withdrawal process, one backend contract, two UX modes. A guest and a signed-in
customer post the same body to the same endpoint and produce the same kind of record.
The account mode saves typing; it grants no different right, and signing in is never a
precondition.

---

## 1. What changed in the convergence pass

The first version of this branch tested green against a mock of a contract the storefront
had invented for itself. Against the real Payload endpoint it would have failed **every
single request**, three times over.

| #   | Mismatch                                      | Effect                                                       |
| --- | --------------------------------------------- | ------------------------------------------------------------ |
| 1   | Timestamp sent as `Date.now()` — milliseconds | `INVALID_TIMESTAMP`; Payload accepts 10–11 digits            |
| 2   | Body carried `noticeSnapshot`                 | `INVALID_REQUEST`; unknown keys are rejected outright        |
| 3   | Body carried `customer.phone`                 | `INVALID_REQUEST`; withdrawal allows only `name` and `email` |

The third was not in the review that found the other two. It came out of reading the
endpoint's key allowlist line by line — worth recording, because two of the three were
invisible to a mock written from the same assumptions as the client.

Two further behaviours moved to where they belong:

- **Payload owns the notice.** It normalises the submission, stores the canonical
  `noticeSnapshot`, and generates `submittedAt` and `submissionNumber`. The storefront no
  longer builds a snapshot; it renders one, as a pure projection of what was stored.
- **Payload owns the e-mail.** The `maky-smtp-app` seam is gone, and so is the delivery
  PATCH after a normal create. The earlier finding stands — the Saleor SMTP app exposes
  only webhooks bound to fifteen fixed events and cannot carry a withdrawal — but the
  conclusion was too narrow: Payload sends through its own configured adapter, so the
  work simply belonged on the other side of the wire.

Guest partial withdrawal is now actually possible. It previously invited the customer to
describe the goods in the note, which the backend does not accept: `scope=selectedItems`
requires 1–100 structured `items`. A guest could not have exercised a right that does not
depend on having an account.

---

## 2. The wire contract

### Request

```
POST {PAYLOAD_CMS_URL}/api/forms/withdrawal
content-type: application/json
CF-Access-Client-Id / CF-Access-Client-Secret   ← network gate, existing service token
X-Maky-Forms-Timestamp:     1785000000          ← Unix SECONDS, 10–11 digits
X-Maky-Forms-Submission-Id: 3f2504e0-…
X-Maky-Forms-Signature:     <64 lowercase hex>
```

`HMAC-SHA256(secret, timestamp + "." + rawBody)` over the **exact bytes sent**. The body
is serialised once; those bytes are signed and those bytes go out. Re-serialising after
signing eventually diverges over key order and produces an unreproducible
`INVALID_SIGNATURE`.

```json
{
	"submissionId": "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
	"source": "guest",
	"market": "SK",
	"locale": "sk",
	"customer": { "name": "Jana Nováková", "email": "jana@example.sk" },
	"contract": { "orderNumber": "ORD-1042", "saleorOrderId": null, "saleorCustomerId": null },
	"scope": "selectedItems",
	"items": [
		{ "orderLineId": null, "productName": "Strešný box Thule Motion 3 L", "sku": null, "quantity": 2 }
	],
	"note": null,
	"legalNoticeVersion": "withdrawal-sk-2026-07-30-v0-DRAFT",
	"privacyNoticeVersion": "privacy-sk-2026-07-30-v0-DRAFT"
}
```

Exactly those eleven top-level keys, `name`/`email` inside `customer`, and nothing else.
A body over 64 KiB is refused locally rather than spending a round trip on a guaranteed 413.

### Response

```json
{
  "ok": true,
  "duplicate": false,
  "submission": {
    "id": "018f1000-…",
    "submissionId": "3f2504e0-…",
    "submissionNumber": "ODS-2026-000042",
    "submittedAt": "2026-07-30T09:12:33.123Z",
    "noticeSnapshot": { "schemaVersion": 1, … },
    "emailDelivery": { "customerStatus": "sent", "internalStatus": "sent" }
  }
}
```

`emailDelivery` is read when present and left `null` when absent. Absent means **not
known**, never _failed_ — the create response does not carry it yet, and telling a
customer their confirmation failed when it is merely unreported would be its own small
lie. The three states render three different sentences.

A 200 whose snapshot is missing or malformed is treated as `unavailable`, not success: a
receipt with nothing behind it is worse than an error.

---

## 3. Contract conformance

| Requirement                                           | Status                                        |
| ----------------------------------------------------- | --------------------------------------------- |
| Timestamp in Unix seconds, 10–11 digits               | ✅ measured: every request 10 digits          |
| HMAC over `timestamp + "." + rawBody`                 | ✅ verified against the bytes actually sent   |
| Signed bytes == sent bytes, no second serialisation   | ✅ asserted in test and in the browser run    |
| No `noticeSnapshot` in the request                    | ✅                                            |
| No `customer.phone`                                   | ✅ field removed from the form entirely       |
| Exact top-level key allowlist                         | ✅ asserted key-by-key                        |
| `wholeOrder` → empty `items`                          | ✅                                            |
| `selectedItems` → 1–100 structured items              | ✅ including guest manual rows                |
| `sku` optional, `null` when absent                    | ✅ hand-typed only; account lines send `null` |
| Ownership from the session, never the request         | ✅                                            |
| Snapshot / number / timestamp taken from the response | ✅                                            |
| Error codes mapped, backend message never shown       | ✅                                            |
| Raw collection REST never called                      | ✅                                            |
| No delivery PATCH in the normal path                  | ✅ removed                                    |

### Error codes

`INVALID_TIMESTAMP`, `STALE_TIMESTAMP`, `INVALID_SIGNATURE`, `INVALID_REQUEST`,
`BODY_TOO_LARGE`, `SUBMISSION_ID_CONFLICT`, `FORMS_AUTH_UNAVAILABLE`,
`FORMS_INTERNAL_ERROR` and the rest are recognised and carried in logs; the backend's
message text never reaches the page, because it is written for an operator and could echo
submitted values onto a screen somebody else is looking at.

The customer sees one of three things: _reload and try again_ (`SUBMISSION_ID_CONFLICT` —
a stale tab), _shorten the form_ (`BODY_TOO_LARGE`), or _it was not stored, here are the
other routes_. Classification comes from the body's code rather than the status line:
Payload answers **503** for a missing HMAC secret, which looks transient and is not.
`FORMS_INTERNAL_ERROR` is the genuinely transient one.

---

## 4. Order of operations

```
1. validate                     ← authoritative, server-side
2. persist                      ← the moment the notice is "received"
   Payload then, in the same transaction: snapshot, number, timestamp,
   customer e-mail, internal e-mail, delivery status
3. render the receipt from what came back
```

Failing step 2 shows an honest failure and the alternative routes; nothing is stored and
no e-mail goes out. A confirmation that did not send leaves the withdrawal **received** —
a withdrawal is effective when it is given, not when an SMTP server cooperates — and the
receipt says so without implying the notice failed.

Idempotency is the database's unique index on `submissionId`. A retry returns the original
record with its original timestamp and snapshot, and the receipt says the submission was
already on file. The UI's double-click guard is a courtesy; an in-memory token would not
survive a restart, a second process, or the retry-after-timeout case that matters most.

**The page must not be cached.** Each render mints the `submissionId`; a prerendered page
would hand every visitor the same one and the second submitter would receive the first
person's confirmation as a "duplicate" — their notice never stored, and a receipt that
looks entirely convincing. `export const dynamic` is rejected under `cacheComponents`, so
the opt-out is `connection()`. Verified: three requests, three different ids.

---

## 5. What was proven, and how

367 unit and integration tests, plus a real headless Chrome driving the form against a
**strict** mock of the Payload contract — one that rejects millisecond timestamps, unknown
keys and an empty `items` array, because a permissive mock is precisely how three
contract violations survived a whole branch.

| Case                                           | Result                                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Guest, whole order                             | received, `ODS-2026-000001`                                                                               |
| **Guest, partial via manual rows**             | received; notice reads _„Rozsah odstúpenia: vybrané položky / - Strešný box Thule Motion 3 L — počet: 2"_ |
| Retry with the same `submissionId`             | same number; 4 POSTs → 3 stored records                                                                   |
| Missing name, bad e-mail, missing order number | 3 fields flagged, focus on the first                                                                      |
| Honeypot filled                                | blocked, alternatives offered, nothing stored                                                             |
| Payload 503 `FORMS_AUTH_UNAVAILABLE`           | „neprijali sme" + alternatives                                                                            |
| Payload timeout                                | „neprijali sme" + alternatives                                                                            |
| `customerStatus: sent`                         | „Potvrdenie sme odoslali aj e-mailom…"                                                                    |
| `customerStatus: failed`                       | „Odstúpenie je prijaté a zaevidované. Potvrdenie e-mailom sa nám zatiaľ nepodarilo odoslať…"              |
| delivery unreported                            | „Potvrdenie vám pošleme aj e-mailom…"                                                                     |
| Timestamp on the wire                          | 10 digits on every request                                                                                |
| Signature on every request                     | valid against the exact bytes sent                                                                        |
| Body keys                                      | exactly the allowlist; no Payload `Authorization` header                                                  |
| Secrets in HTML / client JS                    | none of five needles found                                                                                |
| Labels                                         | 6 controls, 0 unlabelled                                                                                  |
| Keyboard                                       | submit reachable and activatable                                                                          |
| 360 / 390 / 412 / 1440                         | no horizontal overflow at any width                                                                       |

One aside worth keeping: a delivery run came back empty because the **rate limiter had
tripped** — twelve submissions from one IP inside fifteen minutes. The limiter working is
good news; the harness not recognising a blocked state was the bug, and a fresh server
made the runs pass.

---

## 6. Still blocked on Payload

1. **The Forms release is not live.** `codex/payload-provider-v2-forms-v1 @ 0badf5c` is a
   release candidate: fresh-DB and upgrade-from-main migrations have not actually run, and
   the DB-gated Forms tests have not executed. This is now the only _technical_ blocker —
   everything else on this list is a decision or a content deliverable.
2. ~~`MAKY_FORMS_HMAC_SECRET` does not exist in either runtime.~~ **Done 2026-07-30.**
   Present on both hosts, 64 characters, and the same value on both — verified by
   comparing SHA-256 prefixes (`53719b235c27`) rather than by moving the secret anywhere
   it could be read. Payload holds it in SSM at
   `/maky/prod/payload/runtime/MAKY_FORMS_HMAC_SECRET`, rendered into `/run/payload/`;
   the storefront holds it in `/opt/storefront/.env` (0600, gitignored). Both clocks are
   NTP-synchronised, which matters because the signature window is ±300 s.

   One operational note: the running `maky-storefront` process started _before_ the
   write, so it does not have the variable yet. Next reads `.env` at process start, so it
   is picked up at the next restart or deploy. Irrelevant while this branch is
   branch-only; it must not be forgotten on the day the form goes live.

3. **Submission numbers.** The contract currently generates `WDR-<full UUID>`. The
   approved format is `ODS-YYYY-NNNNNN`; this branch reads the number as an opaque string
   and does not care which lands, but the customer-facing one should.
4. **Approved legal copy.** `LEGAL_COPY_APPROVED` is `false` and
   `assertLegalCopyApprovedForProduction()` is there for a deploy step to call. Two items
   for the review thread: the statutory model form still asks for a postal address and an
   IBAN that the online function deliberately does not require, and the „30 dní pre
   registrovaných" claim is inherited, not verified.

**Proposed rebase base:** the production tip _after_ the CMS pilot deploy, not `007f75e`.
Rebasing before that would put this branch on a base that is about to move.

---

## 7. Deferred

- Contact form on the same foundation — a separate follow-up, as agreed.
- A PDF model form. The current download is plain text: a PDF needs a dependency, and text
  is the more accessible artefact anyway.
- The signed delivery PATCH remains a supported operational seam on the Payload side; the
  storefront does not call it in the normal V1 path.
- `sku` for account-mode lines — one GraphQL approval away, and approved as `null` for V1.
