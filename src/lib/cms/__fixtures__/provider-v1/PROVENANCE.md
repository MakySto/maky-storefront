# Provider contract pack — `storefront-cms-o-nas-v1`

Vendored copy of the CMS provider's contract fixtures. These files are **not authored
here**. They are produced by the Payload repository and copied in verbatim so the
storefront's tests can run without a network call and without a checkout of the other
repository.

|                               |                                            |
| ----------------------------- | ------------------------------------------ |
| provider repository           | `MakySto/maky-cms`                         |
| provider branch               | `codex/storefront-cms-contract-v1`         |
| provider commit               | `704381d`                                  |
| contract                      | `storefront-cms-o-nas-v1`                  |
| contract version              | `1`                                        |
| manifest status               | `candidate`                                |
| Payload version               | `3.86.0`                                   |
| provider release              | `20260718T113448Z-91dc302982a1`            |
| schema commit                 | `91dc302982a103e1cfa6b0d456f5293ec905d275` |
| `depth`                       | `1`                                        |
| locale / market               | `sk` / `SK`                                |
| vendored on                   | 2026-07-30                                 |
| vendored at storefront commit | `fb4b604`                                  |

Source of the pack in the provider repository:

```
/opt/payload/workspace/maky-cms/docs/contracts/storefront-cms-o-nas-v1/
```

The three contract documents (`page-rest-contract.md`, `lexical-richtext-contract.md`,
`revalidation-contract.md`) and the pack `README.md` are deliberately **not** vendored —
prose goes stale in a copy, and the provider repository stays its owner. Only the machine
-readable parts live here: `manifest.json` plus the thirteen fixtures it checksums.

Payload's generated `payload-types.ts` is **not** vendored either. It describes the CMS's
own schema — all fourteen block types and a `type: any` Lexical tree — rather than the
seven-field subset this pilot actually reads, so it would type-check against anything.
`src/lib/cms/page-schema.ts` is the storefront's contract and is deliberately narrower.

## Integrity

`provider-conformance.test.ts` recomputes the SHA-256 of every file listed in
`manifest.json` and compares it against the recorded digest. The transfer from the
provider VPS was already verified by checksum; this test protects against a **later**
edit of a vendored copy — the failure mode where someone "fixes" a fixture to make a
test pass and the storefront quietly stops testing what the CMS actually sends.

Do not edit a fixture. To take a newer pack: replace the files wholesale, update the
table above, and let the checksum test confirm the new manifest.

## One known divergence from the provider prose

`fixtures/lexical/unsupported-node.synthetic.json` carries the sentence

> „Tento node sa vo V1 preskočí a zaloguje."

That describes the behaviour the storefront had at `fb4b604` and no longer has. An
unknown Lexical node that **carries text** now invalidates the whole CMS candidate and
the route renders its bootstrap fallback, because a published paragraph that silently
disappears is worse than a page that visibly reverts. The fixture is kept byte-identical
(it is the contract), but `lexical-richtext-contract.md` on the provider side needs the
matching correction. Tracked in the pilot handoff document, owned by the CMS repository.
