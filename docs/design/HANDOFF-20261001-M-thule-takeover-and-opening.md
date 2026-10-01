# M → Marek, CFM · Prevzatie Thule (dataset `.2`) a príprava otvorenia ponuky

1. 10. 2026, ~20:30 UTC · vetva `claude/thule-open-r1-20261001` (release `release/r1-thule-20261001`) · podklad CFM: `fef56df4`
       (`CarFitManager-4`, vetva `claude/thule-c1-sk-publikacia`) · zadanie: `M_THULE_PREVZATIE_A_ZVEREJNENIE_20261001.md`.

**Nič z toho nebeží na produkcii.** Toto je výsledok kontrol a presný postup _pred_ prepnutím. Prepnutie datasetu, nasadenie
kódu a aktiváciu robí človek po samostatnom GO; skrytý import sa neopakuje, pilotné produkty sa nemenia.

---

## 0. Stav v jednej tabuľke

|                                        | stav                                                                                                                   | dôkaz                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Dataset `.2` prevzatý a overený        | **hotové**                                                                                                             | bajty, SHA-256 aj `datasetHash` prepočítaný naším validátorom = dodané; §1 |
| Beží na produkcii                      | **nie** — prod je `228590b` / `s939Ob_pi1tGplWJrjgeD` (28. 9., 19:45 UTC), dataset `3.0.0-full-20261001` (`fd3507de…`) | `MAKY_DEPLOY_META`, PM2                                                    |
| R0 (oprava obnovy datasetu, `b74f3ce`) | **nenasadený** (klasifikátor mi zamietol prepnutie stromu; nasadzuje človek)                                           | `git -C /opt/storefront log -1`                                            |
| R1 (minimum pre otvorenie ponuky)      | **pripravený, otestovaný lokálne**, nenasadený                                                                         | vetva, §6                                                                  |
| Skryté produkty sa nikomu neponúkajú   | **overené** na 9 140 / 9 140                                                                                           | §5                                                                         |
| Zákaznícky priechod na produkcii       | **neoverené** — môže sa až po prepnutí a po bloku 1; skript je hotový a vyskúšaný                                      | §9                                                                         |

## 1. Prevzatie datasetu `3.0.0-full-20261001.2`

|                      |                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| URL                  | `https://carfitmanager.com/media/fitment/maky_roof_fitment_3.0.0-full-20261001.2.json`                                                                       |
| bajty                | **15 915 111** — zhodné                                                                                                                                      |
| SHA-256 súboru       | `befb1cb5792a3cff2fdb9eb2215cbe27285450f363d5d297460b54e8b0f5e9f1` — zhodný (`sha256sum -c` s `SHA256SUMS_FULL_20261001.2`)                                  |
| `datasetHash`        | `394346c97009832300cd407159117a42c99cf23541202117bc986d3da7d333c9` — **prepočítaný naším validátorom z textu súboru**, nie prečítaný z poľa                  |
| schéma / verzia      | `3.0.0` / `3.0.0-full-20261001.2` · `saleorInstance` `api.maky.store`                                                                                        |
| obsah                | 70 značiek, 691 modelov, 1 108 generácií, 2 566 aplikácií, **18 314 produktov** (Nordrive 9 163 + Thule 9 151 = 9 140 nových + 10 pilotov + 71743)           |
| varovania validátora | **153** (predtým 96), obe doterajšie druhy: okno aplikácie končí po poslednom roku výroby generácie (151) alebo začína pred prvým (2); žiadna chyba          |
| `displayNames`       | 57 značiek, 38 modelov, 10 generácií; kľúč = jazyk (`sk`, `cs`, `de`…)                                                                                       |
| stará                | `generatedAt` 2026-10-01 17:48:14 UTC, `staleAfterDays` 30 ⇒ **zastará 2026-10-31 17:48 UTC**; nasadený `…20261001.json` zastará už **2026-10-30 11:07 UTC** |

Zmena oproti nasadenému datasetu (`dataset-delta.check.test.ts`, kód tohto buildu): +7 značiek, +130 modelov, +246 generácií, +1 453
aplikácií, 0 odobraných produktov, 0 zmenených Nordrive aplikácií, 10 pilotných aplikácií dostalo ďalšie sady (rovnaké okno a strecha).
Názvy a roky výroby sa nezmenili (zmenené polia: iba `displayNames` a `qualifiers`).

`full-dataset-acceptance.test.ts` je pripnutý na tieto čísla; starý súbor teraz padá 6 z 9 kontrol, nový prechádza 9/9
(`pnpm check:fitment` má predvolenú URL `.2`).

## 2. Čo beží teraz

- `228590b` / `s939Ob_pi1tGplWJrjgeD`, postavený 2026-09-28 19:45 UTC, nasadený 19:48.
- PM2 `maky-storefront`: **1 proces** (fork, `next-server` pid 2862589), od 30. 9. 13:15 UTC (7 reštartov). `maky-smtp-app` je samostatný
  proces a tento postup sa ho nedotýka.
- dataset z `.env`: `…/maky_roof_fitment_3.0.0-full-20261001.json` (`fd3507de…`).
- `next-server` drží po 30 h **2,73 GB RSS** (PM2 ukazuje 73 MB — to je len obal `npm`); `max_memory_restart` nie je nastavený.
- chyby: od základu z 30. 9. 19:51 UTC pribudlo za ~24,5 h **41 riadkov `NEXT_STATIC_GEN_BAILOUT`** (254 spolu, základ 213) a 34 683 riadkov
  chybového logu, väčšinou 96-riadkové bloky varovaní datasetu po každej obnove (~288 za deň); staršia obnova číta a validuje celý súbor každých 5 minút
  (s `.2` by to bolo 153 riadkov a ~0,5 s blokovania pri každej).

## 3. Výkon a stabilita (merané na produkčnom stroji; lokálne servery, produkčný Saleor len na čítanie)

**Studené načítanie 16 MB** — nameraná je každá fáza zvlášť (`dataset-perf.check.test.ts`, `measurements.json`):

| fáza                                             | nový (15,9 MB)                              | starý (8,0 MB) |
| ------------------------------------------------ | ------------------------------------------- | -------------- |
| sieť, CFM → tento stroj                          | **64 ms** (247 MB/s, bez kompresie)         | —              |
| čítanie + dekódovanie + SHA-256 súboru           | 5 + 7 + 8 ms                                | —              |
| `JSON.parse`                                     | 37 ms                                       | 24 ms          |
| `datasetHash` (vrátane kanonického JSON, 165 ms) | 420 ms                                      | 205 ms         |
| celá validácia vrátane hashu                     | **380–420 ms**                              | 190 ms         |
| z toho celé načítanie pri štarte procesu         | **501–527 ms**, blok event loopu 546–549 ms | 295 ms         |

Limit 5 s (`MAKY_FITMENT_TIMEOUT_MS`) je splnený s rezervou ~10×. **Zákaznícke vyhodnotenie auta** nad celým datasetom: medián **0,4 ms**,
p95 1,1 ms, p99 1,7 ms, najhoršie 4,6 ms (39 kandidátov) cez všetkých 2 192 výberov, ktoré selektor vie vyrobiť. Index nie je potrebný
a nezavádzal som ho: jeden prechod 2 566 aplikáciami je pod milisekundu. Pamäť: RSS lokálneho produkčného buildu po štarte ~250 MB, po záťaži 335–375 MB;
4-minútový test nižšie ukazuje 265 → 334 MB.

**Obnova pod záťažou** (`swap.mjs`): 3 súbežní klienti, 426 požiadaviek na `/sk/konfigurator`, zdroj sa dvakrát vymenil (16 → 8 → 16 MB):
**všetky 200**, p50 42 ms, p95 58 ms, najhoršia 560 ms; len 3 požiadavky počas samotnej výmeny boli nad 300 ms; konfigurátor ukazoval
celý čas rovnakých 8 sád. Nezmenený súbor (304) = 15–28 ms, bez parsovania.

**Súbeh a pamäť, starý provider verzus R0/R1** (TTL 2 s, 4 minúty, ~1 požiadavka/s): starý (`228590b`) mal **87 zablokovaní event loopu po
~470 ms** a RSS 111 → 694 → ~580 MB; R0/R1 mal RSS 265 → 334 MB a zablokovanie len pri skutočnej zmene datasetu.
V produkcii (TTL 300 s) by to s 16 MB súborom bolo ~470 ms každých 5 minút a trvalý tlak na pamäť. **Preto sa musí R0/R1 nasadiť PRED
prepnutím na `.2`.**

**NEXT_STATIC_GEN_BAILOUT (500) — nové zistenie, oprava R0 ho nelieči.** Reprodukované bez akejkoľvek obnovy datasetu:
čerstvý proces, ktorého `.next/cache` má _expirované_ záznamy, odpovie na **prvú** požiadavku `/sk` HTTP 500 (3× `NEXT_STATIC_GEN_BAILOUT`,
„Route "/[channel]": … uncached or runtime data during prerendering", spolu s „advice guide left out … 'use cache' called after prerender
ended"); regenerovaný shell sa uloží na disk a ďalšie štarty sú v poriadku. Videné na `228590b` (1 z 2 čerstvých štartov) aj na R0
(prvý štart); **čerstvo postavený strom 3/3 bez chyby**. Príčina je v domovskej stránke (cacheComponents, runtime prerender), nie vo fitmente.
Dôsledok pre postup: po každom `pm2 restart` hodiny po builde okamžite „zahriať" `/sk`, `/sk/stresne-nosice`, `/sk/konfigurator`
(§9, krok 2.4). R0 zostáva správny (pamäť, stalls, stale-if-error), ale **48 hodín sledovania je stále potrebné a 500 netvrdím za opravenú**.

**Sitemap** (§7): teplá 70–90 ms, 12 súbežných 0,38 s; studená po štarte ~5,8 s (deduplikované, všetkých 12 čaká na jednu prechádzku).

## 4. Uložené autá a správanie nových áut, kým sú sady skryté

- **55 840 výberov**, ktoré môže zákazník mať uložené (každá generácia × rok × strecha × karoséria z predošlého datasetu): **19 720 sa vyhodnotí
  úplne rovnako**, **v 36 120 pribudnú iba Thule sady** (výsledok Nordrive ostáva rovnaký), **0 sa vyhodnotí inak**, 0 sa nestane nerozpoznaným, 0 generácií
  zmizlo. Uložená garáž (cookie nesie len id) ostáva platná; názov sa berie z datasetu pri vykreslení.
- **82 generácií zmenilo `qualifiers`**: 75 dostalo novú voľbu strechy, 9 novú karosériu (2 obe). Selektor sa na strechu pýta vždy a nikdy ju
  nedosadzuje; nová voľba sa preto zákazníkovi len pridá a uložený výber ostáva s tým, čo má.
  (CFM píše o 84 — pri mojom prepočte je to 82/75/9; rozdiel treba vysvetliť na strane CFM.)
- **U 76 existujúcich modelov sa zmenilo 745 dvojíc (model, rok)**: 382 nových rokov, **274 z „jedna generácia" na „dve"** (napr. Dacia Duster
  2025–2027), 25 z „nič" na „dve", 14 má ďalšieho kandidáta, 50 bez zmeny druhu ⇒ selektor sa pýta, ktorá generácia. Nič sa nevyberá za zákazníka.
  Z toho **48 dvojíc generácií má rovnaké alebo vnorené roky výroby** (9 pred); zákazník ich nevie rozlíšiť a ide o duplicity
  v dátach CFM (napr. VW Transporter T6/SJ 2015–2024, T5/7E 2003–2015, ŠKODA Kamiq NW/NW4, Mitsubishi ASX GA/GA0, KIA Sportage QL/QLE, VW Touareg
  „2002-2018" ∥ 7L ∥ 7P). **Zoznam s id: `thule-takeover-20261001/generation-duplicates.csv` — pre CFM.**
- **383 nových vozidiel (7 značiek, 130 modelov, 246 generácií) nemá `urlPath`** ⇒ nie sú uzlom stromu, nemajú dlaždicu ani riadok v sitemape,
  žiadny mŕtvy odkaz. Ostanú len v konfigurátore (K1 a stránky áut neskôr). Výnimka: **Subaru Legacy BP** (2003–2009) sa vrátilo do datasetu
  s `urlPath` a publikovanou stránkou, no storefront ju 301-uje na BH (RELEASE-4 „retired"). R1 ju vynecháva zo sitemapy a z dlaždíc;
  **CFM musí rozhodnúť: BP je skutočné (zrušiť presmerovanie a doručiť obsah) alebo zrušené (odstrániť z datasetu).**
- Nové vozidlo v selektore, kým sú jeho sady skryté: konfigurátor povie **„Kompatibilné zostavy pre toto vozidlo existujú, ale momentálne nie sú
  v predaji."** (existujúce texty); kategória (polička) povie to isté vlastným panelom (R1); nikdy kupovateľná karta skrytého produktu, nikdy
  automatický návrat na celý katalóg. Overené na 28 prípadoch aj na troch typoch áut v prehliadači (§5, §6).
- `window` presahujúce roky výroby (57 nových varovaní): selektor ponúka len roky výroby generácie, takže sady pre rok za koncom generácie sa
  nedajú vybrať. Vec CFM (roky generácií, dataset v2).

## 5. Skryté produkty a 28 prípadov

- **9 140 id zo `HIDDEN_PRODUCTS_INDEX.csv` (37 blokov) → 92 anonymných dotazov na verejné Saleor API (kanál `sk-eur`): viditeľných 0.**
  PDP piatich skrytých slugov z bloku 1 = **404**; ani jeden z prvých 3 000 slugov v `sk-products-1.xml`; 71743 = 404.
- **Identita a varianty, nie len počty:** všetkých **9 140 riadkov `HIDDEN_PRODUCTS_INDEX.csv`** (id produktu, id variantu a `externalReference` z read-backu
  Saleoru, ktorý urobilo CFM) sa v datasete nachádza s **rovnakým id variantu aj rovnakou externou referenciou** (0 rozdielov, 0 chýbajúcich),
  všetky `roof-rack-set`, `accepted`, `sellable`, žiadny produkt s viac ako jedným riadkom aplikácie; 11 Thule produktov mimo indexu = 10 pilotov + 71743.
- **28 prípadov CFM** (`M_TEST_CASES.json`) cez náš `resolveVehicleOutcome`: **28/28 zhoda** v každom produkte, verdikte, podmienke aj `setOffered`.
  Je to ale len polovica vety CFM — „očakávaná odpoveď resolvera nie je očakávaná obchodná ponuka". Druhú polovicu som spravil cez HTTP proti
  lokálnemu buildu a živému Saleoru (každý prípad s podpísaným cookie): stránka ukazuje **presne tie sady, ktoré sú overené pre auto A ZÁROVEŇ
  verejné a predajné** — 28/28; kde nie je predajná žiadna, hovorí „nie sú v predaji" (prípady 8, 14, 18, 20, 21, 27, 28) a kde výber nie je úplný
  „nemáme overenú zostavu" (4, 9, 15, 23, 25, 26). Prípad 28 (Vivaro, podmienka skla): ponuka s podmienkou existuje v resolveri, produkt je skrytý,
  na stránke sa neobjaví.
- Neaplikovateľné kategórie: `foot_710800` (22, 24, 27) a čierne galérie sa nedajú ukázať, kým príslušné sady nie sú verejné (v bloku 1 nie je
  ani jedna pätka 710800); resolver ich ale vyhodnotil správne. Kategória „viac okien jednej sady" sa v datasete nevyskytuje (CFM to zistilo tiež).

## 6. R1 — minimum pre otvorenie ponuky (čo sa zmenilo pre zákazníka)

Vetva `claude/thule-open-r1-20261001` = R0 + R1, **38 zdrojových súborov + 12 jazykových súborov** oproti bežiacemu `228590b`
(zoznam: `git diff --stat 228590b..HEAD`). Nemení žiadnu URL, premennú prostredia, dotaz na Saleor, košík ani checkout.

1. **Rozsah filtra** — `config/fitment-shelves.ts` (slug → druh), oddelené od registra navigácie. Pribudli `thule-stresne-nosice` a
   `nordrive-stresne-nosice`; príslušenstvo/náhradné diely/montážne sady ostávajú mimo (ich produkt nikdy nie je v dataset sade). Registr
   navigácie, koreňové URL a proxy sa nezmenili (test).
2. **Dva explicitné režimy a viditeľný prepínač** — `?vehicle=1` „Pre moje auto", `?vehicle=0` „Všetky vozidlá" (nikdy sa neprepisuje);
   bez parametra sa na polici strešných nosičov s uloženým autom ukáže jeho zoznam **len ak niečo obsahuje**; auto bez overenej sady alebo
   dataset, ktorý nevie odpovedať, nechá policu celú a povie prečo. `/products` a kolekcie sa zužujú len na požiadanie. Prepínač je dvojstranný,
   aktívna strana farebne (zelená / hnedá) a `aria-current`. Zmena auta zachová značku, zoradenie aj cenu. Počty celej police sa pri zúženom
   zozname z bočného panela skryjú (dve sumy na jednej obrazovke sú chyba).
3. **Sady existujú, ale nie sú v predaji** — nový stav `not-on-sale` (po prečítaní zoznamu, len ak nič iné zoznam nezúžilo) a rovnaká veta
   na stránke generácie.
4. **Typ strechy a roky na kartách** — z aplikácie sady (`qualifiers.roofTypes`, `window`), nikdy z názvu a nikdy z rokov výroby generácie;
   karta v zozname, v konfigurátore aj na stránke generácie. Stránka generácie už nepíše „Kompatibilné zostavy" (neznamená nič pre
   konkrétne auto), píše „Zostavy pre túto generáciu", vysvetľuje, že každá platí len pre uvedenú strechu a roky, a **zoskupuje podľa strechy**
   (medián 14 sád, p95 37, najviac 104; 36 stránok nad 40). Karta nikdy netvrdí „pasuje".
5. **`displayNames`** s jazykovým kľúčom a návratom na `name` — selektor, garáž, produkt, riadok košíka, zoznam vozidiel; nikde inde a žiadna
   druhá tabuľka. V selektore: „Porsche", „Chery" namiesto „PORSCHE"; BMW „Rad 3 Touring" namiesto „3 Series Touring". Ostanú veľkými:
   DFSK, MINI, SEAT, XPENG (tak ich CFM dal).
6. **`GET /api/fitment/status`** — čo drží _bežiaci proces_ (§9). Verejne len blok `dataset`; s tajomstvom aj proces a build.
7. **Zrušené stránky nie sú adresy** — sitemapa a dlaždice vynechávajú stránku, ktorú proxy presmerováva (Legacy BP).

12 jazykov, parita 12/12; 12 nových kľúčov (`fitment.card*`, `fitment.listing*`, `catalog.offers*`).
Testy: **3 374 prešlo / 38 preskočených / 0 zlyhalo** (R0: 3 268), lint 0 chýb, `tsc` bez chýb, build čistý (lokálny, dataset sa pri builde nenačíta), `check:css` OK.

**Zoznam kategórie = konfigurátor:** pre všetkých 28 áut je zoznam police s `?vehicle=1` (všetky stránky) **zhodný s konfigurátorom v názvoch aj v počte** (28/28),
čo je „po explicitnom výbere sa výsledok zhoduje s konfigurátorom". Obe čerpajú z toho istého `resolveVehicleOutcome` a z toho istého prieniku so Saleorom.

Overené v prehliadači (lokálny produkčný build, živý Saleor, nový dataset), 1440 / 390 / 360 / 320 px, **bez horizontálneho pretekania**:
BMW X5 E70 2012 → police sa predvolene zúži na jeho 8 predajných sád, `?vehicle=0` ukáže 9 167; Honda Civic Sedan FD (iba skryté Thule) → panel
„existujú kompatibilné zostavy…"; Fiat Grande Panda (nič overené) → „preto vidíte ponuku pre všetky vozidlá"; bez auta → výber auta a 10 pilotov;
stránka generácie CR-V RM → skupiny „Integrované pozdĺžniky 3" a „Holá strecha 8". Snímky: `/home/ubuntu/maky-thule-takeover-20261001/screenshots/`.

**Rozhodnutia, ktoré nie sú moje (opisujem ich, nemenil som ich):**

- predvolené „Pre moje auto" na polici je zmena správania pre každého s uloženým autom — alternatíva je zúžiť len na požiadanie (jedna podmienka);
- **slovník strechy**: selektor hovorí „Pozdĺžniky nad strechou / Integrované pozdĺžniky / Holá strecha / Pevné body", názvy produktov a úvody od CFM
  „klasické lyžiny / integrované lyžiny / hladká strecha / fixačné body". Na jednej karte stoja vedľa seba obe. Karta preberá slová selektora;
  zladiť ich je zmena textu v 12 jazykoch.

## 7. Cache, sitemapa a invalidácia po aktivácii a po stiahnutí

Aktivácia v Saleore **nevolá webhook** (v logu 0× `[Revalidate]`), preto všetko čaká na TTL:

| povrch                                        | zdroj                                                                          | najneskôr                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| ponuky v konfigurátore a na stránke generácie | `fetch` `revalidate: 300`, tag `fitment-offers:{channel}:{locale}`             | 5 min                                                        |
| zoznam kategórie / polička                    | `revalidate: 300`, `"use cache"` kategórie                                     | 5 min                                                        |
| produktová stránka                            | `use cache` „minutes", + brána existencie 60 s (neexistuje) / 300 s (existuje) | ~1–6 min                                                     |
| sitemapa (obe `sk-pages/products/vehicles`)   | prechádzka Saleora `revalidate: 3600`, tag `sitemap:{channel}`                 | **60 min**                                                   |
| skorý test po bloku 1                         |                                                                                | **čakať ≥ 6 min po poslednej mutácii bloku, alebo vyčistiť** |

Sitemapa: dnes 9 581 SK produktových adries (10 Thule piloty), po plnej aktivácii ~18 700 (4,4 MB); skryté produkty tam nie sú a nebudú (Saleor ich
anonymnému dotazu nevráti). Vozidlové adresy: 1 475 (s R1; bez Legacy BP). CFM tvrdí, že sa generuje pri každej požiadavke — **nie**: dátová vrstva
je cachovaná (tag, 3 600 s) a súbežné žiadosti sa spájajú do jednej prechádzky; teplá odpoveď 70–90 ms (12 súbežných 0,38 s, zahraničné
trhy 0,65 s). Pomalá je len **studená** (po štarte/builde ~5,8 s teraz, ~12 s pri 18 700 produktoch), raz. Iné cache som nezaviedol — žiadna nie je
potrebná a každá by pridala ďalšiu vec, ktorú treba invalidovať pri stiahnutí.

**HTML sa medzi návštevníkmi necachuje** (CFM to žiadalo overiť): police aj konfigurátor odpovedajú `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`
a `cf-cache-status: DYNAMIC` — na produkcii aj na lokálnom builde; zoznam podľa auta (predvolený alebo `?vehicle=`) je v dynamickej časti stránky a statický shell nenesie garáž.
Sitemapa a jej shardy garáž nečítajú vôbec.

**Ručné vyčistenie** (overené len na lokálnom serveri; na produkcii ho spustí človek, mení iba cache):

```bash
for c in stresne-nosice thule-stresne-nosice nordrive-stresne-nosice; do
  curl -sS -X POST https://maky.store/api/revalidate \
    -H "x-revalidate-secret: $(grep '^REVALIDATE_SECRET=' /opt/storefront/.env | cut -d= -f2-)" \
    -H 'content-type: application/json' -d "{\"product\":{\"channel\":\"sk-eur\",\"category\":{\"slug\":\"$c\"}}}"; echo
done
```

Odpoveď vymenuje vyčistené tagy (`category:…`, `fitment-offers:sk-eur:sk-SK`, `sitemap:sk-eur`) a cesty. Zlé tajomstvo = 401. Po vyčistení sitemapy je prvá žiadosť
studená (~6 s teraz, ~12 s po plnej aktivácii) — jednu ju raz zavolať, aby ju nezačal prvý crawler. **Po stiahnutí** produktu platí to isté:
Saleor ho vráti z dotazov okamžite, ale stránky a sitemapa ho ukazujú až do TTL, ak sa nevyčistia.

## 8. Úvody stránok áut (CFM: 160 kandidátov)

Zmeral som skutočne vykresľovaný text slovenských generačných stránok (`top` + `body`, tak ako ich skladá `splitContent`). 489 stránok má vetu s „všetky/
výhradne/určené na" a slovom pre jednu strechu; **56 z nich** po prepnutí dostane strechu, ktorú veta nespomína (**po prepnutí 158 stránok mieša strechy,
pred ním 92 — rovnako ako počíta CFM**). Zoznam s vetou, stránkou a strechami pred/po: `thule-takeover-20261001/intro-conflicts-sk.csv` — **dohľadané
detektorom (veta o ponuke + výlučné slovo + slovo strechy), nie ľudským čítaním; CFM ich potvrdí a opraví cieleným zásahom do obsahu.** Päť ďalších
nálezov je falošných (veta uvádza obe strechy). Prepnutie samotného datasetu texty neopraví.

## 9. Presný postup

Pravidlá: každý krok je jeden príkaz zadaný priamo (CLAUDE.md §13.1.1), nasadzuje človek, ja potom kontrolujem len čítaním.

### 9.1 Nasadenie kódu R0+R1 (starý dataset ostáva) — kedykoľvek pred sedením

```bash
cd /opt/storefront && git fetch origin && git checkout --detach origin/release/r1-thule-20261001
```

```bash
cd /opt/storefront && ./scripts/ops/deploy-production.sh --dry-run -m "R0+R1: fitment provider SWR, car filter on the Thule shelf, roof and years on cards (release/r1-thule-20261001)"
```

```bash
cd /opt/storefront && ./scripts/ops/deploy-production.sh -m "R0+R1: fitment provider SWR, car filter on the Thule shelf, roof and years on cards (release/r1-thule-20261001)"
```

Odstávka 2–5 min. Ak preflight nahlási pamäť: `MIN_FREE_MEM_MB=9216 ./scripts/ops/deploy-production.sh -m "…"` (odporúčané už skôr, k dispozícii ~10,9 GB).
**Vrátenie:** skript pred bránou sám obnoví predošlý build; po nej `sudo cp -a /opt/storefront-rollbacks/<snapshot> .next` podľa CLAUDE.md §13.3.
Po nasadení (ja, len čítanie): `MAKY_DEPLOY_META` (sha, BUILD_ID), riadok `[fitment] loaded 3.0.0-full-20261001 fd3507de…` v OUT logu, nové
`NEXT_STATIC_GEN_BAILOUT` oproti základu 254 / 1 163 315 riadkov, §13.5 smoke, `/api/fitment/status` (stále `fd3507de…`), uložené BMW → 8 sád.

### 9.2 Prepnutie datasetu — jedna krátka medzera pred aktiváciou

1. Zálohovať a prepnúť jediný zdroj:

```bash
cd /opt/storefront && cp -p .env .env.backup-$(date -u +%Y%m%dT%H%M%SZ)
```

```bash
cd /opt/storefront && sed -i 's#^MAKY_FITMENT_URL=.*#MAKY_FITMENT_URL=https://carfitmanager.com/media/fitment/maky_roof_fitment_3.0.0-full-20261001.2.json#' .env
```

2. Reštartovať **len** storefront (nie `maky-smtp-app`):

```bash
pm2 restart maky-storefront
```

3. **Okamžite zahriať** (§3, stale-cache štart môže prvú žiadosť 500-ovať; ďalšie už nie):

```bash
for p in /sk /sk/stresne-nosice /sk/konfigurator /sk/categories/thule-stresne-nosice; do curl -sS -o /dev/null -w "$p %{http_code}\n" https://maky.store$p; done
```

4. **Potvrdenie datasetu z bežiaceho procesu** (nie z `.env`, nie zo súboru):

```bash
curl -sS https://maky.store/api/fitment/status
```

Musí mať `"loaded": true`, `"datasetVersion": "3.0.0-full-20261001.2"`,
`"datasetHash": "394346c97009832300cd407159117a42c99cf23541202117bc986d3da7d333c9"`, `"transportSha256": "befb1cb5792a3cff2fdb9eb2215cbe27285450f363d5d297460b54e8b0f5e9f1"`,
`"bytes": 15915111`, `"stale": false`, `"lastCheck.outcome": "new"`. S tajomstvom (`Authorization: Bearer …`) pribudne `process.pid`, `uptimeSeconds`, `build.buildId`,
`build.gitSha` — to je „zoznam obsluhujúcich procesov": PM2 má jeden, jeho pid musí sedieť. Riadok logu: `[fitment] loaded 3.0.0-full-20261001.2 394346c9… (15915111 B, ~530 ms)`.
**Tento výstup + commit/BUILD_ID pošle M CFM ako potvrdenie datasetHash.** 5. Vrátenie datasetu: skopírovať `.env.backup-…` späť + `pm2 restart maky-storefront` + zahriať. (Starý súbor `…20261001.json` zastará 30. 10. 11:07 UTC.)

### 9.3 Aktivácia bloku 1 → skorý zákaznícky test → ostatné bloky

0. Tesne pred aktiváciou nasnímať východiskový stav (musí byť 81/81, §10):

```bash
node scripts/checks/thule-early-test.mjs --base https://maky.store --cases docs/design/thule-takeover-20261001/block1-cases.json --cookies <block1-cookies.json> --phase pre
```

`<block1-cookies.json>` robí `M_CASES=docs/design/thule-takeover-20261001/block1-cases.json M_CASES_DATASET=<dataset .2> M_CASES_OUT=<block1-cookies.json> MAKY_GARAGE_COOKIE_SECRET=… npx vitest run src/lib/fitment/thule-cases.check.test.ts`
(tajomstvo z prostredia, nikde sa nevypisuje; cookie len vyberú auto — nepatria do repozitára).

1. CFM (po samostatnom GO Mareka) spustí aktiváciu; po 250 sadách sa zastaví.
2. **Čakať ≥ 6 minút** po poslednej mutácii bloku (alebo spustiť ručné vyčistenie z §7).
3. Skorý test (len čítanie, nič nevytvára):

```bash
node scripts/checks/thule-early-test.mjs --base https://maky.store --cases docs/design/thule-takeover-20261001/block1-cases.json --cookies <block1-cookies.json> --phase post --out early-post.json
```

12 prípadov „musí ukázať" a 21 „nesmie ukázať" (rok mimo okna / iná strecha / žiadna strecha), pre každý: produktová stránka (200, cena JSON-LD = cena CFM, `index, follow`,
kanonická na seba), konfigurátor (karta je, cena CFM, strecha a roky), polica Thule s autom (je v predvolenom zozname), stránka generácie (ak existuje); okolo: piloty
200, 71743 404, vzorka 60 sád zo zvyšných blokov stále neviditeľná. Ručne k tomu: mobil 390 px, jeden prechod konfigurátor → produkt → košík (**košík je zápis do Saleoru —
jeden anonymný checkout ako 30. 9.; objednávku ani platbu nevytvárať**) a regresia Nordrive (uložené BMW → tých istých 7 Nordrive). 4. Marek potvrdí → CFM nastaví `EARLY_TEST_OK=1` → ostatné bloky. Počas behu nemeniť vozidlá, fity, ceny ani obsah (CFM aj M). 5. Po poslednom bloku: ručné vyčistenie (§7), jedna studená žiadosť na `sk-products-1.xml`, kontrola sitemapy (~18 700) a sledovanie `NEXT_STATIC_GEN_BAILOUT` / chybového logu 48 h.

Otestované: `pre` na skutočnom bloku 1 = **81/81**; `post` na 10 skutočne verejných pilotoch = **114/114**; `pre` na tých istých pilotoch **padá** (30), takže skript vie zlyhať.

## 10. Čo ostáva a kto

|                                                                                                                       | kto               |
| --------------------------------------------------------------------------------------------------------------------- | ----------------- |
| GO na nasadenie R0+R1 (§9.1) a neskôr na prepnutie (§9.2)                                                             | Marek             |
| predvolené „Pre moje auto" áno/nie; slovník strechy                                                                   | Marek             |
| Subaru Legacy BP: skutočné či zrušené (id `veh:gn:7860f324-9fb5-4369-a759-11c05af7c0b4`)                              | CFM               |
| 48 dvojíc generácií s rovnakými/vnorenými rokmi (`generation-duplicates.csv`)                                         | CFM               |
| 56 úvodov (`intro-conflicts-sk.csv`) — potvrdiť a opraviť pred/pri aktivácii                                          | CFM               |
| rozdiel 82 vs 84 zmenených generácií                                                                                  | CFM               |
| zvyšné roky generácií za koncom výroby (57 nových varovaní), `urlPath` pre 383 áut, dataset v2 s `barFamily`/`setKey` | CFM (po otvorení) |
| 48 h sledovanie 500; domovská stránka a studený štart                                                                 | M                 |
| polica `/products` a kolekcie nepoznajú stav „nie sú v predaji" (iba explicitné `?vehicle=1`)                         | M, nízka priorita |
| skúšky po prepnutí: skorý test §9.3                                                                                   | M + CFM           |

**Neoverené (a prečo):** nič z produkcie (nič nenasadené); košík/checkout nového kódu (zápis do Saleoru — urobí sa v skorom teste); vyhodnotenie
presklenej strechy (mimo rozsahu, 71743 ostáva skrytá); zahraničné trhy (Thule tam nemá ceny ani preklady; R1 platí vo všetkých 12 jazykoch, sady sú len v SK);
účinok R0 na 500 (nenasadený); `/api/revalidate` na produkcii (overený len lokálne).

Dôkazy a opakovateľné kontroly: `docs/design/thule-takeover-20261001/` (zoznamy), `/home/ubuntu/maky-thule-takeover-20261001/` (správy, snímky),
testy `dataset-perf`, `thule-cases`, `dataset-delta`, `new-dataset` (`*.check.test.ts`, preskočené bez ciest k súborom) a `scripts/checks/thule-early-test.mjs`.
