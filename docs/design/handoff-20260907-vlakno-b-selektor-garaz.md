# Vlákno B — selektor, Garáž a prijatie pilota 3.0.0

Vytvorené 2026-09-07. **Vlož §14 ako prvú správu do nového vlákna.** Tento dokument je
self-contained: čítajúci nepotrebuje predchádzajúce vlákna ani nič doplnkové okrem toho,
čo mu Marek dodá z CFM vlákna. Odpovedaj po slovensky.

---

## 0. Prvé tri vety

Si **vlákno B** storefrontu MAKY.STORE: výber vozidla, Garáž, konfigurátor strešných
nosičov, pravdivá komunikácia kompatibility. Vlákno A (katalóg, lokalizácia, SEO, košík)
je **nasadené**; do jeho vetiev, do `/opt/storefront` ani do produkcie nesiahaj.

Kontrakt **3.0.0** je hotový, otestovaný a pushnutý. Zostávajú tri veci v tomto poradí:
**B0 hardening** (päť dier, ktoré som sám potvrdil v kóde), **selektor + Garáž**, a
**prijatie reálneho pilota cez HTTP**.

**Nezačínaj odznova.** Uzavreté rozhodnutia sú v §4 a §5. Neotváraj ich.

---

## 1. Presný stav

|                     |                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------- |
| vetva B             | `claude/sf-b-vehicles-integration-b697ce`, tip `de30cc8` — **over cez `git ls-remote`** |
| jadro kontraktu     | `9340ffc` (typy + validátor + brána), `de30cc8` (pilotné testy + JSON Schema)           |
| základ              | `27b7088` = produkcia (Lane A, BUILD_ID `EeqdrEsFOEh2OMnTDHF03`)                        |
| worktree            | `/opt/storefront/.claude/worktrees/sf-b-vehicles-integration-b697ce`                    |
| nasadené z B        | **nič** — branch-only                                                                   |
| Saleor              | Core 3.23.31, `https://api.maky.store/graphql/`, kanál `sk-eur`                         |
| katalóg `sk-eur`    | 9 606 verejných; kategória Nordrive 9 192                                               |
| brány nad `de30cc8` | tsc 0 · lint 0 errors (6 pre-existujúcich warningov) · i18n 12/12 · **1 462 testov**    |

Predchádzajúce handoffy v repe (kontext, nie úlohy): `lane-b-integration-20260906.md`,
`handoff-20260906-vlakno-b-dokoncenie.md`, `lane-a-contracts-for-lane-b.md`,
`zadanie-cfm-fitment-export-20260906.md`.

Ak je vetva novšia než `de30cc8`, **nič neresetuj** — vypíš rozdiel a pokračuj z novšieho.

---

## 2. Čo je hotové

### 2.1 Integrácia do plôch A (`591bcbf`, `d4fc2b1`, `68d2b6d`, `89ae834`)

- **Header + hero**: mŕtve tlačidlá A sú preč. `ActiveVehicleLauncher` je server komponent,
  ktorý číta garáž a dataset a **nerenderuje nič**, keď funkcia nemôže konať. Nový
  `compact` variant — pod `lg` nebol výber vozidla dostupný **nikde**.
- **PDP**: `PdpCompatibility` pri CTA (mimo `<form>`) + `PdpVehicleApplications`.
  Brána `datasetSpeaksForProduct` — bez riadku v datasete surface mlčí.
- **PLP**: tri call sites, cesta CFM → Saleor ID → `filter:{ids}`, len na `?vehicle=1`.
- **Lokalizácia** na dátovej hranici + rozšírená projekcia dotazu (`1059af9`).
- **„Skontrolovať košík"** po neistom pridaní (`4d29e18`).

### 2.2 Kontrakt 3.0.0 (`9340ffc`, `de30cc8`)

- `SUPPORTED_SCHEMA_VERSIONS = ["3.0.0"]` — **presná zhoda**. `3.1.0` sa odmietne rovnako
  ako `2.0.0`.
- `matchWindow` — inkluzívny na oboch koncoch, **tri** hodnoty (`in` / `out` /
  `needs-detail`). 13 golden testov v `window.test.ts`.
- `FitmentApplication.window` nahradilo `yearFrom`/`yearTo`.
  `verificationStatus` na aplikácii **zaniklo**; `evidence` / `qaStatus` / `verification` /
  `eligibility` sú **na produkte**.
- `pickWorstRef` — produkt dosiahnuteľný cez viac riadkov sa posudzuje podľa najhoršieho.
- Nové verdikty `MANUFACTURER_FIT` a `NEEDS_DETAIL`.
- `isFitmentOfferable` — jedna funkcia, volaná v `resolveVehicleOutcome` aj v serverovej
  bráne košíka. Chýbajúci `eligibility` = odmietnutie.
- `docs/design/fitment-schema-3.0.0.json` — validátor v strojovom tvare pre CFM.
  SHA-256 súboru: `3f3253caa7b99e5b55a8863071e9692eafa3fd3948bdacc8117d3d159508083d`.
- `pilot.test.ts` — 9 testov nad dvoma **skutočnými** aplikáciami z pilota.

---

## 3. Overené fakty o živých dátach — neodvodzuj ich znova

Merané mnou proti `api.maky.store`, iba čítanie:

- **Pilot je na strane identít čistý** (2026-09-06): všetkých **77/77** produktov existuje
  v `sk-eur`, **77/77** `isAvailableForPurchase`, **77/77** má `externalReference` tvaru
  `cfm:product:CFMP-B-NOR-*` zhodné s katalógom, **77/77** variantov sa vyriešilo. Počty
  77 / 14 held / 63 predajných sedia s `accounting` v súbore.
- **`filter: { ids: [] }` vracia CELÝ katalóg (9 606), nie 0.** Prázdna množina sa nikdy
  nesmie dostať do dotazu; náhrada je `UHJvZHVjdDotMQ==` (`Product:-1`) → `totalCount: 0`.
- **`first: 100` je strop STRÁNKY, nie filtra.** 250 ID → `totalCount: 250`, korektná
  paginácia. Kandidátov netreba sekať.
- **Neplatné ID zhodí celý dotaz** (`Invalid ID specified.`) a `/{market}/products` na
  zlyhaný listing hádže. ID sa validujú ako base64 `Product:<pk>` pred odoslaním.
- **Nordrive kohorta nemá ŽIADNY atribút** — 0/300 vo vzorke, kým starší katalóg má 60/60
  vrátane `manufacturer`. Nie je to limit Saleoru. (Rieši CFM, nie ty.)
- **Náhľady**: pri `size=1024` je z 500 produktov 405 z `cdn.maky.store` a 95 z
  `api.maky.store/thumbnail/`. Retry v `ResilientProductImage` sa týka **iba** druhých.
- **8 atribútových slugov `vehicle-*` / `roof-type` / `bar-*` v Saleore NEEXISTUJE** —
  filter na ne vracia `totalCount: 0`, nie chybu. Vehicle filter cez Saleor atribúty
  nikdy nezapájaj.
- **React #418** (hydration mismatch) je na každej stránke aj na živej produkcii.

---

## 4. Uzavreté rozhodnutia — neotváraj

| pravidlo                                                             | prečo                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| kontrakt je **3.0.0** s presnou zhodou verzie, nie `2.1`             | validátor prijímal ľubovoľné `2.x` a neznáme polia ignoroval → mesiace by sa ticho zahodili |
| **neznámy mesiac na strane OKNA berie celý hraničný rok**            | zdroj povedal rok a priznal, že mesiac nevie; zúžiť to je náš výmysel                       |
| mesiace sú **voliteľné** a musia také zostať                         | nie každý výrobca ich uvádza; už dnes je 38 aplikácií so `startPrecision: "year"`           |
| `NEEDS_DETAIL` nie je FIT ani NO_FIT                                 | je to otázka, ktorú sme sa nespýtali                                                        |
| `MANUFACTURER_FIT` je **ponúknuteľný**, zelený, a menuje dodávateľa  | je to fit na výrobcovom slove; `derived` riadok si tú vetu požičať nesmie                   |
| `cfm-verified` zostáva voľné                                         | dnes nič v katalógu nie je nezávisle overené                                                |
| dôkaz a stav sú **na produkte**, nie na aplikácii                    | 47 podozrivých mapovaní sedí vnútri inak čistých aplikácií                                  |
| držaný riadok = **„nevieme potvrdiť"**, nikdy „vaše auto je zlé"     | je to naša neistota o mapovaní, nie fakt o zákazníkovom aute                                |
| chýbajúci `eligibility` = odmietnutie                                | chyba exportéra sa nesmie stať príležitosťou predať                                         |
| `unconfirmed` add → neutrálny `role="status"` + „Skontrolovať košík" | `checkoutLinesAdd` nie je idempotentný                                                      |
| demo dataset nikdy nezužuje listing reálnych produktov               | jeho ID nepomenúvajú nič reálne                                                             |
| `completeForMakeIds: []` na pilote                                   | jediné, čo dovolí premeniť chýbajúci riadok na „nepasuje"                                   |
| SEO routy značka/model/generácia **nie sú** podmienkou pilota        | prídu nad tým istým resolverom                                                              |
| `10e19ac` (SKU leak) rieši **vlákno A**, nie ty                      | je na `claude/sf-a-jsonld-sku-fix`; nemiešaj línie                                          |

---

## 5. B0 — povinný hardening PRED pripojením reálnych dát

**Päť dier, každú som potvrdil v kóde 2026-09-07.** Sú to moje chyby, nie hypotézy.

### B0.1 `datasetHash` sa neprepočítava

`validate.ts:232` ho kontroluje len ako neprázdny reťazec. Dataset s vymysleným hashom
prejde. Implementuj skutočný prepočet podľa **CFM konvencie**:

```
SHA-256( UTF-8 kanonický JSON, zoradené kľúče, kompaktné oddeľovače (",", ":"),
         ensure_ascii = false,
         po odstránení top-level  datasetHash  AJ  generatedAt )
```

`generatedAt` je vynechaný zámerne, aby prestavba z nezmenených dát dala rozpoznateľne
ten istý dataset. Pri nezhode **odmietni celý dataset**, nevaruj.

⚠️ Toto je **sémantický** hash. SHA-256 presných bajtov súboru je **iné číslo** a je to
transportný checksum. Nikdy ich nezamieňaj — CFM hlási oba.

### B0.2 `pilot-sample.json` nesie cudzí hash

Moja chyba: dvojriadková ukážka nesie `bca2997617ae0cf9…`, čo je hash **celého**
77-produktového pilota. Po B0.1 by test okamžite padol. Buď jej daj vlastný
`datasetVersion` a správny prepočítaný hash, alebo commitni celý pilot.

### B0.3 Konfigurátor tvrdí „Overené" o výrobcovom slove

`configurator-results.tsx:170` renderuje `cardVerifiedFit` („Overené pre vaše vozidlo")
pre **každú** kartu z `outcome.verified` — a ten teraz obsahuje aj `MANUFACTURER_FIT`.
Slovo „overené" smie použiť **iba** `VERIFIED_FIT`. Karta musí niesť
„Kompatibilné podľa aplikačných údajov {supplier}", rovnako ako `CompatibilityBox`.
Platí to pre konfigurátor, PDP aj vetvu s montážnou podmienkou.

### B0.4 Dataset so `source.system: "fixture"` sa dá predať

`isDemoDataset` (`offers.ts:149`) pozerá **iba** na `demoCatalogue`. `provider.ts`
`statusFor` už vie, že `source.system === "fixture"` je demo — ale offer layer ani
košík to nečítajú. HTTP payload s `system: "fixture"` a bez `demoCatalogue` by sa predal.
Zjednoť to na jedno miesto.

### B0.5 Kontrola okna proti výrobe generácie je mŕtvy kód

`validate.ts:436` stále číta `app.yearFrom`, ktoré v 3.0.0 neexistuje. `as number` na
`undefined` dá `NaN`, porovnanie je vždy `false`, warning sa **nikdy nevystrelí**.
Prepíš na `window.from` / `window.to`.

### B0.6 HTTP provider nemá testy

Doplň aspoň: úspech, timeout, non-2xx, neplatný JSON, nezhoda schémy, nezhoda hashu,
nezhoda Saleor inštancie. Každý musí skončiť „provider nedostupný", nikdy pádom stránky.

---

## 6. Selektor — `značka → model → ROK`

### 6.1 Diera, ktorú som dokázal

Dnešný selektor je `značka → model → generácia → rok`. Horšie: `askableQualifiers`
(`selector-actions.ts:33`) zahodí **jednoprvkový** qualifier ako „netreba sa pýtať",
sheet potom neuloží nič, a resolver dostane `undefined`. Izolovaný dôkaz — generácia
s jedným typom strechy a **verified** aplikáciou:

```
selector output (no roofType asked) -> AMBIGUOUS (qualifier-not-answered)
roof confirmed                      -> VERIFIED_FIT (verified)
```

Nič sa nedosadzuje, takže to **nie je** bezpečnostná diera — je to **funkčná**: pri takej
generácii konfigurátor neponúkne nikdy nič. Pri reálnych dátach to bude časté.

### 6.2 Cieľový tok

```
značka → model → ROK VÝROBY
       → generáciu DOPOČÍTAŤ, keď je jednoznačná
       → karoséria/vyhotovenie LEN pri nejednoznačnosti
       → mesiac LEN na hraničnom roku a LEN keď ho okno pozná
       → typ strechy VŽDY vizuálne potvrdiť
```

Zákazník nemá poznať „B9" ani „939" — rok pozná z technického preukazu. Generácia je náš
technický údaj, nie jeho.

**Automaticky preskočiť smieš otázku, ktorá je skutočne vyriešená — nie otázku, na ktorú
máme náhodou jedinú odpoveď.** To sú dve rôzne veci a je to jadro tej diery.

### 6.3 Strecha

Vždy, aj pri jedinej hodnote. Pri jednej možnosti stačí jedna karta s obrázkom:

> Má vaše vozidlo tento typ strechy? **Áno · Iný typ · Neviem rozpoznať**

„Iný typ" ani „Neviem" sa **nesmú** skonvertovať na jedinú známu strechu. „Neviem
rozpoznať" otvorí pomoc s identifikáciou, nie automatický výber.

### 6.4 Mesiac

- Pýtaj sa **len keď ho okno pozná** (`startPrecision`/`endPrecision === "month"`) a
  zákazníkov rok sedí na tej hranici. Pri `startPrecision: "year"` mesiac nič nerozhodne.
- Keď sa pýtaš a zákazník nevie → `NEEDS_DETAIL`. Nie FIT, nie NO_FIT.
- **Mesiac prvej registrácie nie je mesiac výroby.** Pýtaj sa na výrobu a povedz to.

### 6.5 Generácia pri prekryve

Keď rok pripadá na viac generácií, spýtaj sa na **zrozumiteľný** rozlišovač (karoséria,
obdobie, ideálne fotka) — nikdy nevezmi prvý výsledok a nikdy neukáž holý kód.

---

## 7. Garáž v2

- Payload `v2` s **voliteľným** mesiacom výroby (1–12).
- Ukladá stabilné `veh:*` identity z datasetu a **potvrdené** kvalifikátory.
- **Nikdy** databázové kľúče a **nikdy** trvalý príznak `compatible`. Kompatibilita sa
  vyhodnocuje nanovo voči aktuálnemu datasetu pri každom použití.
- `v1` cookie sa musí dať spätne načítať a zmigrovať. B nie je nasadené, takže reálnych
  používateľov niet — ale ja aj ty máme v prehliadači v1 cookie z testov.
- Otvorenie vozidlovej stránky **neprepíše** aktívne vozidlo. Stránka dá kontext;
  potvrdzuje používateľ.

Dnešný payload (`cookie.ts:45`): `k`/`m`/`g` = ID z datasetu, `y` rok, `r`/`b`/`d`
kvalifikátory, `v` verzia, `dv` verzia datasetu, `a` aktívny index.

---

## 8. Prijatie pilota cez HTTP

Provider **súbor priamo nečíta** — `loadHttp` robí `fetch(url)`. Konfigurácia:

```
MAKY_FITMENT_PROVIDER=off|fixture|http     NEUVEDENÉ = OFF = funkcia mlčí
MAKY_FITMENT_URL=            iba pre http
MAKY_FITMENT_TOKEN=          server-only
MAKY_FITMENT_TIMEOUT_MS=5000
MAKY_FITMENT_REVALIDATE_SECONDS=300
MAKY_GARAGE_COOKIE_SECRET=   BEZ NEHO JE GARÁŽ V PRODUKCII VYPNUTÁ (a povie to); ≥ 32 znakov
```

V produkčnom `.env` nie je nič z toho. B premenné dávaj **na príkazový riadok**
`next start`.

Po prijatí: over presné bajty, veľkosť, transportný SHA-256 **aj** prepočítaný sémantický
`datasetHash`. Až potom `PROVIDER_CONNECTED = YES`.

---

## 9. Pasce

1. **Python `str.replace` na zdrojáku ticho neurobí nič**, keď sa nezhoduje odsadenie.
   Takto sa `compact` variant dostal do produkčného buildu **bez štýlov** — tsc, lint,
   1 400 testov aj build zelené, našiel to až screenshot na 360 px. Po každom textovom
   patchi over grep-om, že zmena naozaj v súbore je.
2. **Vitest tu beží v `node` prostredí a zbiera len `*.test.ts`** — žiadny DOM, jsdom ani
   testing-library. Komponenty sa netestujú mountovaním; logika sa vyťahuje do čistého
   modulu (`configurator-card-state.ts` je vzor) a UI sa overuje v prehliadači.
   Nové závislosti bez schválenia nepridávaj (CLAUDE.md §10).
3. **`pgrep -f` zabije tvoj vlastný shell.** Používaj `pgrep -x chrome`.
4. **Chromium na boxe JE**: `/home/ubuntu/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`.
   Node 24 má vstavaný `WebSocket`, takže CDP netreba `ws`.
5. **`pnpm dev` v tomto worktree nehydratuje** — overuj cez `next build` + `next start`.
6. **Pred `pnpm build` zastav server na 3021** (PID z `ss -tlnp`), inak servíruje rozbité chunky.
7. **Prettier v pre-commit hooku preformátuje markdown tabuľky.** Patch dokumentov rob
   po riadkoch, nie presnou zhodou celej tabuľky.
8. **`ResilientProductImage` testuj na produkte s on-demand náhľadom.** Na `cdn.maky.store`
   sa retry zámerne nespúšťa — vyzerá to ako mŕtvy kód a nie je.
9. **Neplatný cursor zhodí listing** (`/sk/products?cursor=abc` → „Something Went Wrong").
   Pre-existujúce v A, nie tvoje.
10. **Workflow s viacerými agentmi nespúšťaj** bez výslovného pokynu.

---

## 10. Ako overovať

**Brány:** `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm i18n:check` · `pnpm test:run` ·
`pnpm build` (iba v tomto worktree, **nikdy v `/opt/storefront`** — CLAUDE.md §13.1).
Po zmene `.graphql` **`pnpm generate`**.

Ak je worktree čerstvý: `cp` `.env` z existujúceho B worktree,
`pnpm install --frozen-lockfile`, `NEXT_PUBLIC_SALEOR_API_URL=… pnpm generate:all`.

**i18n:** `fitment` má dnes 85 kľúčov, `configurator` 52, oba 12/12. en-CA má
pre-existujúcu medzeru 212 kľúčov `cart.*`/`checkout.*` — nie tvoja.

**Prehliadač (akceptácia):**

```
MAKY_FITMENT_PROVIDER=fixture MAKY_GARAGE_COOKIE_SECRET=<40 znakov> \
  setsid nohup pnpm exec next start -p 3021 > /tmp/.../next.log 2>&1 &
chrome --headless=new --remote-debugging-port=9333 --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --window-size=1440,900 --user-data-dir=/tmp/claude-1000/cdp-profile-9333
GET http://127.0.0.1:9333/json/list → webSocketDebuggerUrl → Page/Runtime/Network.enable
Page.navigate + Page.loadEventFired · Runtime.evaluate(returnByValue)
Input.dispatchMouseEvent (mouseMoved/mousePressed/mouseReleased na stred rectu)
Emulation.setDeviceMetricsOverride — desktop 1440, mobil 360, tablet ~900
Page.captureScreenshot{captureBeyondViewport:true}
```

Profil drží consent aj cookie — pred behom ho zmaž. Klikaj **iba na viditeľné** prvky
(`getBoundingClientRect().width > 0`), inak trafíš skrytý duplikát z iného breakpointu.

**Akceptácia je prehliadač nad produkčným buildom.** Zelená suita nie je dôkaz.

---

## 11. Hranice

Nedeployuj. Nereštartuj PM2. Nemeň `/opt/storefront/.env`, `/opt/storefront/.next` ani
`maky-smtp-app`. Nepublikuj produkty, nerob Saleor/CFM zápisy. Nedotýkaj sa vetiev A.
Neprepisuj checkout ani cart (CLAUDE.md §10). Buildy iba v izolovanom worktree.
Push vlastnej vetvy povolený; **force push nie**. Fitment pre reálne produkty
**nevymýšľaj** — ani do testov, ani do throwaway súborov. Reálny add-to-cart iba
v izolovanom prostredí a **nikdy objednávka**.

---

## 12. Formát reportu

```
HEAD / remote (git ls-remote, nie tracking ref)
B0_HARDENING_DONE       = YES/NO   (šesť bodov §5, po jednom)
SELECTOR_YEAR_FIRST     = YES/NO
ROOF_ALWAYS_CONFIRMED   = YES/NO
GARAGE_V2               = YES/NO
PROVIDER_CONNECTED      = YES/NO   (preview / produkcia uviesť)
DATASET_HASH_VERIFIED   = YES/NO   (sémantický + transportný, obidva)
REAL_FLOW_BROWSER_PASS  = YES/NO
PUBLIC_ACTIVATION_PERFORMED = NO
brány: tsc / lint / i18n:check / test:run / build (+ BUILD_ID)
screenshoty: desktop 1440 + 360 px + ~900 px, po odmietnutí cookies
čo NIE JE overené a prečo
```

Pri každom výsledku odlíš **fixture / mock / real read / real write**. Nepíš „všetky stavy
fungujú" na základe zelenej suity.

---

## 13. Rozhodnutia pre Mareka — nerob ich sám

1. **Nasadiť B?** Garáž potrebuje `MAKY_GARAGE_COOKIE_SECRET`, inak sa v produkcii vypne
   (a povie to). Oba sú deploy krok, nie kód.
2. **Lokalizované route slugy** — `/konfigurator` je slovenské slovo vo všetkých trhoch,
   a je to cieľ odkazu „Zobraziť kompatibilné produkty" v NO_FIT stave PDP boxu.
3. **Šírka vyhľadávania na 360 px** — compact launcher zdieľa riadok so search poľom;
   s uloženým autom mu ostane ~160 px.
4. **Zmazať starú vetvu** `claude/sf-b-vehicles` (prekonaná).
5. **Follow-upy pre A** (nie B): neplatný cursor zhodí listing;
   `use-product-filters.ts` nezahadzuje cursor pri zmene kategórie/ceny; React #418;
   en-CA parita.

---

## 14. Prvý prompt pre nové vlákno

```
# MAKY.STORE — vlákno B: B0 hardening, selektor, Garáž v2, prijatie pilota 3.0.0

Odpovedaj po slovensky.

## Kto si

Si vlákno B storefrontu MAKY.STORE: výber vozidla, Garáž, konfigurátor strešných
nosičov, pravdivá komunikácia kompatibility. Vlákno A je nasadené — do jeho vetiev,
do /opt/storefront ani do produkcie nesiahaj.

## Prvý krok

Vetva claude/sf-b-vehicles-integration-b697ce — tip over cez git ls-remote
(pri písaní de30cc8). Worktree
/opt/storefront/.claude/worktrees/sf-b-vehicles-integration-b697ce.
Ak je vetva novšia, nič neresetuj — vypíš rozdiel a pokračuj z novšieho.

Prečítaj CELÝ:

    docs/design/handoff-20260907-vlakno-b-selektor-garaz.md

Je self-contained. NEZAČÍNAJ ODZNOVA a neotváraj uzavreté rozhodnutia (§4 a §5 tam).

## Stav

Kontrakt 3.0.0 je hotový a otestovaný: presná zhoda verzie, inkluzívny matchWindow
s tromi hodnotami, dôkaz a stav na produkte, MANUFACTURER_FIT, NEEDS_DETAIL,
isFitmentOfferable ako jediná brána. 1 462 testov, brány zelené, branch-only.
Deväť testov beží nad dvoma skutočnými aplikáciami z CFM pilota.

## Tvoje úlohy, v tomto poradí

1. B0 hardening — šesť bodov v §5 handoffu. Každý je diera, ktorú som potvrdil
   v kóde, nie hypotéza: datasetHash sa neprepočítava; pilot-sample nesie cudzí
   hash; konfigurátor tvrdí "Overené" o výrobcovom slove; dataset so
   source.system="fixture" sa dá predať; kontrola okna proti výrobe generácie je
   mŕtvy kód; HTTP provider nemá testy.
2. Selektor značka → model → ROK (§6). Generáciu dopočítať, keď je jednoznačná.
   Typ strechy VŽDY potvrdiť, aj pri jedinej hodnote — "Iný typ" ani "Neviem"
   sa nesmú skonvertovať na tú jedinú. Mesiac len keď ho okno pozná a rozhoduje.
3. Garáž v2 (§7) — voliteľný mesiac výroby, veh:* identity, žiadny uložený
   compatible, v1 cookie spätne načítať a zmigrovať.
4. Prijatie pilota cez HTTP (§8), keď ho dodám. Over transportný SHA-256 aj
   prepočítaný sémantický datasetHash.
5. Jeden reálny priechod v prehliadači: vozidlo → rok → strecha → ponuka → PDP →
   košík. Košík iba v izolovanom prostredí, objednávka nevzniká.

SEO routy značka/model/generácia NIE SÚ podmienkou prijatia pilota.
Lane A fix 10e19ac rieši vlákno A — do B ho nedávaj.

## Hranice

Nedeployuj. Nereštartuj PM2. Nemeň /opt/storefront/.env, /opt/storefront/.next ani
maky-smtp-app. Nepublikuj produkty, nerob Saleor/CFM zápisy. Nedotýkaj sa vetiev A.
Neprepisuj checkout ani cart. Buildy iba v izolovanom worktree. Push vlastnej vetvy
povolený; force push nie. Fitment pre reálne produkty NEVYMÝŠĽAJ. Rozhodnutia
z §13 handoffu nerob sám. Workflow s viacerými agentmi nespúšťaj bez môjho pokynu.

## Ako hlásiť

Formát je v §12 handoffu. Pri každom výsledku odlíš fixture / mock / real read /
real write. Akceptácia je prehliadač nad produkčným buildom, nie zelená suita.
Priebežne hlás iba zmenu, nález alebo blocker.

Začni prečítaním handoffu a overením SHA cez git ls-remote.
```
