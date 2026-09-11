# Payload Forms contract pack — `forms-backend-v1`

Vendored copy of the Payload repository's machine-readable Forms contract. Every file
beside this one is **authored by `MakySto/maky-cms` and copied in verbatim**. This file is
the only storefront-authored thing in the directory.

|                               |                                                                    |
| ----------------------------- | ------------------------------------------------------------------ |
| provider repository           | `MakySto/maky-cms`                                                 |
| provider branch               | `codex/contact-provider-delivery`                                  |
| provider commit               | `f2b8163ce9aa148007f1e1026e0858eadc4db370`                         |
| contract                      | `forms-backend-v1`                                                 |
| contract revision             | `1.3.0`                                                            |
| manifest status               | `candidate`                                                        |
| manifest SHA-256              | `26bec26b7fb493af1d11da68a983fff9c1abccbfaf3ce73fdc56ba35c879cd93` |
| Payload version               | `3.86.0`                                                           |
| migration (not yet applied)   | `20260730_111111_forms_backend_v1`                                 |
| artifacts                     | 38, all digests verified on vendoring                              |
| vendored on                   | 2026-09-11 (re-vendored at revision 1.3.0)                         |

Source in the provider repository:

```
/opt/payload/workspace/maky-cms/docs/contracts/forms-backend-v1/
```

## Why this exists

The storefront and Payload previously each held their own idea of the wire contract, and
both test suites were green while every real request would have failed — a millisecond
timestamp where seconds were required, a `noticeSnapshot` the endpoint rejects, a
`customer.phone` it did not accept. None of that was visible to a mock written from the
same assumptions as the client.

So the contract is no longer restated here. It is **copied**, and the storefront's mock
validates against the copy. `manifest.json` names the canonical scenarios and records a
SHA-256 for every file in this directory; `contract-conformance.test.ts` recomputes all of
them, plus the digest of the manifest itself, on every run. A vendored file edited to make
a test pass fails the run.

## What is vendored, and one deliberate difference from the CMS pack

Everything the manifest lists, **including `README.md`**. The CMS provider pack next door
deliberately leaves the provider's prose behind, on the grounds that a copy goes stale
silently. That argument does not apply here: this manifest carries a digest for its README
too, so a provider-side edit makes the storefront's copy fail loudly on the next test run
rather than drift. Checksummed prose cannot go stale in silence, and vendoring it means
the manifest is verifiable in full instead of nineteen-twentieths of it.

Payload's generated types are **not** vendored. `withdrawal.schema.json` is the wire
contract; the generated types describe the CMS's own storage model.

## Reading the schema correctly

`withdrawal.schema.json` is not a plain JSON Schema. Its `x-normalization`,
`x-normalizedMaxLength` and `x-normalizedLengthUnit` keywords are declared **normative**
and run *after* an ECMAScript `trim()`. The schema says so itself: a validator that ignores
them "provides only a structural precheck". Two consequences that have teeth:

- `customer.phone` is bounded at **32 Unicode code points of the trimmed value**, not 32
  UTF-16 code units. `"…".length` is the wrong measurement for anything astral.
- A value that is blank after trimming normalizes to `null` rather than failing.

`additionalProperties: false` applies at every level, including inside `customer`,
`contract` and each `items[]` entry. One extra key is a 400, not a tolerated addition.

## Updating

Do not edit a file here. To take a newer contract: replace the files wholesale from the
provider commit, update the table above, and let the conformance test confirm the new
manifest. `.prettierignore` carries this directory because the digests are byte-based and
the pre-commit formatter rewrites staged JSON.
