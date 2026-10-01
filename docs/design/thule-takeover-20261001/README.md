# THULE-C1 — prevzatie datasetu `.2` a príprava otvorenia ponuky · podklady

Hlavný dokument: [`../HANDOFF-20261001-M-thule-takeover-and-opening.md`](../HANDOFF-20261001-M-thule-takeover-and-opening.md).

| súbor                       | čo je                                                                                                                                                                                                                                     | pre koho                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `block1-cases.json`         | zákaznícky test skutočného bloku 1 (pk 71720–72042): 12 prípadov „sada sa musí ukázať" a 21 negatívnych (rok mimo okna / iná strecha / bez strechy), s cenou CFM, slugom a výberom auta; plus 11 pilotov a vzorka 60 sád z ďalších blokov | M, CFM — vstup `scripts/checks/thule-early-test.mjs` |
| `pilot-cases.json`          | ten istý formát na 10 už verejných pilotoch — jediné skutočné dáta, na ktorých sa dá vyskúšať polovica „po aktivácii"                                                                                                                     | M                                                    |
| `intro-conflicts-sk.csv`    | 56 slovenských stránok generácií, ktorých úvod tvrdí „všetky zostavy sú pre strechu X" a ktoré po prepnutí dostanú aj inú strechu: adresa, id vozidla, počet sád a strechy pred/po, veta                                                  | **CFM — potvrdiť a opraviť obsah**                   |
| `generation-duplicates.csv` | 48 dvojíc generácií toho istého modelu s rovnakými alebo vnorenými rokmi výroby (id, roky, `urlPath`, počet sád; posledný stĺpec: nové v `.2`)                                                                                            | **CFM — duplicity v dátach**                         |
| `measurements.json`         | všetky namerané čísla: fázy načítania, obnova pod záťažou, starý provider verzus R1, sitemapa, studený štart                                                                                                                              | M                                                    |

Cookie garáže (podpísané tajomstvom) sa do repozitára **nedávajú**; robí ich `src/lib/fitment/thule-cases.check.test.ts` z tajomstva v prostredí.

## Opakovanie

```bash
# 1. všetko v jednom: hash, validácia, fázy, resolver
M_PERF_DATASET=<dataset .2> M_PERF_OUT=perf.json npx vitest run src/lib/fitment/dataset-perf.check.test.ts
# 2. čo sa mení oproti nasadenému datasetu (uložené výbery, selektor, Thule matica)
M_DELTA_OLD=<fd3507de>.json M_DELTA_NEW=<dataset .2> M_DELTA_OUT=delta.json npx vitest run src/lib/fitment/dataset-delta.check.test.ts
# 3. strom stránok, dlaždice, sitemapa, úvody
M_TREE_SNAPSHOT=/opt/storefront-artifacts/maky_catalog_content_1.0.0-sk-20260915.2.json M_TREE_OLD=<fd3507de>.json M_TREE_NEW=<dataset .2> M_TREE_OUT=tree.json \
  npx vitest run src/lib/catalog-content/new-dataset.check.test.ts
# 4. 28 prípadov CFM (a cookies, ak je v prostredí MAKY_GARAGE_COOKIE_SECRET)
M_CASES=M_TEST_CASES.json M_CASES_DATASET=<dataset .2> M_CASES_OUT=cases.json npx vitest run src/lib/fitment/thule-cases.check.test.ts
# 5. zákaznícky test po bloku (len čítanie)
node scripts/checks/thule-early-test.mjs --base https://maky.store --cases block1-cases.json --cookies cases.json --phase pre|post
# 6. súbor, ktorý CFM dnes servíruje, je ten, ktorý sme prijali
pnpm check:fitment
```
