# Vlákno B — pokračovanie (handoff pre nové Claude Code vlákno)

Vytvorené 2026-09-05. Vlož celý tento dokument ako prvú správu do nového vlákna.
Odpovedaj po slovensky.

---

## 0. Prvé tri vety

Si **vlákno B** storefrontu MAKY.STORE: výber vozidla, Garáž, konfigurátor strešných
nosičov, kompatibilita. Vlákno A (katalóg, lokalizácia, SEO) je **iné vlákno** a práve
teraz nasadzuje — **do jeho vetiev ani do produkcie nesiahaj**.

Predchádzajúce B vlákno dodalo funkčný celok a potom ho na základe revízie prepracovalo.
**Nezačínaj odznova a neotváraj znovu uzavreté rozhodnutia** — sú v §4 a §7.

Tvoja prvá úloha nie je audit. Je to **rebase na nasadený základ A + napojenie na tri
reálne zverejnené produkty**. Detail v §8.

---

## 1. Presný stav (overené 2026-09-05, read-only)

|                 |                                                               |
| --------------- | ------------------------------------------------------------- |
| Vetva B         | `claude/sf-b-vehicles`                                        |
| SHA             | `3a981ac16ff5165fabb2d49a1e539030d157b380`                    |
| lokál == remote | áno                                                           |
| worktree        | `/home/ubuntu/maky-worktrees/storefront-b`, čistý             |
| základ          | Legal `a4d78cb`, **S1 nemergované**, 10 commitov nad základom |
| nasadené        | **nič** — branch-only                                         |

**⚠️ Základ je zastaraný, ale rebase je čistý — zmerané, nie odhadnuté.**

```
a4d78cb (základ B) JE predok 27b7088 (nasadené A)   → žiadna divergencia
A pridalo nad ten základ                            → 44 commitov
prekryv súborov A × B                               → PRESNE 13 súborov
```

Tých 13 je `.env.example` + všetkých 12 `src/i18n/messages/*.json`. **Nič iné.**
`src/lib/fitment/*`, `src/lib/garage/*`, `src/ui/components/vehicle/*`,
`src/ui/components/fitment/*`, obe nové routy, `FitmentProductsByIds.graphql`,
`route-policy.ts` aj `routing.generated.ts` — **nulový prekryv, žiadny konflikt**.

Očakávané konflikty a ich riešenie:

| súbor                            | A                      | B                                                | riešenie                            |
| -------------------------------- | ---------------------- | ------------------------------------------------ | ----------------------------------- |
| `.env.example`                   | +30 riadkov na koniec  | +33 riadkov na koniec                            | nechaj oboje                        |
| `src/i18n/messages/*.json` (12×) | +11 riadkov v `common` | +156 riadkov v `fitment`/`garage`/`configurator` | disjunktné namespace → nechaj oboje |

⚠️ Jedna hodnota sa **mení**, nie pridáva: A prepísalo `common.onDemand`
z „Na objednávku" na **„Na objednávku, dodanie 5–10 pracovných dní"**.
**Vezmi verziu A.** `configurator-results.tsx` ju číta cez `tc("onDemand")`,
takže lepšiu formuláciu prevezme automaticky.

### Kontext mimo B (nemeň, iba ber na vedomie)

**Vlákno A je NASADENÉ** (2026-09-05 23:06 UTC, odstávka 36 s):

```
git_sha  = 27b708810ed29f8273f5e003d868be31f3d553d8
git_ref  = claude/sf-a-rc-20260905
build_id = EeqdrEsFOEh2OMnTDHF03
```

Zdroj: `/opt/storefront/.next/MAKY_DEPLOY_META` (autoritatívne pre to, čo naozaj beží).
Remote ref `refs/heads/claude/sf-a-rc-20260905` ukazuje na ten istý SHA — overené cez
`git ls-remote`. Rollback snapshot `.next.rollback-3089012-zQWTPSsTlcLS59kIfx0AY-…`,
`b6b633da` ostáva pinnutý.

**Saleor Core je teraz `3.23.31`** (bolo 3.22.50), Dashboard 3.23.32,
API `https://api.maky.store/graphql/` nezmenené.

---

## 2. ⭐ NOVÉ: tri Nordrive strešné nosiče sú VEREJNÉ

Toto je presne to, čo B čakalo — **reálne identity**. Marek potvrdil, že sa na nich má
testovať.

| Saleor product ID  | cena     | médií | slug                                                                                       |
| ------------------ | -------- | ----- | ------------------------------------------------------------------------------------------ |
| `UHJvZHVjdDo0ODE=` | 245,00 € | 6     | `stresny-nosic-nordrive-silenzio-cx-black-chevrolet-niva-1998-2015-hladka-strecha`         |
| `UHJvZHVjdDo0ODI=` | 121,00 € | 6     | `stresny-nosic-nordrive-quadra-black-evos-lp-bmw-5-rad-touring-e39-1997-2004-fixacne-body` |
| `UHJvZHVjdDo0ODM=` | 87,99 €  | 5     | `stresny-nosic-nordrive-quadra-black-citroen-c-crosser-2007-2013-klasicke-lyziny`          |

- URL tvar je **`/sk/<slug>`**, nie `/sk/products/<slug>` (tam je 308).
- Sú `sale_to_order`.
- Zvyšných 9 189 čaká; publikujú sa až po smoke teste vlákna A.
- Slugy nesú vozidlo a typ strechy — **ale to nie je fitment dôkaz.** Názov ani slug sa
  ako dôkaz kompatibility použiť nesmú (§7).

### Čo z toho vyplýva pre B

Doteraz existovala iba **demo** cesta. Teraz sa dá po prvý raz overiť **reálna** cesta:
`fitment ID → Saleor lookup → verejná ponuka → add-to-cart s post-condition`.

Chýba jediné: **reálny fitment snapshot z CFM**, ktorý tie tri ID spojí s vozidlami.
Bez neho vieš overiť lookup/ponuku/nákup, ale nie kompatibilitu.

**Nevymýšľaj fitment pre tie tri produkty a nevydávaj ho za reálny.** Ak potrebuješ
overiť reálnu cestu skôr, než CFM dodá snapshot, je to `REAL_SNAPSHOT = NO`
a v reporte to musí byť takto označené.

---

## 3. Saleor 3.23.31 — čo sa zmenilo pre B

- **Codegen bol spustený proti 3.22.x.** Po rebase **musíš** spustiť
  `pnpm generate:all` proti živej 3.23.31 schéme a znovu prejsť `tsc`.
- `productMediaCreate` je asynchrónne → thumbnail môže krátko vracať **503**.
  `3089012` pridal `ResilientProductImage` (placeholder + jeden retry po ~3 s).
  **Ak B renderuje obrázky ponuky, má použiť ten komponent, nie vlastný `<Image>`.**
  Dnes `configurator-results.tsx` používa `next/image` priamo — **treba prepnúť.**
- `Checkout.problems` má v 3.23 dva nové členy **bez poľa `line`**
  (`CheckoutProblemDeliveryMethodStale`, `…Invalid` majú `delivery`).
  B ho nečíta — ak by začalo, musí vetviť cez `__typename`.
- **Nezavádzaj** `deliveryOptionsCalculate` ani `Checkout.delivery`.
- `externalReference` a `cfm_availability_mode` — bez zmeny semantiky.

---

## 4. Čo B už dodalo — NEROB ZNOVU

10 commitov, všetko na `3a981ac`. Posledná validácia: **1122 testov / 69 súborov,
tsc 0, lint 0 errors, i18n:check OK, build exit 0.**

### Moduly

```
src/lib/fitment/
  contract.ts            v2.0.0 — ProductKind, FitmentScope, DemoCatalogueEntry
  resolve.ts             per-identity resolution, resolveVehicleOutcome
  validate.ts            runtime validácia payloadu na hranici
  conditions.ts          poradie: zdrojový text → známy kód → nedostupné
  provider.ts            off | fixture | http; React cache(); demo-ness z DÁT
  offers.ts              demo izolácia, identity check, kanonická dostupnosť
  cart-actions.ts        re-verify + serverový demo blok + post-condition
  selector-actions.ts    krokové dáta (strom neopúšťa server)
  application-actions.ts stránkovaný zoznam vozidiel produktu
  selector-types.ts / application-types.ts   (konštanty MIMO "use server")
  fixtures/dataset-v1.json  plne syntetický demo dataset + demoCatalogue
  + 6 test súborov (116 testov v module)

src/lib/garage/
  signature.ts  cookie.ts  config.ts  state.ts  actions.ts  (+ testy)

src/ui/components/vehicle/
  vehicle-selector-sheet.tsx      vehicle-selector-launcher.tsx
  garage-list.tsx                 vehicle-summary.tsx
  configurator-results.tsx

src/ui/components/fitment/
  compatibility-box.tsx           product-vehicle-applications.tsx
  verdict-presentation.ts

src/app/[channel]/(main)/garage/page.tsx
src/app/[channel]/(main)/konfigurator/page.tsx
src/graphql/FitmentProductsByIds.graphql
docs/design/lane-b-handoff-20260905.md      ← prečítaj, je self-contained
```

Route registrácia `/garage` + `/konfigurator` je **hotová všetkými tromi krokmi**
(page → `generate:routing` → `ROUTE_POLICY`). Testy `route-policy`,
`routing-generated` aj `proxy.gate` prechádzajú.

i18n: **165 kľúčov** v `fitment` / `garage` / `configurator`, **identických vo všetkých
12 súboroch**, ICU plurály overené proti `Intl.PluralRules` per jazyk.

---

## 5. Prečo vyzerá kód tak, ako vyzerá (uzavreté rozhodnutia)

Revízia z 2026-09-05 našla, že v1 **spájal reálne produkty s vymyslenou kompatibilitou**:
demo fixture menovala reálne Saleor ID, takže skutočný strešný box a nosič lyží prišli so
svojím názvom, fotkou a cenou pod vymysleným štítkom „kompletná zostava", vymyslenou
nosnosťou a vymyslenou kompatibilitou. Všetko nižšie je oprava toho — **nevracaj to**:

| pravidlo                                                                                                            | prečo                                                                    |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Demo dataset je **sebestačný** (syntetické ID + `demoCatalogue`, inštancia `demo.invalid`, **nikdy nevolá Saleor**) | aby si nemal odkiaľ požičať cudziu identitu                              |
| `productKind` **povinný**, vynútený na **dvoch** vrstvách (resolver + offers)                                       | prítomnosť `completeSet` nie je dôkaz, že ide o nosič                    |
| Ponúka sa **iba `VERIFIED_FIT`**                                                                                    | `UNKNOWN`/`year-hold`/`conflict` sa vysvetlia, nepredávajú               |
| Rieši sa **per identita pred agregáciou**                                                                           | v1 z „A pasuje, B nie" spravil globálny `AMBIGUOUS` a neponúkol nič      |
| `coverage.scope.programId` **povinný**                                                                              | „kompletné pre Škodu" nesmie znamenať „nič v obchode nepasuje"           |
| Podmienky: zdroj → kód → **„Overené s podmienkami"**                                                                | nikdy `NO_FIT` z chýbajúceho prekladu; nikdy ticho nezmiznú              |
| Dedup podmienok podľa **kódu AJ textu**                                                                             | dva limity s rovnakým kódom sú dva limity                                |
| Cart: re-read vozidla + re-resolve fitmentu + **serverový demo blok** + **spätné čítanie košíka**                   | `addListingItemToCart` vracia `void` a hltá doménové chyby               |
| Cena **výhradne z konkrétneho variantu**                                                                            | `priceRange.start` je cena iného variantu                                |
| Dostupnosť cez kanonický `resolveAvailability`                                                                      | `quantityAvailable` je **syntetický strop 50**, nie sklad                |
| Hore **iba zhrnutie vozidla**, verdikt a podmienky **na karte**                                                     | v1 tvrdil „táto zostava je overená" nad zoznamom, kde nič nebolo vybrané |
| Demo názvy sú **kódy** (`DEMO-SET-AERO-FLUSH`)                                                                      | čitateľný slovenský názov vyzeral na DE stránke ako chýbajúci preklad    |
| SK terminológia je **„zostava"**, nie „sada"                                                                        | zjednotené naprieč copy (CLAUDE.md §7)                                   |

---

## 6. Prostredie — pasce, ktoré stáli čas

1. **`pnpm dev` v tomto worktree NEHYDRATUJE.** Žiadny `<button>` nedostane
   `__reactProps` — nefunguje ani existujúci PLP filter Sheet. **Nie je to regresia.**
   Overuj výhradne cez `pnpm build` + `pnpm exec next start -p 3021`.
2. **`"use server"` súbor smie exportovať IBA async funkcie.** Konštanta tam vypíše
   chybu, ale **build stále skončí exit 0**. Preto existujú `*-types.ts`.
3. **Tailwind nevidí interpolované triedy.** `bg-fitment-${tone}-bg` neemituje CSS a
   v4 zlyhá ticho. Vždy literály.
4. **`pkill -f` zabije tvoj vlastný shell.** Zabíjaj podľa PID z `ss -tlnp`.
5. **NIKDY nespúšťaj build v `/opt/storefront`** (CLAUDE.md §13.1).
6. **Generované GraphQL typy sú gitignored** (`.gitignore:4` `gql/`).
   Bez `pnpm generate:all` neprejde `tsc`.
7. **Nový worktree potrebuje `pnpm install --frozen-lockfile`** — `node_modules` z `/opt`
   nesedia.
8. **i18n parity je červená už na základe** — `en-CA` chýba 212 kľúčov, ostatných 10 po 1
   (`checkout.summary.vatIncluded`). **Nie je to regresia B.** Moje 3 namespace sú 12/12.
9. **Prettier v pre-commit hooku prepisuje staged JSON.** Fixture s checksumom by
   potreboval `.prettierignore` — môj `datasetHash` je zámerne neverifikovaný.
10. **Guard môže ticho vypnúť funkciu.** Inštančný guard datasetu odmietol demo
    (`demo.invalid`), provider vrátil nič — a `next build` aj **všetkých 109 testov
    prešlo**. Chytil to až prehliadač. **Akceptácia = prehliadač nad produkčným buildom.**

### Ako som overoval v prehliadači

Playwright v tomto worktree **nie je** a dependencie sa pridávať nemajú. Použil som
Chrome cez CDP s čistým Node (`WebSocket` je v Node 24 globálny):

```
binárka: /home/ubuntu/.cache/ms-playwright/chromium-1187/chrome-linux/chrome
spustenie: --headless=new --remote-debugging-port=<port> --no-sandbox
           --disable-gpu --disable-dev-shm-usage --window-size=W,H
```

`/json/list` → `webSocketDebuggerUrl` → `Page.navigate`, `Runtime.evaluate`,
`Input.dispatchMouseEvent`, `Page.captureScreenshot`, `Network.setCookie`,
`Emulation.setDeviceMetricsOverride`.

Pomocné skripty boli v scratchpade a **sú stratené** — ak ich budeš potrebovať, sú
triviálne na obnovenie z vyššie uvedeného. Podpísanú garage cookie vyrobíš:
`base64url(JSON.stringify(payload)) + "." + base64url(HMAC-SHA256(secret, encoded))`.

---

## 7. Konfigurácia

```
MAKY_FITMENT_PROVIDER=off|fixture|http   NEUVEDENÉ = OFF = funkcia mlčí (bezpečný default)
MAKY_FITMENT_URL=            iba pre http
MAKY_FITMENT_TOKEN=          server-only
MAKY_FITMENT_TIMEOUT_MS=5000
MAKY_FITMENT_REVALIDATE_SECONDS=300
MAKY_GARAGE_COOKIE_SECRET=   BEZ NEHO JE GARÁŽ V PRODUKCII VYPNUTÁ (a povie to)
```

Všetko je v `.env.example` s odôvodnením. **V produkčnom `.env` nič z toho nie je** —
je to samostatný deploy krok, nie obchodné rozhodnutie.

Lokálne overenie:
`MAKY_FITMENT_PROVIDER=fixture MAKY_GARAGE_COOKIE_SECRET=<40 znakov> pnpm exec next start -p 3021`

---

## 8. Čo zostáva — v tomto poradí

### B3.1 Rebase na nasadený základ A ⬅ **prvý krok**

1. Zisti **finálny nasadený A SHA** (`git ls-remote`, nie tracking ref;
   `/opt/storefront/.next/MAKY_DEPLOY_META` je autoritatívne pre to, čo naozaj beží).
2. Nový worktree z toho SHA, alebo rebase `claude/sf-b-vehicles` naň.
   **`a4d78cb` už nie je platný základ.**
3. `pnpm install --frozen-lockfile` → `pnpm generate:all` (**proti 3.23.31**) → `tsc`.
4. Očakávaj konflikty najmä v `src/i18n/messages/*` (A menilo iné namespace),
   `.env.example` a `src/lib/route-policy.ts` / `routing.generated.ts`.
5. **A JU DODALO — prepni `cart-actions.ts` a zmaž moju obchádzku.** Overené na
   `27b7088`, `src/ui/components/plp/actions.ts`:

   ```ts
   export async function addVariantToCart(input: {
   	channel: string;
   	variantId: string;
   	quantity: number;
   	maxQuantity?: number | null;
   }): Promise<AddToCartResult>;
   // AddToCartResult: { status: "added" }
   //               | { status: "rejected";    reason: "invalid" | "checkout" | …; message }
   //               | { status: "unconfirmed"; message }
   // typy v ./add-to-cart-result: classifyCheckoutErrors, readBackVerdict,
   //                              READ_BACK_BUDGET_MS, READ_BACK_DELAYS_MS
   ```

   Robí presne to, čo som obchádzal, a lepšie: inšpektuje `checkoutLinesAdd.errors`,
   má **deadline rozpočet** na read-back a **nikdy automaticky neopakuje** `unconfirmed`
   („a retry is how one click becomes two lines").

   **Čo v `cart-actions.ts` zostáva:** demo interlock, re-read aktívneho vozidla,
   re-resolve fitmentu pre ten konkrétny produkt, kontrola presného variantu.
   **Čo zmaž:** vlastnú funkciu `countLine()` a `addListingItemToCart` + FormData.
   Mapovanie: `added → ok`, `rejected → not-available | cart-rejected` podľa `reason`,
   `unconfirmed → lookup-failed` (moje UI ten stav už rozlišuje a má naň text).

   Pozn.: `addListingItemToCart(formData): Promise<void>` A ponechalo kvôli spätnej
   kompatibilite — **nepoužívaj ho**, je to práve tá cesta, ktorá hltá chyby.

6. Prepni `configurator-results.tsx` z `next/image` na **`ResilientProductImage`**
   (je v `27b7088`) — inak sa 503 z asynchrónnych médií 3.23 prejaví ako rozbitá karta.

7. Po rebase **znovu spusti brány** a čakaj, že `src/gql/` bude treba pregenerovať.
   Pri deployi A presne toto zhodilo preflight: `src/gql/` v `/opt/storefront` bolo
   generované 20. marca, teda šesť mesiacov staré, a RC medzitým pridala `$last` do
   dotazov. `SKIP_TESTS=1` by to zamaskoval. **Codegen po rebase nie je voliteľný.**

### B3.2 Reálna cesta na troch zverejnených produktoch

Cieľ: dokázať `REAL` vetvu, ktorá doteraz nebola spustená ani raz.

- `resolveFitmentOffers` s `MAKY_FITMENT_PROVIDER=http` (alebo dočasným lokálnym
  datasetom **bez `demoCatalogue`**) proti `UHJvZHVjdDo0ODE=` / `0ODI=` / `0ODM=`.
- Over: preklad názvu (`translation.name` — dnes je `null`, čaká na CFM),
  `externalReference` **sa zhoduje** s tým, čo vrátil Saleor,
  cena **presného variantu**, `metafield("cfm_availability_mode")`.
- **Zmeraj `cfm_availability_mode` na tých troch.** Pri poslednej kontrole bol na
  produktoch `null` → `resolveAvailability` správne nezobrazí nič. Ak je stále null,
  je to **dátová medzera CFM**, nie bug storefrontu — zapíš to, neobchádzaj.
- Add-to-cart s post-condition read-back na jednom z nich. **Nevytváraj objednávku.**
- `productKind` pre ne musí prísť z CFM. **Neodvádzaj ho zo slugu ani z názvu.**

### B3.3 Reálny fitment snapshot (blokované CFM)

Kontrakt je `schemaVersion 2.0.0`, popísaný v `docs/design/lane-b-handoff-20260905.md` §6.
Potrebné: ~10–20 skutočných Nordrive aplikácií s `externalReference` +
`saleorProductId` + `saleorVariantId` + `productKind` + aplikačné roky + kvalifikátory +
`verificationStatus` + `conditions[].text` per locale + `coverage.scope.programId`.

Kým nepríde: `PROVIDER_CONNECTED = NO`, `REAL_SNAPSHOT = NO`. **Nepredstieraj opak.**

### B3.4 Integrácia (dodáva B, zapája A)

Presné riadky sú v `docs/design/lane-b-handoff-20260905.md` §5. Zhrnutie:

- header `header-nav-row.tsx:48` → `VehicleSelectorLauncher variant="header"`
  (chip je **súrodenec** Suspense na r. 45-47 → vlastný async child s `connection()`,
  skeleton **pevnej šírky**, `layout.tsx:87` rezervuje `h-12`)
- hero `hero-section.tsx:25-31` → `variant="hero"` (zmizne aj `bg-amber-500`)
- PDP `CompatibilityBox` — ⚠️ **vnútri `<form action={addToCart}>`**; `SheetTrigger` je
  bezpečný (Radix hardcoduje `type="button"`), `<Button>` **nie je**
- PDP `ProductVehicleApplications` — `listProductApplications(product.id)` na serveri
- PLP: **tri** call sites `buildFilterVariables` (aj `collections/[slug]/page.tsx:181`)

⚠️ **Vehicle filter cez Saleor atribúty NEZAPÁJAJ.** Všetkých 8 slugov
(`vehicle-make`, `vehicle-model`, `vehicle-generation`, `year-from`, `year-to`,
`roof-type`, `bar-family`, `bar-color`) v Saleore **neexistuje**, a filter na
neexistujúci atribút vracia `totalCount: 0`, **nie chybu** — pre každé auto by to
ukázalo nula produktov. Cesta je CFM facets → Saleor ID → `filter:{ids:[…]}` (max 100).
Navyše product type `Roof Rack Bundle` má **nula atribútov**.

### B3.5 Až potom

- 12 trhov s neprázdnou ponukou (dnes sú zahraničné kanály prázdne)
- lokalizované route slugy (`/konfigurator` je slovenské slovo vo všetkých trhoch)
- boxy a nosiče lyží ako **odporúčané príslušenstvo** — kontrakt už rozlišuje typ,
  takže sa to nebude prerábať. **Teraz to neimplementuj.**
- account sync Garáže — mimo v1

---

## 9. Hranice

- **Nedeployuj**, nereštartuj PM2, nemeň `.env`, `/opt/storefront/.next` ani
  `maky-smtp-app`.
- **Nepublikuj produkty**, nerob Saleor/CFM zápisy, nemeň public flags.
- **Nedotýkaj sa vetiev A** ani `/opt/storefront`. Buildy iba v izolovanom worktree.
- **Neprepisuj checkout ani cart** (CLAUDE.md §10) — konfigurátor ich volá.
- Zverejnené produkty (boxy, nosiče lyží, 400+ SK sortiment) **nechaj v pokoji** —
  nepremenúvaj, nepreklasifikuj, nefiltruj kvôli chýbajúcemu fitmentu.
- Push vlastnej vetvy je povolený. Force push a reset cudzej práce nie.

---

## 10. Formát reportu

```
HEAD / remote (overené cez git ls-remote, nie tracking ref)
GUEST_GARAGE_FUNCTIONAL         = YES/NO  [FIXTURE|REAL]
CONFIGURATOR_FUNCTIONAL         = YES/NO  [FIXTURE|REAL]
PRODUCT_APPLICATIONS_FUNCTIONAL = YES/NO  [FIXTURE|REAL]
PROVIDER_CONNECTED              = YES/NO
REAL_SNAPSHOT                   = YES/NO
LIVE_OFFER                      = YES/NO
ACCOUNT_SYNC_IMPLEMENTED        = NO
PUBLIC_ACTIVATION_PERFORMED     = NO
brány: tsc / lint / i18n:check / test:run / build
screenshoty: desktop + 360 px, po odmietnutí nepovinných cookies
integračný SHA pre vlákno A
čo NIE JE overené a prečo
```

**Nepíš „všetky stavy fungujú" na základe zelenej suity.** Presne to bolo predtým
nepravdivé — build aj 109 testov boli zelené, kým bola funkcia vypnutá.

---

## 11. Čo si prečítať v repe (v tomto poradí)

1. `docs/design/lane-b-handoff-20260905.md` — self-contained, vrátane opráv podkladov
2. `src/lib/fitment/contract.ts` — hlavička vysvetľuje tri pravidlá, ktoré UI kazí
3. `src/lib/fitment/resolve.ts` — hlavička vysvetľuje asymetriu ÁNO/NIE/NEVIEM
4. `src/lib/fitment/offers.ts` — hlavička vysvetľuje štyri spôsoby, ako klamať
5. `CLAUDE.md` §4 (tokeny), §10 (zákazy), §11 (validácia), §13 (deploy)

Poznámka k CLAUDE.md: **§4.1, §4.2 a §12 sú zastarané.** shadcn bridge, `promo`, `brand`,
`overlay` **aj celá rodina `fitment-*`** už v `brand.css` existujú; súbor má 567 riadkov,
nie 463. `fitment-fits / -no-fit / -unconfirmed / -universal` (+ `-bg`) sú presne štyri
stavy z §7 a B je ich prvý konzument. **Nemajú `-border` variant** → `border-current`.
