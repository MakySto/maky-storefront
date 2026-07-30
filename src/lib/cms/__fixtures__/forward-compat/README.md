# Forward-compatibility fixtures — storefront-authored

These fixtures are **authored here**, unlike the ones under `provider-v1/`, which are
vendored verbatim from `MakySto/maky-cms` and checksummed against `manifest.json`.

The distinction matters and is the reason for a separate directory. `PROVENANCE.md` in
the vendored pack says "do not edit a fixture", and its integrity test recomputes a
SHA-256 for every file the manifest lists. A storefront-authored file dropped in beside
them would pass that test in silence — the manifest simply would not mention it — while
quietly making the pack a mixture of what the CMS sends and what the storefront guesses.
That is exactly the confusion the vendoring exists to prevent.

A fixture here answers a different question. Not "what does the CMS send today", which is
the vendored pack's job, but **"what happens when the CMS sends something additive that it
does not send yet"**. It is a prediction, and it is labelled as one.

## `page-o-nas.sk.published.legal-metadata.json`

The real production `/api/pages` response for `o-nas`, plus the optional group the Payload
Forms migration adds to every Page document:

```json
"legalMetadata": { "documentType": "editorial", "legalVersion": null, "effectiveFrom": null }
```

Derived from `provider-v1/fixtures/rest/page-o-nas.sk.published.depth-1.json`. The
derivation is not a claim in this file — it is enforced. `legal-metadata-compat.test.ts`
deletes `docs[0].legalMetadata` from this fixture and asserts the remainder is deep-equal
to the vendored response, so this file cannot drift away from real production bytes
without a test failing. Everything the gate proves therefore rests on the genuine
production document, not on a hand-written approximation of one.

Formatting is Prettier's, deliberately: the derivation check is structural, not
byte-based, so the pre-commit formatter has nothing to break here. The vendored pack needs
its `.prettierignore` entry because its checksums are byte-based; this file does not.

One thing to be precise about, because the base fixture's own test calls it "the real
production response": it is a **provider-side recording**, and it is not the same content
as the live `o-nas` document. Commit `1e62961` checked the live document and found five
paragraphs, one of them a company block containing an `info@maky.store` autolink; this
fixture has four paragraphs, no company block and no autolink node at all. Both may be
honest records of different moments. Nothing in this gate depends on which is current —
every assertion here renders from the frozen fixture, so an edit in Payload cannot move
them — but a reader should not take the base file as a snapshot of what `/sk/o-nas` serves
today.

The `legalMetadata` group is inert for the pilot. `/sk/o-nas` is editorial content and the
storefront renders `richText` blocks only; nothing reads the group, and the gate's job is
to prove it stays that way — while the fail-closed rules on unsupported block types and
content-bearing Lexical nodes keep working unchanged.
