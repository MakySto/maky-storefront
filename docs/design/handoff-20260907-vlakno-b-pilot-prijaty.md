# Vlákno B — B0 hotové, selektor prepísaný, pilot prijatý

Vytvorené 2026-09-07. **Vlož §12 ako prvú správu do nového vlákna.** Tento dokument je
self-contained: čítajúci nepotrebuje predchádzajúce vlákna. Odpovedaj po slovensky.

Predchodca: `handoff-20260907-vlakno-b-selektor-garaz.md`. Jeho §4 (uzavreté rozhodnutia)
platí ďalej. Jeho §5 (B0) a §6 (selektor) sú **hotové** — a §6.1 obsahoval nepresnosť,
ktorú tento dokument opravuje v §4.1.

---

## 0. Prvé tri vety

Si **vlákno B** storefrontu MAKY.STORE: výber vozidla, Garáž, konfigurátor strešných
nosičov, pravdivá komunikácia kompatibility. Vlákno A je nasadené; do jeho vetiev, do
`/opt/storefront` ani do produkcie nesiahaj.

**B0 hardening, selektor `značka → model → rok`, Garáž v2 aj prijatie reálneho CFM pilota
cez HTTP sú HOTOVÉ a overené v prehliadači nad produkčným buildom.** Vetva je branch-only.

Ostáva rozhodnutie o nasadení (Marekovo), plný snapshot od CFM, a potom zapnutie
providera. **Nezačínaj odznova a neotváraj uzavreté rozhodnutia.**

---

## 1. Presný stav

|                  |                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------- |
| vetva            | `claude/vlakno-b-selektor-datasethash-0387f6` — **over cez `git ls-remote`**        |
| tip              | `c01e58f`                                                                           |
| základ           | `b5245da` (predošlé B) nad `27b7088` = produkcia                                    |
| nasadené z B     | **nič** — branch-only                                                               |
| brány            | tsc 0 · lint 0 errors (6 pre-existujúcich warningov) · i18n 12/12 · **1561 testov** |
| posledný build   | `eGSbb-nArr3iB80axkR5M`                                                             |
| Saleor           | Core 3.23.31, `https://api.maky.store/graphql/`, kanál `sk-eur`                     |
| katalóg `sk-eur` | 9 606 verejných; kategória Nordrive 9 192                                           |

Sedem commitov nad `b5245da`:

```
27b7561 fix(fitment): B0 — the five gates that were open, and the sixth that was untested
e22f945 chore(fitment): delivered datasets are byte-exact, so prettier must not touch them
b8f5693 feat(selector): make → model → YEAR, and a roof type nobody may answer for you
da0325e feat(garage): v2 — an optional month, v1 cars kept, and still no stored verdict
1d24f63 test(fitment): the demo fixture had no manufacturer row, so B0.3 was unprovable
cf6837b fix(cart): add-to-cart from the configurator could never have worked
c01e58f test(fitment): commit CFM's delivered pilot, byte for byte, and gate it as an artefact
```

Ak je vetva novšia, **nič neresetuj** — vypíš rozdiel a pokračuj z novšieho.

---

## 2. Čo je hotové

### 2.1 B0 hardening — všetkých šesť bodov

- **`datasetHash` sa prepočítava** (`src/lib/fitment/dataset-hash.ts`). Nezhoda odmieta
  **celý dataset**, nevaruje. Golden test drží **výstup CPythonu**, nie tejto
  implementácie: `1ce42fc1c5236e64…`.
- **`pilot-sample.json` zmazaný**, nahradený reálnym pilotom (§3).
- **Konfigurátor už netvrdí „Overené" o výrobcovom slove.** Rozhodovanie je v čistom
  `fitStatementFor` (`configurator-card-state.ts`); iba `VERIFIED_FIT` smie slovo použiť.
- **`isSimulatedDataset`** v `contract.ts` je jediný predikát; pozná `demoCatalogue` **aj**
  `source.system === "fixture"`. `offers.isDemoDataset` naň deleguje, `provider.ts` tiež.
- **Kontrola okna proti výrobe generácie** číta `window.from/to` (bola mŕtva, `NaN`).
- **HTTP provider má 10 testov** (`provider.http.test.ts`): úspech, timeout, non-2xx,
  nie-JSON telo, nezhoda schémy, nezhoda hashu, nezhoda inštancie, sentinel po drôte,
  fixture-deklarujúca dodávka, chýbajúca URL.

### 2.2 Selektor `značka → model → ROK`

`selector-plan.ts` je čistý modul s rozhodnutiami; `selector-actions.ts` je server akcia;
`vehicle-selector-sheet.tsx` je UI. Tok:

```
značka → model → ROK VÝROBY
       → generácia DOPOČÍTANÁ, keď rok padne do jednej
       → pri prekryve otázka na karosériu/obdobie, nikdy holý kód
       → strecha VŽDY potvrdená, aj pri jedinej hodnote
       → mesiac LEN keď okno pozná mesačnú hranicu na tom roku
```

- **Zoznam striech pochádza z GENERÁCIE** (∪ aplikácie), nie z aplikácií. Dôvod v §4.2.
- „Iný typ" a „Neviem rozpoznať" sú odpovede a **nesmú sa premeniť na jedinú známu
  strechu**. Obe nechajú `roofType` nenastavený → resolver povie „nevieme potvrdiť".
- Mesiace cez `Intl.DateTimeFormat`, nie 144 nových i18n kľúčov.
- `bodyType`/`doors` s jedinou hodnotou sa **dosadzujú** (sú to vlastnosti už vybranej
  generácie). Strecha nikdy. Ten rozdiel je jadro veci.

### 2.3 Garáž v2

- `GARAGE_PAYLOAD_VERSION = 2`, `SUPPORTED_PAYLOAD_VERSIONS = [1, 2]`.
- Nové pole `mo` = mesiac výroby 1–12, **voliteľné a musí také zostať**.
- v1 cookie sa **číta a premigruje** (re-stamp na v2). Verzia, ktorú sme nikdy nepísali,
  sa odmieta.
- Neplatný mesiac stojí **mesiac, nie auto**.
- Zamknuté testom: **nikdy sa neukladá verdikt kompatibility** a ukladajú sa **verejné
  `veh:*` identity**, nie lokálne kľúče.
- Čistá logika v `src/lib/garage/selection.ts`.

### 2.4 Prijatie pilota cez HTTP

Prešiel celý reálny priechod nad produkčným buildom: BMW X5 E53 2003 → holá strecha →
**12 skutočných Nordrive zostáv** → PDP → **košík (121,00 €, množstvo 1)**. Objednávka
nevznikla.

---

## 3. Pilot — čísla, ktoré netreba merať znova

Súbor je **commitnutý v strome** (Marekov výslovný pokyn, 2026-09-07):

```
src/lib/fitment/fixtures/pilot-3.0.0-20260906.2.json
zdroj: https://carfitmanager.com/media/fitment/maky_roof_fitment_3.0.0-pilot-20260906.2.json
       (verejne dostupný bez tokenu z tohto boxu)
```

|                               |                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `datasetVersion`              | `3.0.0-pilot-20260906.2`                                                                       |
| veľkosť                       | **60 591 B**                                                                                   |
| transportný SHA-256           | `28b87e3f3672b779c81b53e4b19f422822867ad4376207f4d63d629b683c6088`                             |
| sémantický `datasetHash`      | `5ab7b2d447afda3d1528408e95896191c251539414f805fbac54937baad27fb5`                             |
| obsah                         | 6 značiek / 7 modelov / 7 generácií / **8 aplikácií** / **67 produktov** (61 sellable, 6 held) |
| `accounting.manifest_rows`    | 9 192 (plná kohorta; pilot je z nej orezaný)                                                   |
| `coverage.completeForMakeIds` | `[]`                                                                                           |

Môj **nezávislý prepočet sa zhoduje** s hodnotou deklarovanou v súbore. Identity proti
živému Saleoru: **67/67** existuje, `isAvailableForPurchase`, `externalReference` sedí,
variant sa vyrieši.

Bráni to `pilot-conformance.test.ts` (11 testov): obidva hashe, veľkosť, validácia proti
`api.maky.store`, odmietnutie proti inej inštancii, zosúladenie `accounting` a to jedno
varovanie. **Ak CFM dodá nový pilot, konštanty sa menia v tom istom commite ako súbor.**

**Pilot NIE JE napojený na provider.** Fitment má do nasadenia chodiť cez HTTP;
commitnutá kópia je testovací materiál a servírovať ju by znamenalo posielať zastaranú
kompatibilitu.

Značky v pilote: **BMW, FORD, TOYOTA, AUDI, KIA, HYUNDAI.**

---

## 4. Nálezy tohto vlákna — neodvodzuj ich znova

### 4.1 ⚠️ Predošlý handoff §6.1 dieru PODCENIL

Dokazoval ju meraním **selektor → resolver priamo** a dostal `AMBIGUOUS`, teda „funkčná
diera, nič sa neponúkne". Reálna cesta je ale
**selektor → `saveVehicle` → cookie → resolver**, a `saveVehicle` chýbajúcu strechu
**DOSADIL**. Odmerané na commitnutej fixture:

```
resolveQualifier(["raised-rails"], undefined)  ->  "raised-rails"
```

Uložilo sa auto so strechou, ktorú nikto nepotvrdil, a všetky plochy nad ním hlásili
overenú zhodu. Nie chýbajúca otázka — **vymyslená odpoveď**, o časti, ktorá rozhoduje, či
sa pätky na auto uchytia. Zamknuté v `src/lib/garage/selection.test.ts`.

### 4.2 Zoznam striech musí byť z generácie, nie z aplikácií

Dokázané naživo: aplikácia pre BMW X5 E53 pokrýva len `naked-roof`, ale generácia sa
predávala aj s pozdĺžnikmi. Keby zoznam pochádzal z aplikácií, zákazník s pozdĺžnikmi by
videl **len „Holú strechu"** a bol by dotlačený k odpovedi, ktorú sme chceli počuť.
Takto dostane pravdivé „nevieme potvrdiť".

### 4.3 B0.3 sa netýkala okrajového prípadu — týkala sa 100 % reálnych ponúk

Celý reálny katalóg je `manufacturer-application` / `not-independently-verified`, teda
`MANUFACTURER_FIT`. Pred opravou by **všetkých 12** kariet pre X5 hlásilo „Overené pre
vaše vozidlo". Teraz hovoria „Kompatibilné podľa aplikačných údajov nordrive" a PDP dodá
„Nezávisle sme to neoverili."

### 4.4 `add-to-cart` z konfigurátora NIKDY nefungoval

`QUANTITY_FALLBACK_MAX` bol exportovaný z `"use client"` modulu (`quantity-stepper.tsx`)
a čítaný z `"use server"` akcie (`plp/actions.ts`). Cez tú hranicu nepríde `99` →
`Math.min(1, …)` = `NaN` → `JSON.stringify` napíše `null` → Saleor odmietne.

⚠️ **Saleor dáva pre `null` aj pre chýbajúci kľúč BAJT-IDENTICKÚ hlášku**
(`Variable "$quantity" of required type "Int!" was not provided`) — odmerané proti
`api.maky.store` na oboch prípadoch. Chyba teda ukazovala na volanie, ktoré `quantity: 1`
posiela zjavne správne, a hodnotu, ktorá sa naozaj pokazila, nepomenovala nikde.

PDP to nezasiahne (posiela reálny `maxQuantity`), demo fixture to odhaliť nemohla (demo
karta zámerne nepredáva). Opravené: konštanta je v bezdirektívovom
`src/ui/components/ui/quantity-limits.ts` a `clampQuantity` garantuje kladné celé číslo.

### 4.5 B0.5 našla chybu pri prvom kontakte s reálnymi dátami

BMW X5 E53: generácia vyrábaná **1999–2006**, ale aplikačné okno `05/00>02/07` siaha do
**02/2007**. Zákazník s X5 z 2007 si rok nevyberie (roky sú ohraničené výrobou), takže
**12 produktov je preňho nedosiahnuteľných**. Nahlásené CFM, zamknuté testom.

Prečo varovalo len raz: oba `year/month` riadky (AUDI A6, HYUNDAI H-1) majú
**`reconciledToGeneration: true`** — CFM ich štart už zarovnal na začiatok výroby. BMW
zarovnané nie je. Kontrola je presná, nie neúplná.

### 4.6 Python `1.0` vs JS `1` — sémantický hash sa počíta z TEXTU

`json.dumps` píše `1.0`, `JSON.stringify` píše `1`, a `evidence.confidence` je v pilote
`0.95`/`0.9` — teda `1.0` je úplne možná hodnota. Preto sa čísla re-emitujú z **pôvodného
zdrojového tokenu** (Node 24 reviver `context.source`) a kľúče sa radia **podľa code
pointu**, nie podľa UTF-16. Nezjednodušuj to späť.

### 4.7 Prettier by transportný hash ticho rozbil

Odmerané: na neignorovanej ceste prettier súbor prepíše a `28b87e3f…` sa zmení na
`ad3d24ed…`, pričom tsc, lint aj celá suita zostanú **zelené**. `src/lib/fitment/fixtures/`
je preto v `.prettierignore`. **Sémantický hash reformátovanie prežije, transportný nie.**

### 4.8 CFM číslo „38 aplikácií so `startPrecision: year`" je o PLNOM kandidátovi

Pilot má **8 aplikácií**, z toho **2** s `year` štartom (obe s mesačným koncom, 0
otvorených). Páry precízií: `month/month` 5, `year/month` 2, `month/open` 1.
`endPrecision: "year"` sa nevyskytuje **ani raz** — to CFM tvrdenie sedí.

### 4.9 Drobnosť pre CFM

`evidence.supplier` je `"nordrive"` malými písmenami a renderuje sa doprostred vety
(„podľa aplikačných údajov nordrive"). Ich pole, ich oprava — necapitalizuj to slepo,
`Pro-USER` a `HAK-SYSTEM` by to rozbilo.

---

## 5. ⚠️ Prečo B zatiaľ NEZAPÍNAŤ naostro

**Pilot pokrýva 67 produktov z 9 606 a 6 značiek.** Zákazník so Škodou otvorí „Vybrať
vozidlo" a uvidí BMW, FORD, TOYOTA, AUDI, KIA, HYUNDAI — prečíta si to ako „tento obchod
nemá nosiče na moje auto". PDP mlčia správne (brána `datasetSpeaksForProduct`), ale
selektor je viditeľný vždy.

Odporúčané poradie:

1. **Nasadiť kód B s VYPNUTÝM providerom.** `MAKY_FITMENT_PROVIDER` neuvedené = funkcia
   mlčí. Rovnaký vzor ako „SEO brána deployed but OFF" vo vlákne A.
2. **CFM doručí plný snapshot** (9 192 riadkov) a opraví §4.5 a §4.9.
3. **Zapnúť provider** — jeden ENV prepínač a reštart, bez buildu.
4. **Rozhodnúť o 55 držaných riadkoch** (47 mapping suspects + 21 clamp) — Marek + CFM.
5. Neskôr SEO routy značka/model/generácia nad tým istým resolverom.

---

## 6. Konfigurácia

```
MAKY_FITMENT_PROVIDER=off|fixture|http     NEUVEDENÉ = OFF = funkcia mlčí
MAKY_FITMENT_URL=            iba pre http
MAKY_FITMENT_TOKEN=          server-only (pilot ho nepotrebuje)
MAKY_FITMENT_TIMEOUT_MS=5000
MAKY_FITMENT_REVALIDATE_SECONDS=300
MAKY_GARAGE_COOKIE_SECRET=   BEZ NEHO JE GARÁŽ V PRODUKCII VYPNUTÁ (a povie to); ≥ 32 znakov
```

V produkčnom `.env` nie je nič z toho. B premenné dávaj **na príkazový riadok**
`next start`.

---

## 7. Pasce

1. **Python `str.replace` na zdrojáku ticho neurobí nič** pri nezhode odsadenia. Po každom
   textovom patchi over grep-om, že zmena naozaj v súbore je.
2. **Vitest tu beží v `node` prostredí a zbiera len `*.test.ts`** — žiadny DOM. Logika
   patrí do čistého modulu (`selector-plan.ts`, `configurator-card-state.ts`,
   `garage/selection.ts`, `quantity-limits.ts` sú vzory), UI sa overuje v prehliadači.
3. **`pgrep -f` zabije tvoj vlastný shell.** Používaj `pgrep -x chrome`.
4. **Chromium JE**: `/home/ubuntu/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`.
   Node 24 má vstavaný `WebSocket`, CDP nepotrebuje `ws`.
5. **`pnpm dev` v tomto worktree nehydratuje** — overuj cez `next build` + `next start`.
6. **Pred `pnpm build` zastav server na 3021** (`ss -tlnpH 'sport = :3021'`).
7. **Prettier v pre-commit hooku preformátuje markdown tabuľky.** Patch dokumentov rob po
   riadkoch.
8. **`resolveFitment` bez `saleorProductId` vráti `no-product-named`**, nie verdikt.
9. **Po uložení auta sa tlačidlo v hlavičke premenuje** na názov vozidla — prehliadačový
   skript, ktorý hľadá „Vybrať vozidlo", potom nič nenájde. Medzi behmi maž CDP profil.
10. **Fixture Kodiaq je zámerne `unreviewed`/`sellable:false`** — „nemáme overenú zostavu"
    je tam správna odpoveď, nie regresia. Reálne ponuky má v demo dátach Octavia IV.
11. **Čerstvý worktree**: `cp` `.env` z existujúceho B worktree,
    `pnpm install --frozen-lockfile`, `NEXT_PUBLIC_SALEOR_API_URL=… pnpm generate:all`.

---

## 8. Ako overovať

**Brány:** `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm i18n:check` · `pnpm test:run` ·
`pnpm build` (iba v tomto worktree, **nikdy v `/opt/storefront`** — CLAUDE.md §13.1).

**i18n:** en-CA má pre-existujúcu medzeru **212** kľúčov `cart.*`/`checkout.*` — nie tvoja.
Ak počet nie je presne 212, niečo si pridal len do jedného súboru.

**Prehliadač (akceptácia):**

```
MAKY_FITMENT_PROVIDER=http \
MAKY_FITMENT_URL=https://carfitmanager.com/media/fitment/maky_roof_fitment_3.0.0-pilot-20260906.2.json \
MAKY_GARAGE_COOKIE_SECRET=<40 znakov> \
  setsid nohup pnpm exec next start -p 3021 > /tmp/.../next.log 2>&1 &
chrome --headless=new --remote-debugging-port=9333 --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --window-size=1440,900 --user-data-dir=/tmp/claude-1000/cdp-profile-9333
```

Klikaj **iba na viditeľné** prvky (`getBoundingClientRect().width > 0`), inak trafíš skrytý
duplikát z iného breakpointu. **Akceptácia je prehliadač nad produkčným buildom. Zelená
suita nie je dôkaz.**

---

## 9. Hranice

Nedeployuj. Nereštartuj PM2. Nemeň `/opt/storefront/.env`, `/opt/storefront/.next` ani
`maky-smtp-app`. Nepublikuj produkty, nerob Saleor/CFM zápisy. Nedotýkaj sa vetiev A.
Neprepisuj checkout ani cart (CLAUDE.md §10). Buildy iba v izolovanom worktree. Push
vlastnej vetvy povolený; **force push nie**. Fitment pre reálne produkty **nevymýšľaj**.
Reálny add-to-cart iba v izolovanom prostredí a **nikdy objednávka**.

⚠️ **Repozitár je verejný fork** (CLAUDE.md §10.1). Pilot je v ňom commitnutý vedome —
neobsahuje osobné údaje, ceny, sklad ani credentials, ale obsahuje interné `CFMP-` id,
skóre dôvery `0.9/0.95` a dôvody držania. Nič ďalšie interné tam nepridávaj bez pýtania.

---

## 10. Formát reportu

```
HEAD / remote (git ls-remote, nie tracking ref)
brány: tsc / lint / i18n:check / test:run / build (+ BUILD_ID)
čo bolo zmenené a prečo
čo NIE JE overené a prečo
PUBLIC_ACTIVATION_PERFORMED = NO
```

Pri každom výsledku odlíš **fixture / mock / real read / real write**. Nepíš „všetky stavy
fungujú" na základe zelenej suity.

---

## 11. Rozhodnutia pre Mareka — nerob ich sám

1. **Nasadiť B s vypnutým providerom?** (§5) Potrebuje `MAKY_GARAGE_COOKIE_SECRET`.
2. **Lokalizované route slugy** — `/konfigurator` je slovenské slovo vo všetkých trhoch.
3. **Šírka vyhľadávania na 360 px** — compact launcher zdieľa riadok so search poľom.
4. **Zmazať prekonanú vetvu** `claude/sf-b-vehicles`.
5. **55 držaných riadkov** — 47 mapping suspects + 21 clamp.
6. **Follow-upy pre A** (nie B): neplatný cursor zhodí listing; `use-product-filters.ts`
   nezahadzuje cursor pri zmene kategórie/ceny; React #418; en-CA parita.

---

## 12. Prvý prompt pre nové vlákno

```
# MAKY.STORE — vlákno B: pokračovanie po prijatí pilota

Odpovedaj po slovensky.

## Kto si

Si vlákno B storefrontu MAKY.STORE: výber vozidla, Garáž, konfigurátor strešných
nosičov, pravdivá komunikácia kompatibility. Vlákno A je nasadené — do jeho vetiev,
do /opt/storefront ani do produkcie nesiahaj.

## Prvý krok

Vetva claude/vlakno-b-selektor-datasethash-0387f6 — tip over cez git ls-remote
(pri písaní c01e58f). Ak je novšia, nič neresetuj: vypíš rozdiel a pokračuj
z novšieho.

Prečítaj CELÝ:

    docs/design/handoff-20260907-vlakno-b-pilot-prijaty.md

Je self-contained. NEZAČÍNAJ ODZNOVA a neotváraj uzavreté rozhodnutia.

## Stav

B0 hardening, selektor značka → model → ROK, Garáž v2 a prijatie reálneho CFM
pilota cez HTTP sú HOTOVÉ a overené v prehliadači nad produkčným buildom.
1561 testov, brány zelené, branch-only, nič nasadené.

Pilot 3.0.0-pilot-20260906.2 je commitnutý v strome, 60 591 B, transportný SHA
28b87e3f…, sémantický 5ab7b2d4… (môj prepočet == deklarované), 67/67 identít
overených proti živému Saleoru.

## Čo NEROBIŤ bez Marekovho výslovného GO

Nezapínaj fitment provider naostro. Pilot pokrýva 67 produktov z 9 606 a 6
značiek, takže zákazník so Škodou by v selektore videl šesť cudzích značiek.
Poradie je v §5 handoffu: nasadiť s vypnutým providerom → plný snapshot od CFM
→ až potom zapnúť.

## Čo robiť

Počkaj na moje zadanie. Ak žiadne nemáš, navrhni najbližší krok podľa §5 a §11
handoffu a spýtaj sa, ktorý mám na mysli. Nezačínaj SEO routy, census ani
atribúty — to sú samostatné etapy.

## Hranice

Nedeployuj. Nereštartuj PM2. Nemeň /opt/storefront/.env ani .next. Nerob
Saleor/CFM zápisy. Nedotýkaj sa vetiev A. Neprepisuj checkout ani cart. Buildy
iba v izolovanom worktree. Push vlastnej vetvy povolený; force push nie.
Fitment pre reálne produkty NEVYMÝŠĽAJ. Repozitár je VEREJNÝ fork — nič interné
doň nepridávaj bez pýtania. Rozhodnutia z §11 handoffu nerob sám.

## Ako hlásiť

Formát je v §10 handoffu. Pri každom výsledku odlíš fixture / mock / real read /
real write. Akceptácia je prehliadač nad produkčným buildom, nie zelená suita.

Začni prečítaním handoffu a overením SHA cez git ls-remote.
```
