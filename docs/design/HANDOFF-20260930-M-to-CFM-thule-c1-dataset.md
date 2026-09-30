# M → CFM · THULE-C1: kontrola datasetu `3.0.0-full-20261001` storefrontom (30. 9. 2026)

Odpoveď vlákna M (maky-storefront) na `CFM_THULE_C1_STOREFRONT_M_20260930.md`. Všetko nižšie je
odmerané kódom **bežiaceho** releasu, nie `e0d9ffed`.

## 0 · Stav (30. 9., 13:40 UTC)

**Potvrdzujem: bežiaca aplikácia maky.store (`228590b`) načítala dataset `3.0.0-full-20261001` s
`datasetHash` `fd3507de798ac50e31c4e481e1ecd9c39e80288359f0524123eaedf69af0bc30`.** Dôkazy sú v §9.
Predaj 10 sád je otvorený a cesta v prehliadači prešla vrátane zlého roku a strechy (§10).
71743 ostáva skrytá.

|                   |                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| bežiaci release   | **`228590b`**, BUILD_ID `s939Ob_pi1tGplWJrjgeD`, nasadený 28. 9. 19:48 UTC (bez nového buildu)                                                                     |
| oproti `e0d9ffed` | 76 commitov; vo fitmente `resolve.ts` (rozsah na variant), `compatibility-box.tsx`, `pdp-compatibility.tsx`, `intended-for.ts` → kontrola zopakovaná nad `228590b` |
| prepnutie         | Marek: záloha `.env.backup-20260930T131433Z`, zmenený iba kľúč `MAKY_FITMENT_URL`, `pm2 restart maky-storefront` o **13:15:28 UTC**; `maky-smtp-app` nedotknutá    |
| pred prepnutím    | `3.0.0-full-20260915.2` (`dv` v cookie garáže z bežiaceho procesu, 12:18 UTC)                                                                                      |
| poradie           | fáza B prebehla medzi 13:15 a 13:32 UTC, teda skôr, ako som potvrdenie napísal; výsledok som overil dodatočne (§9, §10) a sedí                                     |

## 1 · Artefakt — kód `228590b`

|                                                 | `20260915.2` (živý)  | `20261001` (nový)                                                                                   |
| ----------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| bajty                                           | 7 977 173            | **7 993 764**                                                                                       |
| sha256 súboru                                   | `6fddb7aa…`          | **`6cfbacc3a0c18e7ef285a86b6ca1a595b94c5b39d7fab23aef61426e7e864fc0`** = `SHA256SUMS_FULL_20261001` |
| deklarovaný `datasetHash`                       | `af9e6750…`          | **`fd3507de798ac50e31c4e481e1ecd9c39e80288359f0524123eaedf69af0bc30`**                              |
| prepočítaný z textu / z hodnoty                 | zhodný / zhodný      | **zhodný / zhodný**                                                                                 |
| validátor (`saleorInstance` = `api.maky.store`) | OK, 97 varovaní      | **OK, 96 varovaní** — zmizlo iba `app:ec660c4e…` (V408 do 2022), inak totožné                       |
| `generatedAt`, `staleAfterDays`                 | 15. 9. 13:22 UTC, 30 | 30. 9. 11:07 UTC, 30                                                                                |

⚠️ **Dataset starne o 30 dní.** Nový súbor prestane odpovedať **30. 10. 2026 o 11:07 UTC** (živý by
prestal 15. 10.). Potom resolver vracia `STALE`: konfigurátor nič neponúkne a produktová stránka
povie „Údaje o kompatibilite nie sú aktuálne“. Ďalší export musí prísť pred týmto dátumom.

Validátor hodnotu `coverage.scope.programId` ani dodávateľa neobmedzuje, takže `maky-roof-racks`
a `THULE` prejdú bez zmeny kódu.

## 2 · Nordrive a uložené autá — nič sa nemení

Kontrola `src/lib/fitment/dataset-delta.check.test.ts` prešla každú generáciu živého súboru a
každý výber, ktorý si zákazník mohol uložiť (rok v rozsahu výroby × mesiac tam, kde rozhoduje ×
každá strecha aj „bez strechy“ × karoséria/dvere), cez `resolveVehicleOutcome` oboch súborov:

- **53 325 výberov: 52 891 rovnaká ponuka, 434 sa líši iba pribudnutou sadou Thule, 0 iných rozdielov.**
- 0 generácií, modelov ani značiek neubudlo → **0 uložených áut sa stane „nepriradeným“**.
- **Voľby strechy** (`roofChoicesFor`, t. j. generácia ∪ aplikácie): 0 zmien. Kvalifikátory
  generácií: 0 zmien. Selektor sa pri uloženom aute nepýta nič nové — potvrdzujem váš §2.
- Aplikácie: +11, 0 zmenených, 0 odobraných; produkty Nordrive: 9 163, všetky s rovnakými aplikáciami.

Zmeny pre **nové** výbery (nie pre uložené autá):

- Ford Transit Connect: rok 2022 = V408 (predtým voľba V408/V761), 2023 = V408 (predtým V761),
  2024 = voľba V408/V761 (predtým V761). Uložené auto V761/2022–2023 dostane ďalej rovnakú ponuku,
  resolver roky generácie nečíta.
- Audi Q7: pribudli roky 2016–2027 (generácia 4M), 2015 je voľba 4L/4M.
- ⚠️ BMW modely sa v slovenskom selektore teraz volajú po anglicky: „1 Series“, „3 Series Touring“,
  „4 Series Coupé“… (predtým „1-Rad“). Nie je to chyba storefrontu, iba otázka, či je to zámer.

## 3 · Pilotné sady — matica resolvera (`228590b`)

Pre každú z 11 sád: každý rok od (začiatok generácie − 1) po (koniec + 1) × každá strecha, ktorú
selektor ponúkne, plus „bez strechy“.

| sada                | auto (generácia)                     | ponúkne sa                                          | mimo okna         | iná strecha          | bez strechy |
| ------------------- | ------------------------------------ | --------------------------------------------------- | ----------------- | -------------------- | ----------- |
| 71732 WingBar Evo   | BMW X5 E70 (2006–2013)               | 2011–2013 · pozdĺžniky                              | neznáme           | — (jediná strecha)   | pýta sa     |
| 71778 WingBar Evo   | Honda CR-V RM (2012–2018)            | 2015–2018 · integrované                             | neznáme           | holá: neznáme        | pýta sa     |
| 72883 WingBar Evo   | Opel Combo Life E (2018–)            | 2018–2024 · pozdĺžniky                              | neznáme           | —                    | pýta sa     |
| 71755 WingBar Edge  | Audi Q5 FY (2017–2025)               | 2017–2020 · integrované                             | neznáme           | —                    | pýta sa     |
| 71719 WingBar Edge  | Seat Ibiza 6J (2008–2017)            | 2009–2012 · holá                                    | neznáme           | —                    | pýta sa     |
| 71723 WingBar Edge  | Toyota Hilux AN120 (2015–) _nová_    | 2026– · holá                                        | 2015–2025 neznáme | —                    | pýta sa     |
| 71721 SquareBar Evo | Audi Q7 4M (2015–) _nová_            | 2020–2024 · integrované                             | neznáme           | —                    | pýta sa     |
| 71769 ProBar Evo    | BMW X2 U10 (2023–)                   | 2024– · holá                                        | 2023 neznáme      | integrované: neznáme | pýta sa     |
| 71843 ProBar Evo    | VW Transporter T5 (2003–2015) _nová_ | 2010–2015 · T-drážka                                | neznáme           | —                    | pýta sa     |
| 71729 SlideBar Evo  | MAN TGE UY (2017–) _nová_            | 2017– · pevné body                                  | 2016 neznáme      | —                    | pýta sa     |
| 71743 SquareBar Evo | Opel Vivaro Van C (2019–) _nová_     | 2019–2024 · pevné body **+ podmienka iba ako text** | neznáme           | —                    | pýta sa     |

„Neznáme“ (`UNKNOWN`) a „pýta sa“ (`AMBIGUOUS`) sa zákazníkovi nikdy neponúknu. Každý produkt
Thule má práve jednu aplikáciu a žiadna sada Nordrive nie je v aplikácii Thule.

**71743 potvrdzujem ako blokovanú:** resolver ju pre Vivaro 2019–2024 s pevnými bodmi ponúkne
(`MANUFACTURER_FIT`) a podmienku `roof-without-glass-roof` iba vypíše. Presne ako píšete v §4.
Nech ostane skrytá, kým storefront podmienku nevyhodnotí.

## 4 · Skryté produkty sa neponúkajú

- Saleor, anonymne, **presne dotaz storefrontu** (`FitmentProductsByIds`, `sk-eur`): 11 pilotných
  ID → **0 vrátených**; kontrolná sada Nordrive `UHJvZHVjdDoxNjk0` → vrátená. `product(slug)` pre
  11 slugov → 0 z 11.
- maky.store: **11/11 produktových stránok = 404.**
- Lokálny build `228590b` s novým datasetom proti produkčnému Saleoru (len čítanie), cesta
  selektorom v prehliadači:
  - MAN → TGE → 2020 → pevné body → **„0 zostáv — Kompatibilné zostavy pre toto vozidlo
    existujú, ale momentálne nie sú v predaji.“**
  - BMW → X5 → 2012 → pozdĺžniky → **7 sád Nordrive, žiadny Thule.**
- Medzičas po prepnutí: 5 nových generácií (MAN TGE, Transporter T5, Hilux AN120, Vivaro Van C,
  Q7 4M) je v selektore s hláškou „…momentálne nie sú v predaji“, kým ich sady neotvoríte.
  Pri Vivaro Van C to platí, kým bude 71743 skrytá.
- `/sk/categories/thule-stresne-nosice` = 200 `noindex`; `/sk/thule-stresne-nosice` = 404
  (chýba riadok v `category-routes.ts`, ako píšete; mimo tohto pilotu).

## 5 · Prvé načítanie a nedostupný zdroj (lokálny build `228590b`, port 3027)

| situácia                                         | čo sa stane                                                                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| stiahnutie z tohto servera                       | 7 993 764 B za 0,04 s (nginx, statický súbor, `ETag "6abced68-79f9a4"`)                                                                                                                                                  |
| **studený štart, prvý request**                  | **0,45 s** (stiahnutie + parsovanie 17 ms + validácia s hashom 187 ms); ďalšie 0,04 s; jedno stiahnutie na proces                                                                                                        |
| zdroj 404                                        | žiadna 500. Konfigurátor: „Najprv vyberte vozidlo“ aj pri uloženom aute; produktová stránka bez boxu kompatibility, košík funguje; garáž: „Údaje o vozidlách sú momentálne nedostupné.“ **404 sa do logu nezapíše.**     |
| zdroj visí > 5 s                                 | prvý request čaká **5,06 s** (timeout `MAKY_FITMENT_TIMEOUT_MS`, predvolene 5000, platí aj na telo) a potom stránka bez fitmentu; 30 s sa nepokúša znova; log: `TimeoutError`                                            |
| podvrhnutý súbor (1 názov zmenený, hash nechaný) | **odmietnutý**: `datasetHash mismatch: declared fd3507de…, recomputed 99cf793b…` → ako výpadok                                                                                                                           |
| výpadok za behu                                  | dataset drží do konca TTL (`MAKY_FITMENT_REVALIDATE_SECONDS=300`); **po ňom prvé neúspešné obnovenie dobrý dataset zahodí** (nie je stale-if-error) → bez fitmentu, kým zdroj nebeží, + ≤ 30 s. 503 sa do logu nezapíše. |

Pre vás: kým `media/fitment` servuje nginx priamo, reštart `cfm`/`celery` pri GO-B storefront
neohrozí. Výpadok samotného nginx dlhší ako ~5 minút áno.

## 6 · Nález mimo prepnutia: 500 po obnovení datasetu

V logu storefrontu nasleduje **každá** zo 76 chýb `NEXT_STATIC_GEN_BAILOUT` („uncached or runtime
data during prerendering“) hneď po obnovení datasetu fitmentu (spolu 6 702 obnovení; 62× domovská
stránka `/[channel]`, ďalej konfigurátor, vyhľadávanie, garáž…). Request, ktorý po 300 s TTL spustí
nové stiahnutie 8 MB súboru (Next ho nevie uložiť do data cache), dostane asi raz z 90 obnovení
holé „Internal Server Error“. Dve moje sondy to trafili (vyhľadávanie 11:58, konfigurátor 12:15 UTC).
Existuje od zapnutia poskytovateľa (7. 9.), **prepnutie to nezhorší** (rovnaká veľkosť aj TTL).
Oprava (stale-while-revalidate + stale-if-error v `provider.ts`, log verzie a hashu pri načítaní a
logovanie HTTP chýb) je samostatná zmena kódu s nasadením a čaká na GO Mareka.

## 7 · Prepnutie (spustí Marek) a čo overím hneď potom

Záloha `.env`, zmena jediného riadku a zobrazenie rozdielu:

```bash
cd /opt/storefront && TS=$(date -u +%Y%m%dT%H%M%SZ) && cp -p .env ".env.backup-$TS" && sed -i 's#^MAKY_FITMENT_URL=https://carfitmanager.com/media/fitment/maky_roof_fitment_3.0.0-full-20260915.2.json$#MAKY_FITMENT_URL=https://carfitmanager.com/media/fitment/maky_roof_fitment_3.0.0-full-20261001.json#' .env && diff ".env.backup-$TS" .env; echo "backup: .env.backup-$TS"
```

Reštart bez buildu a čas prvého requestu (ten spustí načítanie datasetu):

```bash
pm2 restart maky-storefront && curl -s --retry 30 --retry-delay 1 --retry-connrefused -o /dev/null -w 'first /sk/konfigurator after restart: %{http_code} %{time_total}s\n' http://127.0.0.1:3000/sk/konfigurator
```

Návrat je ten istý `sed` s URL naopak a `pm2 restart maky-storefront`.

Po prepnutí overím (iba čítanie):

1. `.env`, PM2 a smoke test podľa CLAUDE.md §13.5 (stránka, CSS chunk na disku aj cez HTTP).
2. Log od prepnutia: blok varovaní fitmentu má 96 položiek a **neobsahuje** `app:ec660c4e…`.
   To je odtlačok nového súboru v bežiacom procese. Žiadne `provider fetch failed` ani
   `failed validation`.
3. Na maky.store v prehliadači: selektor má 63 značiek vrátane MAN; MAN TGE 2020 → „nie sú v
   predaji“; **`dv` v cookie garáže = `3.0.0-full-20261001`**, zapísané bežiacim procesom;
   BMW X5 E70 2012 → 7 sád Nordrive; cookie uložené dnes pred prepnutím (`dv 20260915.2`) → rovnaká
   ponuka aj garáž.
4. Súbor na URL má stále sha256 `6cfbacc3…`; 11 pilotných produktových stránok ostáva 404.

**Ako to potvrdzuje `datasetHash`:** aplikácia hash navonok neukazuje. Bežiaci kód ho však pri
každom načítaní prepočíta z presných stiahnutých bajtov a pri nezhode dataset odmietne (§5,
podvrhnutý súbor). Dataset, ktorý proces drží, má teda prepočítaný hash rovný deklarovanému.
`dv` a odtlačok varovaní ukážu, že je to `3.0.0-full-20261001`, a súbor s touto verziou na tej
URL má `datasetHash fd3507de…`. Ak chcete hash priamo z procesu, je to jeden riadok logu v
oprave z §6.

## 8 · Po otvorení 10 sád

- Aktivácia musí nastaviť rovnaké príznaky ako pri Nordrive (publikované, viditeľné v listingu,
  dostupné na nákup). Konfigurátor číta anonymný `products(filter: {ids})`.
- Ponuky konfigurátora sú v cache 300 s a „neexistuje“ na produktovej stránke 60 s.
  **Oprava:** pri aktivácii `/api/revalidate` nezavolal nikto (od 12:16 UTC ani jeden
  `[Revalidate]` v logu), takže sa sady ukázali až po uplynutí TTL, najneskôr do 5 minút. Pri
  BMW X5 E70 držala cache o 13:32 ešte 7 sád a pri ďalšom behu už 8. Stiahnutie sady sa prejaví
  rovnako oneskorene. Ak má byť okamžité, Saleor musí pri zmene kanálového listingu volať webhook
  storefrontu.
- V prehliadači prejdem: BMW X5 E70 2012 pozdĺžniky → WingBar Evo 329,90 € popri 7 sadách
  Nordrive → detail („Kompatibilné podľa údajov výrobcu“, THULE) → košík; **negatíva:** X5 E70
  2010 (mimo okna), Honda CR-V RM 2016 s holou strechou (iná strecha), Hilux AN120 2025 (pred
  oknom), Vivaro Van C (71743 ostáva „nie sú v predaji“). Košík vytvorí checkout v Saleore,
  objednávka ani platba nevznikne. **Hotové, výsledky v §10.**

## 9 · Potvrdenie datasetu z bežiacej aplikácie (13:30–13:40 UTC)

**`datasetHash` `fd3507de798ac50e31c4e481e1ecd9c39e80288359f0524123eaedf69af0bc30`,
`datasetVersion` `3.0.0-full-20261001`.**

| kontrola                     | výsledok                                                                                                                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env`                       | oproti záloze sa zmenil iba `MAKY_FITMENT_URL` → `…-full-20261001.json` (53 riadkov pred aj po)                                                                                                                                                             |
| smoke (CLAUDE.md §13.5)      | `/sk` 200; CSS `/_next/static/chunks/0_o_ebffm8ets.css` je v tomto builde, lokálne aj cez maky.store 200 / 157 579 B                                                                                                                                        |
| log bežiaceho procesu        | starý proces: 12 blokov varovaní po 97 položkách s `app:ec660c4e…`; **nový proces od 13:15: 4 bloky (prvé načítanie a 3 obnovenia) po 96 položkách, bez `app:ec660c4e…`**; 0× `provider fetch failed`, 0× `failed validation`, 0× `NEXT_STATIC_GEN_BAILOUT` |
| `dv` v cookie garáže         | **`3.0.0-full-20261001`**, zapísané bežiacim procesom pri dvoch výberoch (MAN TGE 2020 o 13:32:05, BMW X5 E70 2012 o 13:32:10 UTC)                                                                                                                          |
| selektor                     | 63 značiek vrátane MAN (pred prepnutím 62, MAN chýbal)                                                                                                                                                                                                      |
| súbor na URL                 | sha256 `6cfbacc3…`, `ETag "6abced68-79f9a4"`, `Last-Modified 11:07:20 GMT`; od doručenia bez zmeny                                                                                                                                                          |
| hash                         | bežiaci kód prepočíta `datasetHash` z presných stiahnutých bajtov a pri nezhode dataset odmietne (§5). Proces teda drží dataset s hashom uvedeným vyššie                                                                                                    |
| uložené auto spred prepnutia | cookie z 12:18 (`dv 3.0.0-full-20260915.2`, BMW X5 E70 2012, pozdĺžniky) → garáž ukazuje auto, konfigurátor 8 sád = tých istých 7 Nordrive + WingBar EVO                                                                                                    |

Mimo datasetu: medzi 12:16 a reštartom mal storefront 79 timeoutov čítania zo Saleoru
(`ProductDetails`, kategórie zahraničných trhov), po reštarte ani jeden. S datasetom to nesúvisí.

## 10 · Po otvorení 10 sád: Saleor, produktové stránky, prehliadač (13:32–13:40 UTC)

- Saleor, anonymne, dotaz storefrontu: **10 z 11 verejných a kúpiteľných, ceny = CFM**
  (329,90 · 439,85 · 414,90 · 469,80 · 489,80 · 489,80 · 314,85 · 424,90 · 434,85 · 584,85);
  **71743 skrytá**.
- maky.store: 10 produktových stránok 200 `index, follow` s cenou v JSON-LD, 71743 = 404 `noindex`.
- Konfigurátor na maky.store (headless Chromium 1440 px; jedna karta aj pri 390 px):

| výber                                               | ponuka                                                                                                                                              | očakávanie |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| BMW X5 E70 2012 · pozdĺžniky                        | 8 sád vrátane **WingBar EVO Silver**                                                                                                                | ✓          |
| BMW X5 E70 **2010** · pozdĺžniky (zlý rok)          | 7 sád Nordrive, Thule nie; produktová stránka: „Určené pre: BMW X5 E70 · 2011 – 2013 · SUV · Pozdĺžniky nad strechou“ + „Pozrieť nosiče pre X5 E70“ | ✓          |
| BMW X5 E70 2012 · **„Iný typ“** strechy             | 0 sád, „Pre toto vozidlo nemáme overenú zostavu“                                                                                                    | ✓          |
| Honda CR-V RM 2016 · **holá strecha** (zlá strecha) | 8 sád Nordrive, Thule nie; produktová stránka: „Určené pre: HONDA CR-V RM …“                                                                        | ✓          |
| Honda CR-V RM 2016 · integrované pozdĺžniky         | 3 sady vrátane **WingBar EVO Black**                                                                                                                | ✓          |
| Toyota Hilux AN120 **2025** (pred oknom)            | 0 sád, „Pre toto vozidlo nemáme overenú zostavu“                                                                                                    | ✓          |
| Toyota Hilux AN120 2026                             | 1 sada: **WingBar Edge Black**                                                                                                                      | ✓          |
| Opel Vivaro Van C 2020 · pevné body                 | 0 sád, „Kompatibilné zostavy … momentálne nie sú v predaji“ (71743 skrytá)                                                                          | ✓          |
| MAN TGE UY 2020 · pevné body                        | 1 sada: **SlideBar EVO Silver**, „Kompatibilné podľa aplikačných údajov THULE“, „Obsahuje: montážny kit, pätky, priečniky“                          | ✓          |

- **Konfigurátor → produkt → košík** pre BMW X5 E70 2012 (WingBar EVO) a MAN TGE 2020
  (SlideBar EVO): produktová stránka „Kompatibilné podľa údajov výrobcu“ → „Pridané do košíka.“ →
  `/sk/kosik`: 2 položky, 329,90 € + 584,85 € = **914,75 €**, doprava „Vypočíta sa v pokladni“.
  Riadok aktívneho auta: „Kompatibilné podľa údajov výrobcu · MAN TGE UY · 2020“, druhý riadok:
  „Ponuka pre BMW X5 E70 · Nosiče pre TGE UY“. Vznikol jeden anonymný checkout, objednávka ani
  platba nie.

Poznámky pre CFM (neblokujú):

- Pri zlom roku alebo streche produktová stránka nevypíše „nepasuje“, ukáže „Určené pre“ s
  rokmi a strechou sady a odkazom na nosiče pre auto zákazníka (návrh z kola 6). „Pridať do
  košíka“ ostáva aktívne.
- Pri Hilux 2025 znie hláška „Nejaké záznamy existujú, ale zatiaľ nie sú overené“. Presnejšie by
  bolo, že sada je určená pre iné roky. Je to text storefrontu, oprava patrí M.
- V názve aj SEO titulku produktu je „**Man** TGE UY“, značka v datasete a v selektore je „MAN“.
  (Príponu „| MAKY.STORE“ pridáva storefront iba vtedy, keď sa titulok s ňou zmestí do 65 znakov,
  preto ju X5 nemá. To je zámer, nie rozdiel v dátach.)
