# M → CFM: stav storefrontu pre aktiváciu Thule

Súbor sa dopĺňa po každom míľniku, najnovší je dole. Živý dôkaz z bežiaceho procesu je vždy
`curl https://maky.store/api/fitment/status` (verejné, bez tajomstva, `Cache-Control: no-store`) —
CFM ho môže čítať samo, nikto nemusí nič prenášať.

## 1. 2026-10-01 21:30 UTC — R0+R1 nasadené, dataset `.2` načítaný bežiacim procesom

```
M_DATASET_CONFIRMED=394346c97009832300cd407159117a42c99cf23541202117bc986d3da7d333c9
```

|                  |                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| nasadený release | `fab2985ab1d7df8703e53a6ff05df9b965dc8701` (R0 + R1), BUILD_ID `F2fH6eFtARQRLHD7LGRR9`, postavený 2026-10-01 21:23:35 UTC            |
| dataset          | `3.0.0-full-20261001.2`, `datasetHash` **prepočítaný procesom** `394346c97009832300cd407159117a42c99cf23541202117bc986d3da7d333c9`   |
| bajty súboru     | 15 915 111, `transportSha256` `befb1cb5792a3cff2fdb9eb2215cbe27285450f363d5d297460b54e8b0f5e9f1`                                     |
| obsah            | 70 značiek, 691 modelov, 1 108 generácií, 2 566 aplikácií                                                                            |
| načítaný         | 2026-10-01 21:29:58 UTC pri štarte procesu za 537 ms, riadok `[fitment] loaded 3.0.0-full-20261001.2 394346c9… (15915111 B, 537 ms)` |
| platnosť         | `stale: false`, zastará 2026-10-31 17:48 UTC                                                                                         |
| viditeľnosť      | 0 z 9 140 skrytých sád je viditeľných anonymnému návštevníkovi (kontrola tesne pred zverejnením), 10 pilotov verejných, 71743 skrytá |
| štartovanie      | jeden proces PM2 `maky-storefront`, zahriate `/sk`, `/sk/stresne-nosice`, `/sk/konfigurator`, `/sk/categories/thule-stresne-nosice`  |

`M_DATASET_CONFIRMED` je hodnota pre `M_DATASET_CONFIRMED=… bash run_activation.sh`
(balík `activate_sk1001_807262b7`, iba `sk-eur`). Po bloku 1 (250 sád) runner zastaví.

**Čo urobí M samo po aktivácii bloku 1** (CFM nemusí nič hlásiť, M číta Saleor anonymne a vie, kedy je blok 1 verejný a kedy
runner zastavil): vyčistí cache cez `/api/revalidate`, spustí skorý test na skutočných produktoch bloku 1, prejde v prehliadači
výber auta → produkt → košík (bez objednávky a platby), overí nesprávny rok a strechu a Nordrive. Výsledok sa zapíše sem.
`EARLY_TEST_OK=1` je podmienené iba týmto výsledkom, nie ďalším potvrdením od Mareka.

## 2. 2026-10-01 21:45 UTC — CFM potvrdenie prijalo a overilo; čaká sa na GO

CFM nezávisle overilo `/api/fitment/status` o 21:35 UTC (hash `394346c9…`, `befb1cb5…`, 15 915 111 B, `stale: false`). Aktivácia ešte nebeží: CFM ju spustí po GO,
ktoré mu Marek dá vo vlastnom vlákne CFM. M nič z toho neurýchľuje ani nenahrádza.

**Rozpor v dokumentoch je vyriešený rozhodnutím vlastníka** (najnovšia správa, má prednosť pred HANDOFF §9.3 krok 4): po úspešnom skorom teste CFM pokračuje s `EARLY_TEST_OK=1`
automaticky, bez ďalšieho potvrdenia Mareka a vrátane všetkých 37 blokov. HANDOFF §9.3 krok 4 je opravený rovnako. Výsledok skorého testu sa zapíše sem ako
`EARLY_TEST_RESULT=PASS` alebo `EARLY_TEST_RESULT=FAIL`; pri FAIL M zastaví a hlási Marekovi.

Úvody (56 stránok s rozporom, 13 odkrytých blokom 1): oprava je obsah v CFM + nový artefakt, ktorý M prevezme; neblokuje aktiváciu.

## 3. 2026-10-01 21:55 UTC — skorý test bloku 1 (250 sád, pk 71720–72042) na produkcii

Výsledok (samostatný riadok, ktorý CFM číta):

EARLY_TEST_RESULT=PASS

| overené                                                                                             | výsledok                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| automatizovaný skorý test `thule-early-test.mjs --phase post` na živom `maky.store`, 33 prípadov    | **136 z 136** (12 prípadov ukáže sadu za cenu CFM so strechou a rokmi, 21 prípadov ju neukáže: rok pred oknom, rok po okne, iná strecha, žiadna strecha; piloty 200; 71743 404; vzorka 60 sád z ďalších blokov stále neviditeľná)   |
| cache                                                                                               | riadená invalidácia `/api/revalidate` pre `stresne-nosice`, `thule-stresne-nosice`, `nordrive-stresne-nosice` o 21:49:44 UTC, až po konci mutácií CFM (21:47:48)                                                                    |
| zákaznícky priechod v prehliadači (výber auta v selektore → konfigurátor → klik na produkt → košík) | Honda Civic Sedan FD 2009 → Thule SlideBar EVO Silver **554,85 €**; Mercedes-Benz Sprinter W906 2013 → Thule WingBar EVO Black **439,85 €**; produktová stránka `index, follow`, kanonická na seba, JSON-LD cena = cena CFM         |
| košík (kontrola priamo v Saleore podľa cookie košíka)                                               | 2 riadky, správne produkty a varianty (SKU končí `…d23cc69eb0374a-000000` a `…24d23b5d3d4b90-000000`), množstvo 1, 554,85 € + 439,85 € = **994,70 €**; objednávka ani platba sa nevytvorili, košík po teste vyprázdnený (0 riadkov) |
| nesprávny rok a strecha                                                                             | Civic 2008 (pred oknom 2009–2011), Sprinter 2014 (po okne 2006–2013), Grandland X 2019 s integrovanými pozdĺžnikmi (sada je pre holú strechu): očakávaná sada sa neukáže                                                            |
| Nordrive zachovaný                                                                                  | BMW X5 E70 2012: 7 sád Nordrive, názvy aj ceny totožné so stavom z 30. 9. (+ 1 verejný pilot Thule)                                                                                                                                 |
| mobil                                                                                               | 390 px: výber auta → karta → produkt funguje; 390 a 360 px bez horizontálneho pretekania na produkte, polici Thule aj konfigurátore                                                                                                 |
| galérie                                                                                             | 6 čiernych sád bloku 1: 4 až 5 obrázkov, bez strieborného detailu. Sady s pätkou 710800 sú v blokoch 7, 10, 13 … 37, overia sa po poslednom bloku                                                                                   |
| sitemapa                                                                                            | `sk-products-1.xml` 9 581 → **9 831** adries (+250), 260 adries Thule (250 + 10 pilotov), všetkých 12 prípadových sád v nej je                                                                                                      |
| stabilita                                                                                           | od aktivácie 0 nových `NEXT_STATIC_GEN_BAILOUT` (254 ako pred nasadením), 0 nových riadkov chybového logu, dataset `unchanged` (304 not modified), všetky kľúčové stránky 200                                                       |

Podľa rozhodnutia vlastníka teda CFM pokračuje blokmi 2 až 37 s `EARLY_TEST_OK=1`. M počas behu nič nemení; sleduje Saleor a po poslednom bloku čistí cache a sitemapu,
overí verejný počet a galérie 710800 a čiernych sád.

## 4. 2026-10-01 23:05 UTC — po poslednom bloku: všetkých 37 blokov verejných, overené na produkcii

| overené                                        | výsledok                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saleor, anonymný návštevník `sk-eur`           | **9 140 z 9 140** sád viditeľných aj kúpiteľných (`isAvailableForPurchase`), posledný blok 37 o 22:54:39 UTC; verejných produktov spolu **18 721** (9 581 + 9 140)                                                                                                                                                                                                         |
| cache                                          | riadená invalidácia `/api/revalidate` pre tri police o 22:55:37 UTC po konci mutácií, sitemapa zahriata (studená prechádzka 12,9 s, teplá 77 ms)                                                                                                                                                                                                                           |
| sitemapa                                       | jeden SK shard, **18 721** produktových adries, všetkých 9 140 nových sád v ňom je, adries Thule 9 150, 71743 v nej nie je                                                                                                                                                                                                                                                 |
| produktové stránky                             | vzorka 148 stránok (4 z každého z 37 blokov): všetky 200, JSON-LD cena = cena CFM, `index, follow`, kanonická na seba, Thule v názve                                                                                                                                                                                                                                       |
| 71743 (podmienka skla)                         | HTTP 404, ostáva skrytá                                                                                                                                                                                                                                                                                                                                                    |
| 28 prípadov CFM cez HTTP na živom `maky.store` | **všetkých 28 v poriadku**: pre každé auto počet overených = predávaných = kariet na stránke, každá karta má „Strecha · Roky“; sady, ktoré boli pred aktiváciou „nie sú v predaji“ (Q7 2025, X2 U10, Q5 FY, X5 E70, Civic FD, pätka 710800), ukazujú plné sady; prípad 28 správne „nie sú v predaji“; prípady bez strechy alebo s inou karosériou „nemáme overenú zostavu“ |
| galéria pätky 710800                           | všetkých 27 sád: 6 obrázkov vrátane `thule_oversize_rail_foot_-_710800` (dve fotky pätky) a nákresu strechy s lyžinami; vizuálne overené na čiernej sade KGM Rexton Sports Q200 (čierna tyč, detail priečnika, pätka, montáž, nákres)                                                                                                                                      |
| čierne vyhotovenie                             | 40 čiernych sád rozložených cez všetky bloky: 3 až 6 obrázkov, bez strieborného detailu (verejný pilot 72883 má podľa dohody starú galériu)                                                                                                                                                                                                                                |
| police                                         | Thule strešné nosiče **9 150** produktov (9 140 + 10 pilotov), Nordrive 9 157, hlavná polica strešných nosičov 18 307                                                                                                                                                                                                                                                      |
| stabilita                                      | od nasadenia 0 nových `NEXT_STATIC_GEN_BAILOUT` (254 ako pred ním), +11 riadkov chybového logu za 1 h 40 min, dataset `unchanged` (304), záťaž ~0, jeden proces PM2 bez reštartu od 21:29:58                                                                                                                                                                               |

Čo ostáva mimo tohto behu (nič z toho neblokovalo otvorenie): 56 úvodov s nepravdivou vetou o jednej streche (CFM opraví cielene, M prevezme nový artefakt obsahu),
Subaru Legacy BP, 48 dvojíc generácií s rovnakými rokmi, rozdiel 82 vs 84 zmenených generácií, roky okien za koncom výroby generácie, `urlPath` pre 383 áut, dataset v2.
Dataset `.2` zastará **2026-10-31 17:48 UTC** — nový export musí prísť skôr.

## 5. 2026-10-04 — úvody 20261001 živé, krok 0 SYNC-1, čítačka CoolZ živá (storefront VPS)

| položka               | hodnota                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| vydanie 56 úvodov     | **živé od 14:32 UTC**: sada `20261001` v `/opt/storefront-artifacts`, `sha256sum -c` 11 z 11; 56 z 56 stránok ukazuje opravený text, 0 starý; sitemap `sk-vehicles` 1 475 URL; dataset nezmenený                                                                                                                                                |
| SYNC1_PROCESSES       | 1 (`pm2 jlist`, online, fork), teda `CATALOG_STOREFRONT_EXPECTED_PROCESSES=1`                                                                                                                                                                                                                                                                   |
| SYNC1_LIVE_SOURCES    | `MAKY_CATALOG_CONTENT_PATH=/opt/storefront-artifacts/maky_catalog_content_1.0.0-{lang}-20261001.json`, `MAKY_CATALOG_CONTENT_SHA256SUMS=/opt/storefront-artifacts/SHA256SUMS_CONTENT_20261001`, `MAKY_CATALOG_CONTENT_URL` nenastavené, `MAKY_FITMENT_URL=https://carfitmanager.com/media/fitment/maky_roof_fitment_3.0.0-full-20261001.2.json` |
| `/api/fitment/status` | `mode` http, `loaded` true, `datasetVersion` `3.0.0-full-20261001.2`, `datasetHash` `394346c97009832300cd407159117a42c99cf23541202117bc986d3da7d333c9`, `transportSha256` `befb1cb5792a3cff2fdb9eb2215cbe27285450f363d5d297460b54e8b0f5e9f1`, `staleAfter` 2026-10-31T17:48:14Z                                                                 |
| SYNC1_DEPLOYED        | nie; živý je `d64e206` / BUILD_ID `5Lm0wXLDDpz5dnwbIhHzs` (CoolZ čítačka, 16:56 UTC), `/api/catalog/status` dáva 404, manifest vypnutý                                                                                                                                                                                                          |
| čítačka tabuľky CoolZ | živá a bez účinku, kým CFM nepublikuje popis s tabuľkou; päť stránok CoolZ ostáva so zoznamom, v HTML nie je `class="maky-cmp"`                                                                                                                                                                                                                 |

Prvá časť bola poslaná relácii „CFM VPS“ správou 4. 10. 14:35 UTC a druhá 17:10 UTC; prečítanie sa nepotvrdzuje, preto je to aj tu.
