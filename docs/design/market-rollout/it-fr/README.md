# IT/FR — what is in this directory

Read `../HANDOFF-20260909-it-fr.md` first: it is the implementation handoff, with the
branch, the gates that ran, and the open items with an owner.

| File                               | For   | What it is                                                                                                                                                                |
| ---------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PREFLIGHT.md`                     | —     | The pre-implementation check done by the PL/HU thread                                                                                                                     |
| `ZADANIE.md`, `PRVY_PROMPT.txt`    | —     | The brief this thread worked from                                                                                                                                         |
| `o-nas.it.md`, `o-nas.fr.md`       | **M** | O nás bodies for the existing CMS. Until a document is published, `/it/o-nas` and `/fr/o-nas` 404 — which is correct, and reported separately from the seven static pages |
| `HANDOFF_RETURNS_V2.md`            | **R** | The package's own Returns V2 notes, unedited                                                                                                                              |
| `email-*.it.txt`, `email-*.fr.txt` | **R** | Customer acknowledgement and internal notification, both languages. `{{…}}` tokens must be preserved verbatim, including every occurrence                                 |

These are editorial source, **not** a Payload import schema and not a wire contract. The
Slovak file names inside the package are not permission to add API fields or enum values.

The four editorial shipping states (`self_shipping`, `quote_requested_only`,
`collection_offered`, `not_specified`) live in the package at
`formulare/pokyny-podla-zvozu.*.json`; mapping them to real stored events is R with K.
