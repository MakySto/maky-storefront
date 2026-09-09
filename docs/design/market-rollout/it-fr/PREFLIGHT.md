# IT/FR — preflight, hotový pred otvorením vlákna

**Toto vlákno IT/FR neimplementovalo.** Overilo balík, spustilo jeho validátor a zapísalo,
čo bude nové vlákno potrebovať a čo mu z PL/HU strany už je pripravené. Kód pre `it`
ani `fr` sa nedotýka; `LEGAL_LOCALES` má naďalej šesť jazykov.

## 1. Balík — overený, nie predpokladaný

| Položka         | Hodnota                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| Cesta           | `/home/ubuntu/maky-podklady/MAKY_STORE_IT_FR_preklad_a_implementacia_2026-09-09.zip` |
| SHA256          | `0d22eae28112f03a496b750039a53f23a6682fbb7d8f1f6f3c9d662588e4a581`                   |
| Integrita ZIP-u | OK (`zipfile.testzip()`)                                                             |
| Položiek        | 85                                                                                   |
| Rozbalené v     | `/home/ubuntu/maky-podklady/2026-09-09/rozbalene-it-fr/`                             |

Rozbalené bezpečne do **nového** priečinka: pred zápisom sa overilo, že žiadny člen
neukazuje mimo cieľa (path traversal, absolútne cesty). Pôvodný ZIP ani manifest sa
nemenili.

**Offline validátor** (`scripts/validate_bundle.py`, spustený z koreňa balíka):

```
{"mainPages": 16, "modelForms": 2, "emailTemplates": 4, "shippingVariants": 8,
 "passed": 328, "failed": 0, "warnings": 0}
```

**Manifest** (`--verify-manifest`): `{"manifestFiles": 84, "passed": true, "failures": []}`

Validátor sám hovorí, čo je jeho rozsah: _„Offline editorial bundle only; not
Next.js/backend/legal certification."_ Nie je to dôkaz o implementácii.

## 2. Balík je úplný — na rozdiel od PL/HU

Toto je hlavný praktický rozdiel a treba ho povedať nahlas, aby nové vlákno nezopakovalo
naše kolo opráv. Obsahuje **všetko, čo PL/HU chýbalo**:

| Skupina                          | IT/FR                | PL/HU na tomto stroji |
| -------------------------------- | -------------------- | --------------------- |
| `data/pages.*.json`              | ✅ obe               | ❌ ani jedno          |
| `data/ui.*.json`                 | ✅ obe               | iba `pl-PL`           |
| `data/component-copy.*.json`     | ✅ obe               | iba `pl-PL`           |
| `formulare/vzor-odstupenia.*`    | ✅ TXT + HTML, obe   | ❌ žiadne             |
| `formulare/pokyny-podla-zvozu.*` | ✅ obe (8 variantov) | ❌ žiadne             |
| e-maily                          | ✅ 4 šablóny         | iba `pl-PL` (2)       |
| `interne/O_NAS_PRE_CMS.*`        | ✅ obe               | odvodené z agregátov  |

Preto sa v IT/FR **nemá nič skladať zo slovenčiny**. Ak niečo chýba, je to chyba, nie
zadanie.

## 3. Čo je už hotové na našej strane

**`legalRoute` má voliteľné `heading`** — commit `12e30e3` na
`claude/maky-store-pl-hu-impl-8dd394`. IT/FR handoff § 3 hovorí: _„Ak už M zmenu urobil,
používaj ju."_ Je urobená:

- `LegalCopy.heading?: string`, `<h1>` je `heading ?? title`, `<title>` ostáva `title`
- rovnaké pravidlo v samostatnej routе odstúpenia (jej `META` je anotovaná, nie `as const`)
- suffix `| MAKY.STORE` pridáva `formatPageTitle`, takže do `title` sa odovzdáva **bez** neho
- sk/cs/de/at/pl/hu sa nehýbu — test to drží, a proti buildu zo `9fee37a` je to overené
  DOM-porovnaním (32/32 zhodných vrátane `<title>`)

`pages.it-IT.json` a `pages.fr-FR.json` nesú `h1` aj `metaTitle` oddelene, takže sa dajú
namapovať priamo.

## 4. ⚠️ `it` je dnes negatívna fixtúra — presuň ju, nezmaž

Keď pribudla poľština, rolu „trh bez schváleného textu“ po `pl` prevzalo **`it`**.
Je v štyroch testoch:

| Súbor                               | Kde                                       |
| ----------------------------------- | ----------------------------------------- |
| `src/lib/route-policy.test.ts`      | `NO_COPY = ["it", "fr", "us"]`            |
| `src/proxy.test.ts`                 | zoznam trhov + `/it/kontakt` noindex test |
| `src/proxy.gate.test.ts`            | `/it/kontakt` — policy odpovie pred gate  |
| `src/lib/legal/legal-route.test.ts` | `legalLocaleFor("it-eur")` je `null`      |

Postupnosť je zapísaná v komentároch: `de` → `pl` → `it`. **Pri pridaní taliančiny musí
prejsť na ďalší skutočne nepokrytý trh** (`es`, `ro`, `us`, `ca`) — zmazanie assertion
nechá štyri zelené testy nekontrolovať nič. `fr` v `NO_COPY` padne tiež, tak isto ho
presuň, nie odstráň.

## 5. Základ vetvy — nie je to automaticky náš HEAD

Náš HEAD `c72e720` (nad `9fee37a`) je **referenčný, nie predpísaný základ**. IT/FR si
musí zistiť aktuálny integračný základ od M cez `git ls-remote` a najnovší M handoff.
Ak integrácia ešte nie je pripravená, IT/FR pokračuje samostatnými obsahovými modulmi —
**nie deštruktívnym resetom** a bez opätovného pripájania starých SK/CS/garážových SHA.

Naša oprava PL/HU IT/FR nijako neblokuje: dotýka sa `copy-pl/hu.ts`, dvoch PL/HU tiel
a zdieľanej továrne, kde je zmena aditívna a výstupne neutrálna.

## 6. Čo si z IT/FR balíka prečítať ako prvé

`HANDOFF_PRE_CLAUDE_CODE_IT_FR.md`, `README_PRE_CLAUDE_CODE.md`, potom
`interne/PRAVNE_ROZDIELY_A_ZDROJE.md`, `interne/HANDOFF_RETURNS_V2.md`,
`interne/OTVORENE_POLOZKY_M_R_K.md`, `interne/QA_A_AKCEPTACIA.md`.
`NAHLAD_IT_FR.html` je lokálny náhľad s prepínačom jazyka.

Právne body, ktoré balík výslovne označuje za **neuzavreté** (nie za certifikované):

- **FR — garančný box.** Formálna zhoda s `D211-2 / Annexe A` je integračná položka.
  `PROVENANCE` aj handoff to hovoria priamo; redakčná verzia nie je dôkaz zhody.
- **FR — ADR.** Skutočne príslušná mimosúdna cesta vrátane povinných kontaktných údajov.
  **Nevymýšľaj členstvo MAKY vo francúzskej mediácii.**
- **FR terminológia.** Nezamieňaj `rétractation` / `résolution` / `résiliation`.
  Francúzsky 30-dňový limit nápravy neprepisuj slovenskou výnimkou.
- **IT/FR online odstúpenie** má miestne pravidlá použiteľné od júna 2026. Preview stav
  nie je právna náhrada funkcie — rovnako ako pri HU.

## 7. Čo IT/FR zdedí z našich zistení

- Negatívny dôkaz sa robí cez **submit-capability**, nie počtom `<form>`: na stránke sú
  dva vyhľadávacie formuláre v hlavičke a pätičke aj bez akéhokoľvek odstúpenia.
  Pri `WITHDRAWAL_BACKEND_LIVE=true` dostane `sk` tretí `<form>` a jeden submit; ostatné
  trhy zostanú na dvoch a nule.
- **Zapnutie prepínača si vyžiada rebuild.** Telo routy flag poslúchne (`connection()`),
  metadáta sa pod `cacheComponents` zapiekli pri builde.
- `next start -H 127.0.0.1` vyrobí redirect loop; bez `-H` funguje.
- `npx next start` nechá po zabití rodiča bežať vnuka `next-server` — PID ber z `ss -ltnp`.
- `<html lang>` je natvrdo `sk` pre všetky trhy (`src/app/layout.tsx:22`, koreňový layout).
  Predexistujúce, opravuje **M**, a rieši sa to v skutočnom koreňovom layoute —
  **nie vnoreným `<html>`** v jazykovom tele.
