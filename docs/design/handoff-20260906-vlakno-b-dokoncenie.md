# Vlákno B — dokončenie (handoff pre nové Claude Code vlákno)

Vytvorené 2026-09-06. Vlož celý prvý prompt z §12 ako prvú správu do nového vlákna.
Odpovedaj po slovensky.

---

## 0. Prvé tri vety

Si **vlákno B** storefrontu MAKY.STORE: výber vozidla, Garáž, konfigurátor strešných
nosičov, pravdivá komunikácia kompatibility. Vlákno A (katalóg, lokalizácia, SEO, košík)
je **hotové a nasadené** — do jeho vetiev, do `/opt/storefront` ani do produkcie nesiahaj.

B je **rebasnuté na nasadené A, prepojené na typovaný košík A a overené v prehliadači
nad produkčným buildom**. Reálna cesta (Saleor lookup → ponuka → add-to-cart) bola
dokázaná na troch skutočných produktoch. Chýba **iba** fitment snapshot z CFM a
**integrácia do plôch A** (header, hero, PDP, PLP). To je tvoja práca.

**Nezačínaj odznova.** Uzavreté rozhodnutia sú v §4 tohto dokumentu a v §5
`handoff-20260905-vlakno-b-pokracovanie.md`. Neotváraj ich.

---

## 1. Presný stav (overené 2026-09-06 cez `git ls-remote`)

|                  |                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| vetva B (platná) | `claude/sf-b-vehicles-continue-4f53aa`, posledný commit kódu `37f5306`, nad ním iba docs; tip over cez `git ls-remote`                      |
| základ           | `27b7088` = **produkcia** (branch `claude/sf-a-rc-20260905`, BUILD_ID `EeqdrEsFOEh2OMnTDHF03`)                                              |
| obsah            | 11 pôvodných commitov B + **4 commity kódu** (`b1e0395`, `bdb792b`, `d0896be`, `37f5306`) + docs                                            |
| stará vetva B    | `claude/sf-b-vehicles` @ `667c986` — **prekonaná**, história prepísaná rebase-om; nechaj ju tak (force push zakázaný), Marek ju môže zmazať |
| worktree         | `/opt/storefront/.claude/worktrees/sf-b-vehicles-continue-4f53aa` (má `.env`, `node_modules`, `src/gql`, `.next`)                           |
| nasadené z B     | **nič** — branch-only                                                                                                                       |
| Saleor           | Core 3.23.31, Dashboard 3.23.32, `https://api.maky.store/graphql/`                                                                          |
| katalóg `sk-eur` | **9 606** verejných produktov (2026-09-06 ráno); kategória „Nordrive strešné nosiče" **9 192** — CFM publikácia prebehla                    |

Posledné brány (nad `37f5306`, posledný commit kódu):

```
tsc 0 · lint 0 errors (6 warnings mimo B) · i18n:check OK · test:run 1391/1391 (92 súborov)
build exit 0, BUILD_ID aoD3z_gdlzK_44bGDzSJe (lokálny, nenasadený)
prehliadač nad tým buildom: desktop 1440 + 360 px, po odmietnutí cookies — konfigurátor aj garáž OK [FIXTURE]
```

Report (§10 formát): `GUEST_GARAGE_FUNCTIONAL = YES [FIXTURE]`,
`CONFIGURATOR_FUNCTIONAL = YES [FIXTURE]`, `PRODUCT_APPLICATIONS_FUNCTIONAL = YES [FIXTURE]`,
`PROVIDER_CONNECTED = NO`, `REAL_SNAPSHOT = NO`, `LIVE_OFFER = NO`,
`ACCOUNT_SYNC_IMPLEMENTED = NO`, `PUBLIC_ACTIVATION_PERFORMED = NO`.

---

## 2. Čo urobilo predchádzajúce vlákno (2026-09-05/06)

Detail je v `docs/design/lane-b-handoff-20260906.md`. Skratka:

1. **Rebase** 11 commitov B na `27b7088` cez cherry-pick (vetva `claude/sf-b-vehicles` je
   vysadená v inom worktree, preto nová vetva). Jediný konflikt `.env.example` (oboje),
   12 i18n katalógov sa zlúčilo samo. Codegen proti živej 3.23.31.
2. **`b1e0395`** — `src/lib/fitment/cart-actions.ts` volá `addVariantToCart` z A
   (`added | rejected | unconfirmed`). Zmazané `countLine()`, `addListingItemToCart`,
   FormData hop. Čistý mapper `src/lib/fitment/cart-result.ts` (mimo `"use server"`).
   `configurator-results.tsx` → `ResilientProductImage`.
3. **`bdb792b`** — pred-mutačné zlyhanie katalógu je `catalogue-unavailable` („skús znova"),
   `lookup-failed` („skontroluj košík") iba z `unconfirmed`. Nový kľúč
   `configurator.errorCatalogueUnavailable` ×12. Akcia odmieta cudzí `productKind`.
4. **`d0896be`** — `cfm_availability_mode` sa číta **z variantu, s fallbackom na produkt**
   (`FitmentProductsByIds.graphql` + `availabilityFrom(variantMode, productMode, qty)`).
   `offers.real.test.ts` (14) ženie reálnu vetvu cez mockovaný transport.
5. **`37f5306`** — `lookup-failed` sa renderuje ako neutrálny `role="status"` (ako A-ovský
   `CartForm`), klientský `startTransition` má `try/catch`.

**Reálna cesta dokázaná** (dočasný harness, zmazaný, necommitnutý):
`resolveFitmentOffers` na `UHJvZHVjdDo0ODE=/0ODI=/0ODM=` → 3 ponuky s cenou presného
variantu (245 / 121 / 87,99 €), `externalReference` zhodný s katalógom, identity mismatch
aj cudzí variant odmietnuté; `addVariantToCart(…NDgz, qty 1)` → `added`, read-back
`qty 1` v anonymnom checkoute. **Objednávka nevznikla.**

---

## 3. Overené fakty o živých dátach (neodvodzuj ich znova)

- **`cfm_availability_mode` žije na VARIANTE.** Starší katalóg: 100/100 variantov,
  0/100 produktov. Nordrive nosiče (všetkých 9 192): produkt AJ variant. Kód už číta
  variant → produkt. Kontrakt A (`lane-a-contracts-for-lane-b.md` §2) je splnený.
- `translation(SK).name` je `null` na Nordrive nosičoch → názov padá na `node.name`
  (slovenský). Na cudzom trhu je to porušenie kontraktu A §3 — viď §5 bod C.
- `isAvailable: false` pri `isAvailableForPurchase: true` na sale-to-order produktoch.
  `checkoutLinesAdd` riadok prijme. Offer vrstva `isAvailable` nečíta — správne.
- `quantityAvailable` je syntetický strop **50**, nie sklad. Iba tvrdá nula je fakt.
- Thumbnail: 481 z `cdn.maky.store`, 482/483 z `api.maky.store/thumbnail/…` (retryable
  vzor pre `ResilientProductImage`).
- `externalReference` tvar na nosičoch: `cfm:product:CFMP-B-NOR-<hash>-000000`.
- Saleor `productType.name = "Roof Rack Bundle"` na nosičoch — koroboruje, ale kontrakt
  vyžaduje `productKind` **zo zdroja fitmentu**, nie zo Saleoru ani zo slugu.
- 8 atribútových slugov `vehicle-*` / `roof-type` / `bar-*` v Saleore **neexistuje**;
  filter na ne vracia `totalCount: 0`, nie chybu.
- React error **#418** (hydration mismatch) je na každej stránke **aj na živej produkcii
  `maky.store/sk`** (#419 na PLP). Nie je z B.

---

## 4. Uzavreté rozhodnutia (nad rámec §5 predchádzajúceho handoffu)

| pravidlo                                                                                              | prečo                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `unconfirmed` → `lookup-failed`, renderované **neutrálne** (`role="status"`), tlačidlo ostáva aktívne | mutácia nie je idempotentná; červená „chyba" pozýva na druhý klik; A robí presne toto                                                           |
| pred-mutačné zlyhanie katalógu → `catalogue-unavailable` („skús znova")                               | nič sa neposlalo, košík sa nezmenil; „skontroluj košík" by bola nepravda                                                                        |
| `rejected/unavailable` → `not-available`, ostatné `rejected` → `cart-rejected`                        | A-ovský klasifikátor dáva `INSUFFICIENT_STOCK` do `unavailable`; bez zmeny A (§10) sa vypredanie od nepublikovania nerozlíši — vedome ponechané |
| metafield **variant → produkt**, nikdy naopak                                                         | CFM publikuje na variante; produkt je iba niekedy                                                                                               |
| `productKind` sa vynucuje aj v akcii (3. vrstva)                                                      | akcia je POST endpoint; disabled tlačidlo nie je kontrola                                                                                       |
| stará vetva `claude/sf-b-vehicles` sa neprepisuje                                                     | force push zakázaný; história prepísaná rebase-om                                                                                               |
| živý harness sa **nikdy necommituje**                                                                 | vytvára checkout v Saleore; fitment riadky pre reálne produkty sa nevymýšľajú ani do throwaway súborov                                          |

---

## 5. Čo zostáva — v tomto poradí

### A. B3.3 — reálny fitment snapshot z CFM (BLOKOVANÉ CFM, ale priprav sa)

Kontrakt `schemaVersion 2.0.0` je v `src/lib/fitment/contract.ts` a popísaný v
`lane-b-handoff-20260905.md` §6. CFM má dodať **read-only JSON snapshot** (~10–20
skutočných Nordrive aplikácií na začiatok), dostupný schválenou cestou (URL + token do
`MAKY_FITMENT_URL` / `MAKY_FITMENT_TOKEN`), so:

```
saleorInstance = "api.maky.store"        (validátor ho porovná s NEXT_PUBLIC_SALEOR_API_URL host)
coverage.scope.programId                 (napr. "nordrive-roof-racks")
makes / models / generations             (s qualifiers: roofTypes, bodyTypes, doors)
applications[]: generationId, yearFrom/yearTo, qualifiers, verificationStatus,
                conditions[].{code, text[locale]}, products[]:
                  externalReference, saleorProductId, saleorVariantId,
                  productKind ("roof-rack-set"), completeSet.includes[], facets
BEZ demoCatalogue, BEZ source.system = "fixture"   (inak je to demo a nekúpi sa)
```

Keď príde: `MAKY_FITMENT_PROVIDER=http MAKY_FITMENT_URL=… next start -p 3021`, overiť
`validateFitmentDataset` (warningy v logu), potom prehliadač: vybrať vozidlo zo snapshotu
→ ponuka musí ukázať **reálny** nosič s fotkou, cenou a „Na objednávku" → add-to-cart
→ `/sk/cart` má riadok. Až vtedy `PROVIDER_CONNECTED = YES`, `REAL_SNAPSHOT = YES`,
`LIVE_OFFER = YES`. Ak CFM pošle snapshot v inom tvare, **uprav validátor a testy, nie
pravidlá** (identita, kind, iba VERIFIED_FIT).

Dovtedy sa dá bez CFM urobiť všetko v B–E.

### B. B3.4 — integrácia do plôch A (dodáva B, presné body, overené na `2ec3dc4`)

1. **Header** — `src/ui/components/header/header-nav-row.tsx:48` renderuje A-ovský
   `<VehicleSelectorTrigger />` (`src/ui/components/header/vehicle-selector-trigger.tsx`):
   je to **mŕtve tlačidlo bez `onClick`**, ktoré je dnes v produkcii vidno vpravo hore.
   Nahraď ho `<VehicleSelectorLauncher variant="header" vehicleLabel={label} />`
   (`src/ui/components/vehicle/vehicle-selector-launcher.tsx` — jeho hlavička hovorí, že
   `header` variant reprodukuje triedy A-ovského tlačidla **presne**, takže swap je
   vizuálne no-op). Riadok 48 je **súrodenec** `<Suspense>` na r. 45–47; label vozidla
   vyžaduje cookie → vlastný async child s `connection()` (r. 20 už `connection()` volá
   pre celý row — over, či stačí) a skeleton **pevnej šírky**; `layout.tsx:87` rezervuje
   `h-12`. Po swape zmaž `vehicle-selector-trigger.tsx`, ak ho nič iné nepoužíva
   (`grep -rn VehicleSelectorTrigger src`).
2. **Hero** — `src/ui/components/homepage/hero-section.tsx:27-30`: amber tlačidlo
   `tf("selectVehicle")` bez akcie → `<VehicleSelectorLauncher variant="hero" />`
   (zmizne aj `bg-amber-500`; CLAUDE.md §4: amber = promo, nie akcia).
3. **PDP** — `src/ui/components/pdp/variant-section-dynamic.tsx:170` je
   `<CartForm action={addToCart}>`, `PurchaseTrust` na r. 195. `CompatibilityBox`
   (`src/ui/components/fitment/compatibility-box.tsx`, props `locale`, `isDemo`) musí byť
   **pri CTA** (CLAUDE.md §8). ⚠️ Vnútri formulára je bezpečný iba `SheetTrigger`
   (Radix `type="button"`); holý `<Button>` odošle formulár. Buď box mimo `<form>`, alebo
   iba SheetTrigger vnútri. Server-side: `loadFitmentDataset()` + `readActiveSelection()`
   - `resolveFitment(dataset, selection, { saleorProductId: product.id })` + `renderConditions`.
     Stavy podľa CLAUDE.md §8 sú už v `verdict-presentation.ts`.
4. **PDP applications** — `ProductVehicleApplications`
   (`src/ui/components/fitment/product-vehicle-applications.tsx`) s
   `listProductApplications(product.id)` (`src/lib/fitment/application-actions.ts`).
5. **PLP** — tri call sites `buildFilterVariables`: `products/page.tsx:109`,
   `categories/[slug]/page.tsx:202`, `collections/[slug]/page.tsx:181`. Cesta je
   **CFM facets → Saleor ID → `filter:{ids:[…]}` (max 100)**, t. j. `candidateProductRefs`
   / `resolveVehicleOutcome` pre aktívne vozidlo → `verified` refs → ids. ⚠️ **Vehicle
   filter cez Saleor atribúty NEZAPÁJAJ** (§3). Bez snapshotu sa dá zapojiť iba s
   fixture — v prehliadači to ukáže 0 reálnych produktov, čo je správne, nie chyba.
6. Po integrácii: `pnpm generate:routing` netreba (žiadne nové routy), ale **i18n parita
   B namespace 12/12** a **prehliadač nad `next build` + `next start`** — hydratácia
   `pnpm dev` v tomto worktree nefunguje (§6).

### C. Lokalizácia na dátovej hranici (kontrakt A §3) — pred prvým cudzím trhom

`src/lib/fitment/offers.ts:305` a `:309` robia `translation?.name ?? node.name`. Kontrakt
A hovorí: **A odmieta, nepadá späť** — `resolveExactLocaleProduct` z
`src/lib/saleor/exact-locale.ts` vráti `null`, ak preklad nie je kompletný, a slug je
jediná výnimka (URL, nie obsah). Zapracuj to v `offers.ts` hneď po fetchi (ako A v
`products/page.tsx:138`), nie v komponentoch. Dnes `MAKY_LIVE_MARKETS=sk`, takže to
nič živé nerozbíja — ale musí to byť hotové skôr, než sa spustí ďalší trh (B3.5).

### D. Testy a drobnosti z adverzárnej revízie (nedokončené nity)

- `src/lib/fitment/offers.real.test.ts:31-40`: `node()` fixture je netypovaný —
  otypuj ho proti `FitmentProductsByIdsQuery["products"]["edges"][number]["node"]`
  z `@/gql/graphql`, aby drift tvaru dotazu zhodil test.
- `cart-actions.composition.test.ts`: doplň prípady STALE / AMBIGUOUS / NO_FIT →
  `not-verified` a `PROVIDER_UNAVAILABLE` (dataset stale cez `generatedAt`).
- Test batchovania `resolveFitmentOffers` nad 100 refs (chunk + čiastočný `lookupFailed`).
- `src/ui/components/vehicle/garage-list.tsx:82`: na 360 px sa názov skracuje na
  „Škoda O…", lebo o šírku súperí chip „Aktívne vozidlo" a ikona odstránenia — kozmetika.
- `vehicle-selector-launcher.tsx:63` používa `forest-*` primitíva (zrkadlí A-ovský
  trigger). CLAUDE.md §4 chce semantické tokeny — ak meníš, zmeň launcher aj to, čím
  nahradíš trigger, nie iba jedno.

### E. Rozhodnutia pre Mareka (neurob ich sám)

1. **Nasadiť B pred snapshotom?** Bez `MAKY_FITMENT_PROVIDER` je konfigurátor „nevieme
   overiť" a bez `MAKY_GARAGE_COOKIE_SECRET` je garáž v produkcii **vypnutá (a povie to)**.
   Oba sú deploy krok, nie kód. Ak áno: secret ≥ 32 znakov do `/opt/storefront/.env`,
   `./scripts/ops/deploy-production.sh` (CLAUDE.md §13.2), **nikdy ručne**.
2. **Lokalizované route slugy** (`/konfigurator` je slovenské slovo vo všetkých trhoch).
3. **Zmazať `claude/sf-b-vehicles`** (prekonaná).
4. **Follow-upy pre A** (nie B): mŕtvy `addListingItemToCart` wrapper + nepravdivý
   komentár v `src/ui/components/plp/actions.ts:314-318`; React #418 na produkcii;
   en-CA parita (212 kľúčov `cart.*`/`checkout.*`, pre-existujúce).

### F. Až potom (B3.5)

12 trhov s neprázdnou ponukou · boxy a nosiče lyží ako odporúčané príslušenstvo (kontrakt
už rozlišuje `productKind`, neprerába sa) · account sync Garáže — mimo v1.

---

## 6. Pasce (tie z predchádzajúceho handoffu §6 platia; toto sú nové)

1. **`pgrep -f '<vzor>'` zabije tvoj vlastný shell**, ak sa vzor vyskytne kdekoľvek v
   príkaze (napr. v `rm -rf …cdp-profile-9333` ďalej v tom istom riadku) — exit 144.
   Zabíjaj `pgrep -x chrome` alebo PID z `ss -tlnp`.
2. **Chromium JE na boxe** napriek staršej poznámke, že nie:
   `/home/ubuntu/.cache/ms-playwright/chromium-1187/chrome-linux/chrome` (Chromium 140,
   aarch64). Recept je v §8.
3. `Runtime.evaluate` reťazec z JS template literalu: `"\n"` sa stane surovým riadkom
   v stringu na strane stránky → `SyntaxError`. Píš `"\\n"`.
4. **Prettier v pre-commit hooku preformátuje markdown tabuľky** (šírky stĺpcov). Patch
   dokumentu rob po riadkoch (`startswith`), nie presnou zhodou celej tabuľky.
5. `next start` nad `.next`, ktorý medzitým prebuduješ, servíruje rozbité chunky — aj
   lokálne. Pred `pnpm build` zastav server na 3021 (PID z `ss -tlnp`).
6. **Workflow agentov je drahý:** 5 šošoviek × 2 refutéri × strop 10 = až 25 agentov na
   beh, box púšťa 2 naraz, beh trvá 20+ minút a prvý padol na limit session. Dve reálne
   chyby to našlo, ale rovnaký výsledok dá jedna šošovka na diff + vlastné overenie.
   **Bez výslovného pokynu Mareka workflow nespúšťaj.**
7. Katalóg má teraz 9 606 produktov — `products(first:100, filter:{ids})` je stále
   správna cesta; nikdy nelistuj celý katalóg kvôli fitmentu.

---

## 7. Konfigurácia

```
MAKY_FITMENT_PROVIDER=off|fixture|http   NEUVEDENÉ = OFF = funkcia mlčí (bezpečný default)
MAKY_FITMENT_URL=            iba pre http
MAKY_FITMENT_TOKEN=          server-only
MAKY_FITMENT_TIMEOUT_MS=5000
MAKY_FITMENT_REVALIDATE_SECONDS=300
MAKY_GARAGE_COOKIE_SECRET=   BEZ NEHO JE GARÁŽ V PRODUKCII VYPNUTÁ (a povie to); ≥ 32 znakov
```

V produkčnom `.env` **nie je nič z toho** (iba `MAKY_FORMS_HMAC_SECRET`, `MAKY_LIVE_MARKETS=sk`).
Worktree `.env` je kópia z `/home/ubuntu/maky-worktrees/storefront-b/.env` (rovnaké mená
ako produkcia, žiadne B kľúče) — B premenné dávaj **na príkazový riadok** `next start`.

---

## 8. Ako overovať

**Brány:** `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm i18n:check` · `pnpm test:run` ·
`pnpm build` (iba v tomto worktree, **nikdy v `/opt/storefront`**). Po zmene `.graphql`
**`pnpm generate`** (a `pnpm generate:all` po prepnutí základu).

**Prehliadač (akceptácia):**

```
MAKY_FITMENT_PROVIDER=fixture MAKY_GARAGE_COOKIE_SECRET=<40 znakov> \
  setsid nohup pnpm exec next start -p 3021 > /tmp/…/next.log 2>&1 &
chrome --headless=new --remote-debugging-port=9333 --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --window-size=1440,900 --user-data-dir=/tmp/claude-1000/cdp-profile-9333 about:blank
GET http://127.0.0.1:9333/json/list → webSocketDebuggerUrl → Page.enable/Runtime.enable/Network.enable
Page.navigate + Page.loadEventFired · Runtime.evaluate(returnByValue) · Input.dispatchMouseEvent
(mouseMoved/mousePressed/mouseReleased na stred getBoundingClientRect) ·
Page.captureScreenshot{captureBeyondViewport:true} · Emulation.setDeviceMetricsOverride{width:360,mobile:true}
```

Scenár, ktorý prešiel: `/sk/konfigurator` → „Odmietnuť všetko" → „Vyberte vaše vozidlo" →
Škoda → Octavia → IV (NX) → 2022 → Integrované pozdĺžniky → Kombi → „Potvrdiť vozidlo" →
3 demo zostavy (2× „Overené pre vaše vozidlo", 1× „Overené s podmienkami"), odznaky
„Kompletná zostava" + „Ukážka", „V ukážke sa nedá nakupovať" disabled, žiadna reálna
značka v DOM → `/sk/garage` 1 z 3. Cookie `maky-garage` httpOnly + SameSite=Lax.
Profil (`--user-data-dir`) drží consent aj cookie — pred behom ho zmaž.

**Živý harness reálnej cesty** (ak treba znovu): dočasný `*.live.test.ts` pod `src/`,
`vi.mock("next/headers")` s in-memory cookie jar, `vi.mock("next/cache")`,
`NEXT_PUBLIC_SALEOR_API_URL=… pnpm exec vitest run <súbor> --testTimeout=90000`.
Vytvorí anonymný checkout — **objednávku nikdy**; súbor po behu **zmaž**.

---

## 9. Hranice

Nedeployuj, nereštartuj PM2, nemeň `/opt/storefront/.env`, `/opt/storefront/.next` ani
`maky-smtp-app`. Nepublikuj produkty, nerob Saleor/CFM zápisy (anonymný checkout v
harnesse je jediná tolerovaná výnimka, bez objednávky). Nedotýkaj sa vetiev A. Neprepisuj
checkout ani cart (CLAUDE.md §10). Zverejnený sortiment nechaj v pokoji. Buildy iba v
izolovanom worktree. Push vlastnej vetvy povolený; force push a reset cudzej práce nie.
Fitment pre reálne produkty **nevymýšľaj** — ani do testov, ani do throwaway súborov.

---

## 10. Formát reportu

```
HEAD / remote (git ls-remote, nie tracking ref)
GUEST_GARAGE_FUNCTIONAL         = YES/NO  [FIXTURE|REAL]
CONFIGURATOR_FUNCTIONAL         = YES/NO  [FIXTURE|REAL]
PRODUCT_APPLICATIONS_FUNCTIONAL = YES/NO  [FIXTURE|REAL]
HEADER_HERO_INTEGRATED          = YES/NO
PDP_INTEGRATED                  = YES/NO
PLP_INTEGRATED                  = YES/NO
PROVIDER_CONNECTED              = YES/NO
REAL_SNAPSHOT                   = YES/NO
LIVE_OFFER                      = YES/NO
ACCOUNT_SYNC_IMPLEMENTED        = NO
PUBLIC_ACTIVATION_PERFORMED     = NO
brány: tsc / lint / i18n:check / test:run / build (+ BUILD_ID)
screenshoty: desktop + 360 px, po odmietnutí nepovinných cookies
čo NIE JE overené a prečo
```

Nepíš „všetky stavy fungujú" na základe zelenej suite. Akceptácia je prehliadač nad
produkčným buildom. Hlás priebežne iba zmenu, nález alebo blocker.

---

## 11. Čo si prečítať (v tomto poradí)

1. tento dokument
2. `docs/design/lane-b-handoff-20260906.md` — čo presne sa zmenilo a čo bolo dokázané naživo
3. `docs/design/lane-a-contracts-for-lane-b.md` — kontrakty A (§1 splnený, §2 splnený, **§3 otvorený**)
4. `docs/design/handoff-20260905-vlakno-b-pokracovanie.md` §5 (uzavreté rozhodnutia) a §6 (pasce)
5. `docs/design/lane-b-handoff-20260905.md` §5 (integračné body) a §6 (kontrakt pre CFM)
6. `src/lib/fitment/contract.ts`, `resolve.ts`, `offers.ts`, `cart-actions.ts`, `cart-result.ts` — hlavičky
7. CLAUDE.md §4, §8, §10, §11, §13

---

## 12. Prvý prompt pre nové vlákno

```
# MAKY.STORE — vlákno B, dokončenie (integrácia vozidiel do plôch A)

Odpovedaj po slovensky.

## Kto si

Si vlákno B storefrontu MAKY.STORE: výber vozidla, Garáž, konfigurátor strešných
nosičov, pravdivá komunikácia kompatibility. Vlákno A je HOTOVÉ a NASADENÉ — do jeho
vetiev, do /opt/storefront ani do produkcie nesiahaj.

## Prvý krok — prečítaj si handoff

Vetva claude/sf-b-vehicles-continue-4f53aa — tip over cez git ls-remote (posledný
commit KÓDU je 37f5306; nad ním sú iba docs commity).
Worktree /opt/storefront/.claude/worktrees/sf-b-vehicles-continue-4f53aa
(má .env, node_modules, src/gql aj .next; ak vytváraš nový worktree, potrebuješ
pnpm install --frozen-lockfile a pnpm generate:all).

    docs/design/handoff-20260906-vlakno-b-dokoncenie.md

Je self-contained. Prečítaj ho CELÝ, potom položky z jeho §11 v uvedenom poradí.
NEZAČÍNAJ ODZNOVA a neotváraj uzavreté rozhodnutia (§4 tam, §5 v predchádzajúcom
handoffe). Stará vetva claude/sf-b-vehicles je prekonaná — nepracuj z nej.

## Stav (2026-09-06)

B je rebasnuté na nasadené A (27b7088), prepojené na typovaný add-to-cart A,
cfm_availability_mode sa číta z variantu, brány zelené (1391 testov, build OK),
prehliadač nad produkčným buildom prešiel na desktope aj 360 px. Reálna cesta
(Saleor lookup → ponuka → add-to-cart) je dokázaná na troch skutočných Nordrive
nosičoch. Katalóg má 9 606 verejných produktov. Fitment snapshot z CFM ešte NIE JE —
PROVIDER_CONNECTED = NO, REAL_SNAPSHOT = NO, a bez snapshotu to tak zostane.

## Tvoje úlohy (v tomto poradí, presné body sú v handoffe §5)

1. B3.4 integrácia do plôch A:
   a) header: nahraď mŕtvy A-ovský VehicleSelectorTrigger (header-nav-row.tsx:48)
      za VehicleSelectorLauncher variant="header" (vizuálne no-op, ale funkčný);
   b) hero: amber tlačidlo v homepage/hero-section.tsx:27-30 → variant="hero";
   c) PDP: CompatibilityBox pri CTA (variant-section-dynamic.tsx:170 je <CartForm>;
      vnútri formulára je bezpečný iba SheetTrigger) + ProductVehicleApplications;
   d) PLP: tri call sites buildFilterVariables, cesta CFM facets → Saleor ID →
      filter:{ids} (max 100). Vehicle filter cez Saleor atribúty NEZAPÁJAJ.
   Každý bod: malý commit, tsc/lint/i18n/test/build, prehliadač nad next build +
   next start -p 3021 (desktop + 360 px, po odmietnutí cookies). pnpm dev
   v tomto worktree nehydratuje.
2. Lokalizácia na dátovej hranici (kontrakt A §3): offers.ts:305/309 `??` fallback
   → resolveExactLocaleProduct z src/lib/saleor/exact-locale.ts. Nesmie sa dostať
   slovenský názov na cudzí trh.
3. Nity z revízie (handoff §5 D): otypovať node() v offers.real.test.ts proti
   generovanému typu, doplniť STALE/AMBIGUOUS/NO_FIT prípady, test batchovania >100.
4. Ak medzitým CFM dodá snapshot: handoff §5 A — napoj cez MAKY_FITMENT_PROVIDER=http,
   over v prehliadači reálnu ponuku a add-to-cart (bez objednávky), až potom prepni
   flagy v reporte.

## Hranice

Nedeployuj. Nereštartuj PM2. Nemeň /opt/storefront/.env, /opt/storefront/.next ani
maky-smtp-app. Nepublikuj produkty, nerob Saleor/CFM zápisy. Nedotýkaj sa vetiev A.
Neprepisuj checkout ani cart (CLAUDE.md §10). Buildy iba v izolovanom worktree
(CLAUDE.md §13.1). Push vlastnej vetvy povolený; force push nie. Fitment pre reálne
produkty NEVYMÝŠĽAJ. Rozhodnutia z handoffu §5 E (deploy B, route slugy, zmazanie
starej vetvy) nerob sám — vypýtaj si ich. Workflow s viacerými agentmi nespúšťaj
bez môjho výslovného pokynu.

## Ako hlásiť

Formát reportu je v handoffe §10. Nepíš „všetky stavy fungujú" na základe zelenej
suite; akceptácia je prehliadač nad produkčným buildom. Priebežne hlás iba zmenu,
nález alebo blocker.

Začni prečítaním handoffu a overením SHA cez git ls-remote.
```
