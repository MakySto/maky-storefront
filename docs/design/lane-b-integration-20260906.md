# Vlákno B — integrácia do plôch A (stav k 2026-09-06)

Nadväzuje na `handoff-20260906-vlakno-b-dokoncenie.md`. Ten zostáva platný pre kontext,
uzavreté rozhodnutia a pasce; tento dokument popisuje, čo pribudlo a čo z toho je
skutočne dokázané.

|                  |                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------- |
| vetva            | `claude/sf-b-vehicles-integration-b697ce` @ `89ae834` (over cez `git ls-remote`)        |
| základ           | `27b7088` = produkcia (Lane A, BUILD_ID `EeqdrEsFOEh2OMnTDHF03`)                        |
| predchádzajúca B | `claude/sf-b-vehicles-continue-4f53aa` @ `a3fe38f` — táto vetva ju obsahuje celú        |
| nasadené z B     | **nič** — branch-only                                                                   |
| worktree         | `/opt/storefront/.claude/worktrees/sf-b-vehicles-integration-b697ce`                    |
| brány            | tsc 0 · lint 0 errors (6 pre-existujúcich warningov) · i18n OK · 1433 testov · build OK |
| testovaný build  | BUILD_ID `z3di76jka0890u23tYXa1` (lokálny, `next start -p 3021`)                        |

## 1. Šesť commitov

1. **`591bcbf`** header + hero. `VehicleSelectorTrigger` (mŕtve tlačidlo v produkcii)
   zmazané; `ActiveVehicleLauncher` je server komponent, ktorý číta garáž a dataset,
   volá `connection()` explicitne a **nerenderuje nič**, keď funkcia nemôže konať
   (žiadny dataset, alebo vypnutá garáž). Nový `compact` variant — pod `lg` nebol výber
   vozidla dostupný **nikde**, lebo nav row je `hidden lg:block`.
2. **`d4fc2b1`** PDP. `PdpCompatibility` pri CTA (mimo `<form>`) + `PdpVehicleApplications`
   pod špecifikáciami. Nová brána `datasetSpeaksForProduct`.
3. **`68d2b6d`** PLP na troch call sites, cesta CFM → Saleor ID → `filter:{ids}`.
4. **`1059af9`** lokalizácia na dátovej hranici + rozšírená projekcia dotazu.
5. **`4d29e18`** po neistom pridaní je hlavná akcia karty „Skontrolovať košík".
6. **`89ae834`** dve chyby, ktoré našiel prehliadač (nižšie).

## 2. Merania proti živému Saleoru (2026-09-06, iba čítanie)

Tri fakty, ktoré zmenili návrh, a žiadny z nich nie je vidieť na zelenom builde:

- **`filter: { ids: [] }` vráti CELÝ katalóg (9 606), nie nič.** Prázdna množina sa preto
  do dotazu nesmie dostať. Namiesto nej ide `UHJvZHVjdDotMQ==` (`Product:-1`), ktoré
  živo vracia `totalCount: 0` a kategóriu nechá vyriešiť sa — preskočiť dotaz nejde,
  preskočil by sa aj test existencie kategórie/kolekcie.
- **`first: 100` je strop STRÁNKY, nie filtra.** 250 ID → `totalCount: 250` a korektná
  paginácia. Kandidáti sa preto nesekajú a radenie/počty/stránkovanie ostávajú Saleoru.
- **Neplatné ID zhodí celý dotaz** (`Invalid ID specified.`) a `/{market}/products` na
  zlyhaný listing hádže. Jeden zlý riadok z CFM by zložil hlavný listing trhu → ID sa
  validujú ako base64 `Product:<pk>` skôr, než sa dostanú do dotazu.

## 3. Čo je dokázané v prehliadači (produkčný build, po odmietnutí cookies)

| kontrola                               | výsledok                                                   |
| -------------------------------------- | ---------------------------------------------------------- |
| header launcher otvorí selektor (1440) | ✅ Škoda/Volkswagen/BMW                                    |
| výber vozidla → cookie `maky-garage`   | ✅ httpOnly, SameSite=Lax                                  |
| `compact` launcher pod `lg`            | ✅ viditeľný na 360 aj 900                                 |
| hero už nie je amber                   | ✅ `bg-action-primary`                                     |
| bez sideways-pan                       | ✅ doc == win na 360 (home/PLP/konfig/garáž)               |
| PLP bez vozidla                        | ✅ ponuka filtra, 9 606 produktov                          |
| PLP s vozidlom, filter vypnutý         | ✅ „Produkty pre vaše vozidlo"                             |
| PLP `?vehicle=1` (demo dataset)        | ✅ **0 produktov**, nie 9 606                              |
| kategória `?vehicle=1`                 | ✅ 0 produktov, kategória sa vyrieši                       |
| prepínač filtra zahodí cursor          | ✅ zo str. 2 → `?sort=price_asc&vehicle=1`                 |
| bez uloženého auta + `?vehicle=1`      | ✅ „Ponuku sme nezúžili"                                   |
| PDP mimo rozsahu fitmentu              | ✅ ticho, žiadny box, žiadne applications                  |
| PDP nákupný formulár                   | ✅ 0 tlačidiel bez `type`, žiadne vnorené formuláre        |
| konfigurátor na fixture                | ✅ 3 karty, „Ukážka", nákup zakázaný, žiadna reálna značka |
| **obnova obrázka po 503**              | ✅ **REAL** — viď §4                                       |

## 4. IMAGE_RECOVERY_TESTED = YES [REAL]

Na skutočnom Nordrive PDP, ktorého náhľady servíruje `api.maky.store/thumbnail/`:
10× vynútené 503 cez CDP → 9 naplánovaných a odpálených 3 s timerov → 9 requestov s
`_maky_image_retry=1` → 9/12 obrázkov načítaných, 0 placeholderov.

⚠️ **Prvý pokus na PLP vyzeral ako mŕtvy retry a nebol.** Karty listingu dostávajú
`cdn.maky.store/thumbnails/...`, ktoré `isRetryableSaleorThumbnail` zámerne odmieta —
nie je to prechodný stav. Pri veľkosti 1024 (tú PLP používa) je zo vzorky 500 produktov
405 z CDN a 95 z `api.maky.store`. Kto to bude testovať znova: **vyber produkt, ktorého
náhľad je on-demand**, inak testuješ vetvu, ktorá sa nemá spustiť.

## 5. Čo NIE JE dokázané a prečo

- **PDP CompatibilityBox a ProductVehicleApplications sa v prehliadači nikdy
  nevyrenderovali.** Fixture dataset používa `demo-product-*` ID, ktoré sa zámerne
  nezhodujú so žiadnym reálnym produktom (to je práve to, čo bráni demo dátam obliecť si
  fotku a cenu skutočného produktu). `datasetSpeaksForProduct` teda na každom reálnom PDP
  vráti `false` a box mlčí — čo je správne. Vyrenderovať ho by znamenalo vymyslieť
  fitment pre reálny produkt, čo je zakázané. **Odblokuje to až CFM snapshot.**
- **`?vehicle=1` s reálnymi Saleor ID** nebolo v prehliadači — demo dataset nikdy
  nezužuje listing reálnych produktov. Sémantika Saleoru je overená priamo proti živému
  API (§2), zvyšok je v unit testoch.
- **Stav „Skontrolovať košík" po `unconfirmed`** je overený unit testom, nie prehliadačom:
  do `addConfiguredSetToCart` sa v prehliadači nedá dostať, kým je dataset demo (server aj
  UI nákup odmietajú), a demo interlock sa kvôli testu neoslabuje.
- `PROVIDER_CONNECTED = NO`, `REAL_SNAPSHOT = NO`, `LIVE_OFFER = NO` — bez zmeny.

## 6. Nálezy mimo rozsahu B (nemenil som ich)

1. **Neplatný cursor zhodí listing.** `/sk/products?cursor=abc&direction=next` vráti
   „Something Went Wrong". Saleor odmietne cursor → `!result.ok` → stránka hádže. Bez
   `?cursor` je v poriadku. Pre-existujúce v A; zastaraný odkaz alebo záložka to trafí.
2. **`use-product-filters.ts` nezahadzuje cursor.** Zmena kategórie alebo ceny na 3.
   strane nesie ďalej cursor z inej výsledkovej množiny. Pre-existujúce v A; môj vlastný
   prepínač filtra cursor zahadzuje.
3. **React #418** je na každej stránke aj na živej produkcii — potvrdené znova tu.
4. **en-CA parita**: 212 chýbajúcich `cart.*`/`checkout.*` kľúčov, pre-existujúce,
   nedotknuté. `fitment` 80/80 a `configurator` 52/52 sú kompletné vo všetkých 12.

## 7. Rozhodnutia pre Mareka (nerobil som ich)

Platia všetky z `handoff-20260906-vlakno-b-dokoncenie.md` §5 E. Navyše:

- **Šírka vyhľadávania na 360 px.** Compact launcher zdieľa riadok s vyhľadávaním; s
  uloženým autom ostane vyhľadávaciemu poľu ~160 px a placeholder sa oreže. Alternatíva
  je ikona bez textu pod `sm`, čo je horšie zrozumiteľné. Nechal som text.
- **Route `/konfigurator`** je cieľ odkazu „Zobraziť kompatibilné produkty" v NO_FIT
  stave PDP boxu. Ak sa slugy budú lokalizovať, zmení sa aj tento odkaz.
