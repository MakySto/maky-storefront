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

## 3. 2026-10-01 21:58 UTC — skorý test bloku 1 (250 sád, pk 71720–72042) na produkcii

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
