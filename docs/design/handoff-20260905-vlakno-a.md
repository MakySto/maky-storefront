# Vlákno A — výsledok behu 2026-09-05

Vetva `claude/sf-a-catalog-l10n-seo`, štart z Legal `a4d78cb`, S1 `6da300a` zmergované.
**Branch-only. Nič sa nenasadzovalo, produkcia je nedotknutá** (`maky.store/sk` = 200,
`/opt/storefront` HEAD `e353c70`, artefakt stále `bdcc925` / `iyLXwmjRqPX0jdVSumaqz`).

---

## 1. Čo je hotové

Desať commitov, každý samostatne odovzdateľný, v poradí z `handoff-20260904-vlakno-a.md` §A3.

| #   | commit                                                                   | čo rieši    |
| --- | ------------------------------------------------------------------------ | ----------- |
| 1   | `fix(catalog): the release base 404s every product and category`         | **A0 / P0** |
| 2   | `fix(plp): backwards pagination has been dropping the product grid`      | A2.3        |
| 3   | `merge: bring in S1`                                                     | krok 3      |
| 4   | `fix(plp): an empty listing stops blaming filters nobody applied`        | A2.14       |
| 5   | `fix(seo): cart, account and orders were indexable`                      | A2.6        |
| 6   | `fix(plp): the listings claimed the shop has twelve products`            | **nové**    |
| 7   | `feat(pdp): fetch Saleor's media id`                                     | A2.5        |
| 8   | `fix(seo): the sitemap's category walk could truncate without saying so` | A2.10       |
| 9   | `fix(search,seo): Previous returned the wrong products…`                 | **nové**    |
| 10  | `fix(plp): a category filter could silently stop filtering`              | A2.9        |

### Validácia

`tsc --noEmit` 0 · `lint` 0 errors (6 pre-existing warnings) · **1064 testov / 68 súborov**
zelených · `i18n:check` OK (12 locales) · `next build` **prešiel** v izolovanom worktree
(§13.7), nikdy v `/opt/storefront`.

### Akceptácia proti reálne zbuildenej aplikácii (`next start -p 3999`)

Nie len proti GraphQL vrstve — proti zbehnutej appke:

```
/sk/<produkt>                 200, <h1>Strešný box Thule Motion 3 - XXL - Titan Glossy</h1>, 40 obrázkov
/sk/categories/stresne-boxy   200, 17 produktov, „101 produktov"      (bolo „12 produktov")
  …&direction=prev            16 produktov, 1 $RX                     (na PROD: 0 produktov, 2 $RX)
/sk/categories/stresne-nosice „Zatiaľ tu nie sú žiadne produkty."     (bolo „…nezodpovedajú filtrom" + tlačidlo)
/sk/products                  <title>Všetky produkty | MAKY.STORE</title> + canonical   (bolo <title>Products</title>)
/sk/cart /sk/account /sk/orders   noindex, follow                     (bolo index, follow)
/sitemap.xml                  444 URL, /sk/poradna prítomné           (bolo 443, poradňa chýbala)
```

---

## 2. Opravy podkladov — čo v handoffoch NESEDÍ

Toto je najdôležitejšia časť pre ďalšie vlákna. Overené priamo, nie prevzaté.

### 2.1 A0 platí, ale rozsah bol podcenený

`slugLanguageCode` naozaj nerobí fallback — potvrdené nezávisle, aj na treťom resolveri
(`page`), takže je to generická sémantika Saleoru, nie zvláštnosť produktu. Ale:

- **Nie 2 routy, ale 6 call sites v 5 súboroch.** Handoff menuje PDP + kategóriu.
  Chýbala **homepage** (`(main)/page.tsx`), ktorá si `slugLang` **hardcoduje na `Sk`**,
  takže padá rovnako vo všetkých 12 trhoch — a padá **ticho**, bez 404 a bez chyby.
- **Kolekcie sú latentné, nie live.** V Saleore je **0 kolekcií vo všetkých kanáloch**,
  takže `/collections/[slug]` sa dnes nesprávala inak pred opravou ani po nej. Kanárik
  na kolekcii nedokáže nič. Živá obeť bola homepage.
- **Oprava NEPATRÍ do `route-existence.ts`.** Handoff A0 hovorí „rozšír
  `resolveVerdict()` na r. 217-231". Gate je jediná komponenta, ktorá to už robí správne
  — pýta sa base slugom. Oprava patrí do resolverov stránok.
- `slugLanguageCode: null` je **ekvivalentné vynechaniu argumentu** (overené). Preto
  stačí jeden dokument s nullable premennou; žiadna paralelná query cesta.

### 2.2 „Google dostane celý slovenský katalóg pod /de" — NEPLATÍ

Produktová query je **channel-scoped**, a `de-eur`, `cz-czk`, `pl-pln` majú **0 produktov**.
Povýšenie druhého trhu cez `MAKY_LIVE_MARKETS` dnes pridá **2 URL** (homepage + /products),
nie 9192. Base-slug problém je reálny, ale detonuje až keď ten trh dostane zásoby — a vtedy
bude potrebovať preložené slugy, ktoré tiež neexistujú. Zámerne som nestaval špekulatívnu
mašinériu proti katalógu, ktorý tam nie je.

### 2.3 A2.5 — obe tvrdenia o ALT sú nesprávne

- **„localizedMedia zahadzuje ALT, a deje sa to aj na `sk`" — NIE.** `localizedMedia` sedí
  **za** `isSourceLocale` early returnom (`exact-locale.ts:123`), takže na `sk` nebeží nikdy.
  Na cudzom locale je zahadzovanie **správne** — ten ALT je slovenský a nepretekať zdrojovú
  kópiu na preloženú routu je celý zmysel toho modulu. (Navyše dnes nebeží pre nikoho:
  bez prekladu je produkt zahodený skôr.)
- **„limit 5/6 obrázkov" — neexistuje**, potvrdené. Živá PDP renderuje 40 obrázkov.
- Skutočná medzera bola `id` — doplnené. Ale aj tu presnejšie: Saleorove media URL je
  `/thumbnail/<base64 media id>/<size>/`, takže URL **nesie** identitu; nestabilná bola
  až dvojica `url + index`. Súbor je `ui/image-carousel.tsx`, nie `pdp/image-carousel.tsx`,
  a **tretie kľúčovacie miesto** je `ui/image-lightbox.tsx`.

### 2.4 Ostatné presnosti

- `getPaginatedListVariables` je v **`src/lib/utils.ts:56-67`**, nie
  `src/ui/components/plp/utils.ts`.
- `exact-locale.ts` je **`src/lib/saleor/exact-locale.ts`**.
- Prázdny stav renderuje **`categories/[slug]/client.tsx:68-80`**, nie `page.tsx:93-101`
  (to je metadata vetva).
- Z piatich `Disallow` v `robots.ts` sú mŕtve **tri**, nie všetky: `/checkout` a `/api/`
  sú root-level a **fungujú**.
- 7042a40, nie `7fba44c`, nesie vzor pre channel-guarded metadata
  (`odstupenie-od-zmluvy/page.tsx:44-59`).
- Prázdnych kategórií je **11 z 30** (komentáre hovorili 12).

---

## 3. Čo som našiel navyše — živé, na `sk`

Žiadne z tohto nie je v podkladoch.

1. **Listingy tvrdili, že obchod má 12 produktov.** `/sk/categories/stresne-boxy` hlásilo
   „12 produktov" (má 101), `/sk/products` „12 produktov" (obchod má 414). `FilterBar`
   dostával veľkosť stránky a renderoval ju cez `plp.productCount`. Podhodnotenie
   katalógu 34× v jedinom živom trhu. **Opravené (#6).**
2. **`/sk/search` „Predchádzajúce" vracalo NESPRÁVNE produkty.** `<Pagination>` posiela
   `direction=prev`, search poznal len `"backward"` → spadlo na `"forward"` a bežalo ako
   `first: N, after: startCursor`. Nepadalo — ticho vrátilo zlú stránku. **Opravené (#9).**
3. **`/sk/products` malo `<title>Products</title>`** — natvrdo anglická metadata, bez
   brand suffixu a bez canonicalu, na slovensky-prvom obchode. **Opravené (#9).**
4. **Kategóriový filter mohol ticho prestať filtrovať.** `categoryIds` sa staval z
   `Map.values()`, takže kategória zahodená kvôli chýbajúcemu prekladu zmizla z **filtra**,
   nie len z čipu → `?categories=…` vrátilo **nefiltrovaný** listing. **Opravené (#10).**
5. **Prázdny stav na `/collections` a `/products` bol natvrdo po anglicky**
   („No products match your filters.") — porušenie CLAUDE.md §6 na dvoch miestach.
   **Opravené (#4)**, navyše používal nedefinované shadcn tokeny, takže sa podľa §4.2
   renderoval bezfarebne.

---

## 4. Čo zostáva — zoradené

### Živé, neopravené

| vec                                                                            | dôkaz                                                                                          | poznámka                                                                                                   |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Druhá odmietnutá Suspense hranica na KAŽDEJ kategórii**                      | `$RX("B:b","1261926781")` na `/sk/categories/*`, chýba na `/sk`, `/sk/products`, `/sk/kontakt` | reprodukuje sa aj na mojom builde; zdroj som neidentifikoval. Živá serverová chyba, ktorú nikto nesleduje. |
| Header linkuje `/wishlist`, routa neexistuje                                   | `/sk/wishlist` = 200 + noindex (soft-404)                                                      | **po zapnutí gate to bude tvrdá 404**. Najmenší fix = skryť link.                                          |
| `/sk/search` má natvrdo anglické UI                                            | „Results for", „products found"                                                                | opravil som len smer stránkovania, nie copy                                                                |
| Hero + header „Vybrať vozidlo" bez handlera, newsletter ticho zahadzuje e-mail | podklady §12                                                                                   | pre-release podmienka, patrí k integrácii B                                                                |
| `/sk/products` a `/sk/search` neboli i18n-ované celé                           |                                                                                                |                                                                                                            |

### Latentné (detonujú pri prvom preloženom trhu alebo väčšom katalógu)

- Base slugy v sitemape pre nezdrojový trh (viď §2.2 — dnes 2 URL, nie 9192).
- `collections/[slug]` nemá noindex vetvu pre prázdnu kolekciu, ktorú kategórie majú.
- `collections/[slug]` neemituje canonical na žiadnej vetve.
- Duplicitný brand suffix + chýbajúci 60/155-znakový trim na
  `categories/[slug]/page.tsx:110,119` a `collections/[slug]/page.tsx:103`.
- Šesť SK-only právnych stránok má statické `metadata` bez channel guardu, kým komponent
  volá `notFound()`. **Dnes to maskuje proxy**, takže to nie je živý únik — nie je to
  urgentné, napriek tomu, ako to znie.
- `editorjs.ts` renderuje `<table>` bez overflow wrappera → na mobile potenciálny bočný
  pan. **Zámerne neopravené: zo 60 živých produktov nemá tabuľku ani jeden**, takže by
  som pridával neoveriteľné CSS proti obsahu, ktorý neexistuje.

### Fakty, nie chyby

- **hreflang neexistuje** — emituje sa z jedinej stránky a vracia `[]`, kým je live len
  `sk`. To je správne. Nehláste „hreflang je recipročný" ako prejdený stav.
- **`ROUTE_POLICY.indexable` má nula konzumentov.** Vyzerá ako mechanizmus, nie je ním.
- **`/api/revalidate` vracia 401** — `REVALIDATE_SECRET` ani `SALEOR_WEBHOOK_SECRET` nie sú
  v `.env`. Žiadny invalidačný runbook dnes nejde vykonať.

---

## 5. Prostredie — pasce, ktoré stáli čas

1. **`pnpm generate:all` v novom worktree ZLYHÁ**, lebo worktree nemá `.env`. Treba
   `NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/ pnpm generate:all`.
   A pozor: `pnpm … | tail` **maskuje exit kód** — zlyhanie codegenu mi prvýkrát prešlo
   ako „exit 0".
2. **Generované dokumenty sú `TypedDocumentString`, nie AST.** `print(doc)` z `graphql`
   hodí „Invalid AST Node"; použite `String(doc)`.
3. `pnpm knip` a `pnpm build` tiež potrebujú ten env var.
4. `knip` na tejto vetve **padá už teraz** (~15 pre-existing nepoužitých exportov).
   Nepridávajte ďalšie — nové typy nechávajte neexportované.
5. Test na react komponent sa nedá pridať: vitest `include` je len `src/**/*.test.ts`
   (nie `.tsx`) a env je `node`. Preto sú rozhodovacie pravidlá vytiahnuté do čistých
   funkcií (`listingEmptyReason`, `listingResultCount`) a testované tam.

---

## 6. Pre vlákno B

- **`variant-section-dynamic.tsx` čísla riadkov z podkladov §B4 sú po tomto merge znovu
  posunuté.** Neberte ich doslova, vyhľadajte `<AddToCart` a `<form action={addToCart}`.
  Varovanie, že CompatibilityBox sedí **vnútri `<form>`** a `<button>` bez
  `type="button"` spustí add-to-cart, **platí**.
- `plp` i18n namespace má odo mňa dva nové kľúče (`listingEmpty`, `listingUntranslated`)
  vo všetkých 12 katalógoch. `plp.*` **nie je** commerce manifest namespace (ten pokrýva
  `cart.*`, `checkout.*`, `common.close`), takže manifest ani placeholder registry
  netreba meniť.
- `ListingEmptyState` je zdieľaná — ak pridáte stav „nič nepasuje na toto vozidlo",
  patrí tam, nie do troch klientov zvlášť.
- Integračný SHA odo mňa: **`8e872dd`** (tip vetvy pred týmto dokumentom).

## 7. Pre CFM

- Media `id` je teraz ťahané (`ProductDetails.graphql`, `VariantDetailsFragment.graphql`),
  takže lokalizovaný ALT kontrakt **má sa na čo naviazať**. Kľúčujte ním, nie poradím.
- Vlajková `stresne-nosice` je stále verejne prázdna. Storefront už neklame o dôvode —
  naplniť ju je vaša strana. Prázdnych je **11 z 30**.
- Preklad bez `translation.slug` je horší než žiadny: base-slug lookup ho nájde, ale
  kanonická URL bude ukazovať inam.
