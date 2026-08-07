# Storefront CMS Pages provider contract V2

Tento adresár je verziovaný provider pack pre univerzálne editorial Page bloky,
ktoré má storefront použiť v M.2. Rozširuje úzky pilot
`storefront-cms-o-nas-v1`; nie je kópiou generovaných TypeScript typov ani
všeobecným Payload SDK.

## Identita

- Contract ID: `storefront-cms-pages`
- Contract version: `2`
- Status: `candidate`
- Provider release: `20260718T113448Z-91dc302982a1`
- Provider schema commit: `91dc302982a103e1cfa6b0d456f5293ec905d275`
- Pack capture base: `5c8b1b97f2a90bf879c1d4c7e611aa3aff915529`
- Payload: `3.86.0`
- REST depth: `1`
- Preview: mimo tohto kontraktu

Provider commit označuje commit, ktorý zaviedol aktuálne `Pages`, block,
relationship a `PublicMedia` schémy. Pack capture base je commit, z ktorého boli
schémy pri príprave packu znovu prečítané; medzi nimi nie je schema zmena týchto
polí.

## Podporované Page bloky

| `blockType` | Povinné obsahové polia | Priame vzťahy pri `depth=1` |
| --- | --- | --- |
| `hero` | `heading` | voliteľné `media`, `links[].reference` |
| `richText` | `content` | vzťahy v serializovanom Lexical obsahu |
| `image` | `media` | `media` |
| `gallery` | najmenej dve `items[].media` | každé `items[].media` |
| `cta` | `heading`, najmenej jeden `links[]` | `links[].reference` |
| `faq` | najmenej jedna otázka a `answer` | vzťahy v `answer` |
| `mediaText` | `content`, `media`, `mediaPosition` | `media`, `links[].reference` |

Každý blok má spoločné voliteľné `anchorId`, `markets`, `id` a `blockName`.
Prázdne alebo `null` `markets` znamená všetky trhy; neprázdny zoznam je
allowlist.

## Provenance

Pack bol odvodený priamo z:

- `src/collections/Pages.ts`
- `src/collections/Posts.ts`
- `src/collections/PublicMedia.ts`
- `src/blocks/coreBlocks.ts`
- `src/blocks/blockDefaults.ts`
- `src/fields/link.ts`
- `src/fields/markets.ts`
- `src/lexical/editorialLexical.ts`
- S3 a SEO plugin konfigurácie v `src/payload.config.ts`

`src/payload-types.ts` bol použitý iba ako krížová kontrola vygenerovanej
schémy. Storefront ho nesmie importovať ani kopírovať ako runtime kontrakt.

Všetky V2 fixtures sú syntetické a sanitizované. Používajú deterministické
fixture ID, neobsahujú produkčné osobné údaje ani secrets a zachovávajú wire
shape Payload REST odpovede. Media vzťahy sú populované ako objekty s verejnými
`https://cms-media.maky.store/...` CDN URL; nie sú nahradené samotnými ID.

## Súbory

- `manifest.json` — machine-readable identita, scenáre a SHA-256 fixtures.
- `page-rest-contract.md` — presný list request, response a výsledková semantika.
- `depth-and-relationships.md` — čo `depth=1` populoval a kde je potrebný vyšší
  per-field depth.
- `lexical-richtext-contract.md` — explicitný allowlist nodes, formátov a link
  protokolov pre fail-closed validáciu.
- `unsupported-content-policy.md` — fail-closed pravidlá pre bloky a Lexical.
- `fixtures/rest/` — sanitizované collection-list response fixtures.

## Rozsah

Pack pokrýva sedem core editorial blokov, market filtering, Page/Post/custom
linky, null/missing relationships, verejné media objekty a fail-closed
negatívne scenáre. Commerce bloky, preview/drafts, redirects, Posts listing,
Brands, globals, Saleor dáta a revalidation wire protokol nie sú súčasťou V2.

Bežná textová alebo media zmena nemení contract version. Novú verziu vyžaduje
najmä nový podporovaný `blockType`, povinný Lexical node, zmena field/relationship
shape, auth alebo market/depth semantiky.
