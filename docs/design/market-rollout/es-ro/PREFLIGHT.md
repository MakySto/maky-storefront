# ES/RO — preflight, written after the package arrived

`ZADANIE.md` said this file would be written by the thread that actually receives the
bundle, not guessed in advance. This is that file. It records what arrived, what was
verified, and the two facts that changed how the implementation was written.

## The bundle

|                    |                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| File               | `/home/ubuntu/maky-podklady/MAKY_STORE_ES_RO_preklad_a_implementacia_2026-09-09.zip`               |
| SHA-256            | `26a8e0858fe2ed75e8f379112a8564f2bdb1027c1b867a7b99878fdf58dd3690`                                 |
| Entries            | 87 — one top-level directory, no absolute paths, no `..`, no symlinks                              |
| Manifest           | 86 files listed, **86/86 SHA-256 verified independently**; the 87th file is `manifest.json` itself |
| Supplied validator | `scripts/validate_bundle.py` → **543 passed, 0 failed, 0 warnings**                                |

The manifest was re-verified with an independent script rather than trusting the
validator's own report, and the archive was inspected for traversal and symlinks before
extraction, not after.

## Two things that changed the implementation

**1. The recipients table has two columns in these languages, not three.**
`data/pages.{es-ES,ro-RO}.json` deliver a systems/purposes table with no legal-basis
column, and the surrounding prose says why — the table names systems and purposes, not a
legal entity and a basis per row. `RecipientsTable` was therefore extended to emit the
basis cell only for the seven languages whose copy has one. Filling a third column with
invented Spanish or Romanian legal basis text was the alternative, and it would have been
unreviewed legal writing.

**2. Spain and Romania are NOT in the same position on the online withdrawal function.**
This was the open question `ZADANIE.md` flagged, and the package answers it — asymmetrically.

- **Romania: duty established and in force.** `interne/PRAVNE_ROZDIELY_A_ZDROJE.md` cites
  OUG 18/2026 art. II inserting art. 11^1 into OUG 34/2014, art. IV setting **19 June 2026**
  — the same date as Italy and France.
- **Spain: NOT established.** What the package verified is Directive (EU) 2023/2673
  (art. 1(3) inserting art. 11bis, applicable 19 June 2026) **as published in the BOE** —
  the EU text appearing in a Spanish official journal, which is not a Spanish transposing
  instrument. The package labels this row `EU-directive-not-national-transposition` and
  says so in prose: _"nebola spoľahlivo doložená konkrétna španielska transpozičná norma…
  Je to hranica overenia, nie záver, že v ES stačí navždy e-mail."_

So Spain is an **open item for M**, and it points in neither direction. It is not a finding
that Spain has the duty, and it is not a finding that e-mail suffices there indefinitely.
`copy-es.ts` carries this in its own doc comment so the next reader cannot resolve it by
analogy to Italy.

## Verified in the delivered files

- **Romanian diacritics: clean.** All 17 Romanian files contain zero cedilla `ş`/`ţ`
  (U+015F/U+0163); only comma-below `ș`/`ț` (U+0219/U+021B). The standard set by the
  existing `ro-RO.json` is held, and `copy-es-ro.test.ts` now guards it in code.
- **`metaTitle` carries ` | MAKY.STORE`** in all 16 delivered page records, as warned —
  stripped before `formatPageTitle`.
- **Currency is per market in the delivered copy**: Spanish says `euros (EUR)`, Romanian
  says `lei românești (RON)`. Neither mentions the other's currency.
- **The cookie button is a marker**, `data-maky-component="privacy-settings"`, exactly as
  the handoff warned. Replaced with the real `PrivacySettingsLink`.

## Deliberately not in this branch

`interne/PRAVNE_ROZDIELY_A_ZDROJE.md` notes that the Romanian consolidation also carries
provisions effective **27 September 2026** (green transition, harmonised guarantee
information). Those were future at the package date, they are a joint M/K item for a
release after that date, and the package does not claim the checkout already implements
such a mechanism. Nothing here does either.
