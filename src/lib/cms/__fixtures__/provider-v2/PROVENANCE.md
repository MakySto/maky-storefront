# Provider contract pack — `storefront-cms-pages` v2

Vendored copy of the CMS provider's V2 contract pack, the one M.2 is built against. Every
file beside this one is **authored by `MakySto/maky-cms` and copied in verbatim**. This
file is the only storefront-authored thing in the directory.

|                               |                                                                    |
| ----------------------------- | ------------------------------------------------------------------ |
| provider repository           | `MakySto/maky-cms`                                                 |
| vendored from                 | `main` @ `ddccac744bc1720bd9cdf67585aa99350cd4940e`                |
| provider branch of record     | `codex/storefront-cms-pages-v2` @ `b20422f2`                       |
| contract                      | `storefront-cms-pages`, version `2`                                |
| manifest status               | `candidate`                                                        |
| manifest SHA-256              | `c8449df0231dfaeaf47eaab3c3426c09bdc5b34b55d27c96d31fade402558009` |
| Payload version               | `3.86.0`                                                           |
| provider release              | `20260718T113448Z-91dc302982a1`                                    |
| pack capture base             | `5c8b1b97f2a90bf879c1d4c7e611aa3aff915529`                         |
| `depth` / locale / market     | `1` / `sk` / `SK`                                                  |
| supported blocks              | hero, richText, image, gallery, cta, faq, mediaText                |
| fixtures                      | 14, all digests verified on vendoring                              |
| vendored on                   | 2026-07-30                                                         |

Vendored from `main` rather than from the feature branch on purpose. The provider-only
PR merged first precisely so the provenance here names a commit that will not move.

## What is different from the v1 pack next door

The v1 pack is still in use — `provider-conformance.test.ts` runs against it and
`/sk/o-nas` is served through the code it validates. v2 does not replace it; it extends
the contract to seven block types and **tightens the Lexical rules**. Three of those
tightenings contradict what v1 does today, and each is a deliberate correction rather than
a drift:

- **`horizontalrule` is no longer supported.** v1 treats a bare marker node as inert and
  lets it through. v2 lists `horizontalrule` explicitly among the node types that are out
  of scope.
- **An unknown node may no longer be assumed inert.** v1's `isContentBearing` decides a
  node is safe to skip when it carries no text, children, `fields` or relationship. v2
  says the opposite in `unsupported-content-policy.md`: *"Neznámy node sa nesmie
  automaticky považovať za inertný len preto, že nemá známe textové pole."*
- **An unknown `text.format` bit is a contract violation.** v1 ignores unknown bits so a
  future editor feature cannot blank out a paragraph. v2 requires the candidate to be
  rejected.

Checked before adopting any of it: the live `o-nas` document uses only `root`, `paragraph`
and `text`, with `format` bit `0` throughout. Every tightening above is therefore
inert for the page that is serving right now, and the only v1 fixture carrying a node v2
forbids is `unsupported-node.synthetic.json`, whose whole purpose is to be rejected.

`source` in the manifest is `sanitized-synthetic-from-provider-schema` — these fixtures are
generated from the Payload schema, not captured from live content. They are authoritative
about SHAPE. They are not evidence about what any real document contains.

## Integrity

`manifest.json` records a SHA-256 for each of the fourteen fixtures;
`provider-v2-conformance.test.ts` recomputes them on every run, plus the digest of the
manifest itself. Do not edit a file here — to take a newer pack, replace the files
wholesale and update the table above. `.prettierignore` carries this directory because the
digests are byte-based and the pre-commit formatter rewrites staged JSON.
