# Vlákno B — odovzdanie (2026-09-05)

Vetva: `claude/sf-b-vehicles` @ `882ca71`, odbočená z Legal `a4d78cb`. S1 nemergované.
Branch-only. Nič nasadené, produkcia nedotknutá.

---

## 1. Stav podľa požadovaného formátu

```
GUEST_GARAGE_FUNCTIONAL         = YES   [FIXTURE]
CONFIGURATOR_FUNCTIONAL         = YES   [FIXTURE]
PRODUCT_APPLICATIONS_FUNCTIONAL = YES   [FIXTURE]   (komponent hotový, zapája A — viď §3)
PROVIDER_CONNECTED              = NO
ACCOUNT_SYNC_IMPLEMENTED        = NO
PUBLIC_ACTIVATION_PERFORMED     = NO
```

**Ceny, dostupnosť, varianty a add-to-cart sú REAL_DATA** — proti živému `sk-eur`.
Fixture je iba **fitment** (ktoré auto ku ktorému produktu). Preto `PROVIDER_CONNECTED = NO`.

---

## 2. Čo zákazník dokáže urobiť

Vybrať auto (značka → model → generácia → rok → typ strechy/karosérie), uložiť si ho do
garáže na `/{market}/garage`, prepínať medzi max. 3 autami, a na `/{market}/konfigurator`
vidieť kompatibilné kompletné zostavy s reálnou cenou a reálnym tlačidlom do košíka.

Overené v prehliadači proti **produkčnému buildu** (nie dev serveru), celý reťazec:
prázdna garáž → otvorenie selectora → 4 kroky → potvrdenie → uložené auto → `VERIFIED_FIT`
→ 2 zostavy s cenami 269,00 € a 101,48 €.

---

## 3. Integračné body pre vlákno A

**A nič z tohto nemusí prepisovať — sú to jednoriadkové zámeny.**

### 3.1 Header (`header-nav-row.tsx:48`)

```diff
- <VehicleSelectorTrigger />
+ <VehicleSelectorLauncher variant="header" vehicleLabel={label} />
```

`variant="header"` reprodukuje triedy pôvodného tlačidla **presne**, takže zámena je
vizuálne no-op. Import: `@/ui/components/vehicle/vehicle-selector-launcher`.

⚠️ `vehicleLabel` sa číta z cookie, takže to je **request-time**. Chip na r. 48 je
**súrodenec** `<Suspense>` na r. 45-47, nie je v ňom — potrebuje vlastný async child
s `await connection()` vo vlastnej Suspense hranici. Skeleton daj **pevnej šírky**:
`(main)/layout.tsx:87` rezervuje pre ten riadok `h-12` a CLS tam už raz bol incident.

Label získaš cez:

```ts
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { readGarage } from "@/lib/garage/state";
const { dataset } = await loadFitmentDataset();
const g = await readGarage(dataset);
const label =
	g.active && !g.active.unresolved
		? [g.active.makeName, g.active.modelName, g.active.generationName].filter(Boolean).join(" ")
		: null;
```

### 3.2 Hero (`hero-section.tsx:25-31`)

Druhé mŕtve tlačidlo. Nahraď `<VehicleSelectorLauncher variant="hero" />`.
Pri tom zmizne aj `bg-amber-500` — raw palette literál, ktorý CLAUDE.md §4 zakazuje.

### 3.3 PDP — CompatibilityBox (`variant-section-dynamic.tsx`, pre-merge r. 181)

```tsx
<CompatibilityBox
	result={result} // resolveFitment(dataset, selection, { saleorProductId })
	vehicleLabel={label}
	isFixture={status.isFixture}
	action={<VehicleSelectorLauncher variant="inline" vehicleLabel={label} />}
/>
```

⚠️ **Toto miesto je VNÚTRI `<form action={addToCart}>`** (form sa otvára na r. 172).
`button.tsx` nenastavuje default `type`, takže akýkoľvek `<Button>` tam **submitne formulár
a pridá produkt do košíka**. `SheetTrigger` je bezpečný (Radix hardcoduje `type="button"`
a cez `asChild` ho prepošle), takže `VehicleSelectorLauncher` tam smie byť — čokoľvek iné
si over. Lint, tsc ani build to nezachytia.

Pozn.: `<PurchaseTrust>` je na r. **197**, nie 196 (196 je jeho wrapper `<div>`).

### 3.4 PDP — zoznam vozidiel (`[productSlug]/page.tsx`, za r. 323 post-merge / 319 pre-merge)

```tsx
const initial = await listProductApplications(product.id); // server
<ProductVehicleApplications saleorProductId={product.id} initial={initial} />;
```

Prvá strana sa renderuje zo servera, ďalšie a hľadanie idú cez server action — zoznam
tisícov vozidiel sa nedostane do počiatočného HTML.

### 3.5 PLP filter podľa vozidla — **NEROB TO CEZ SALEOR ATRIBÚTY**

Toto je oprava podkladov, nie detail. `filter-utils.ts:30-38` deklaruje
`vehicle-make`, `vehicle-model`, `vehicle-generation`, `year-from`, `year-to`,
`roof-type`, `bar-family`, `bar-color` — **ani jeden z tých ôsmich atribútov v živom
Saleore neexistuje.** Overené introspekciou: 79 atribútov, žiadny z nich.

A filter na neexistujúci atribút **nevyhodí chybu — vráti `totalCount: 0`**:

```
products(channel:"sk-eur")                                          → 414
products(channel:"sk-eur", filter:{attributes:[{slug:"vehicle-make", values:["skoda"]}]}) → 0
products(channel:"sk-eur", filter:{attributes:[{slug:"manufacturer", values:["nordrive"]}]}) → 20
```

Takže zapojenie `attributeFilters` s vehicle slugmi by pre **každé** auto ukázalo nula
produktov a čítalo by sa to ako „na vaše auto nič nepasuje". Cesta je CFM facets →
Saleor ID → `filter:{ids:[…]}`, presne ako to robí `resolveFitmentOffers`.

**Tretie call site, ktoré podklady nespomínajú:** `collections/[slug]/page.tsx:181`
(k `categories/[slug]/page.tsx:199` a `products/page.tsx:85-88`). Widen aj jeho
`searchParams` typ (`:68-75`), inak collections PLP filtre ticho ignoruje.

### 3.6 Route policy — už hotové

`/garage` aj `/konfigurator` sú zaregistrované všetkými tromi krokmi (page →
`generate:routing` → `ROUTE_POLICY`). `route-policy.test.ts`, `routing-generated.test.ts`
aj `proxy.gate.test.ts` prechádzajú. **A nemusí robiť nič.**

Segmenty sú slovenské slová (`konfigurator`) vo všetkých trhoch — lokalizované route
slugy sú otvorená otázka pre vlastníka tvaru URL, nie pre B.

---

## 4. Konfigurácia (deploy krok, nie kód)

```bash
MAKY_FITMENT_PROVIDER=fixture|http|off   # NEUVEDENÉ = off = garáž aj konfigurátor mlčia
MAKY_FITMENT_URL=...                     # iba pre http
MAKY_FITMENT_TOKEN=...                   # voliteľné, server-only
MAKY_GARAGE_COOKIE_SECRET=...            # BEZ NEHO JE GARÁŽ V PRODUKCII VYPNUTÁ
```

`MAKY_GARAGE_COOKIE_SECRET` **nie je** v `/opt/storefront/.env`. Bez neho v produkcii
`resolveGarageMode()` vráti `disabled`, garáž sa nerenderuje ako prázdna ale ako
**nenakonfigurovaná** — a povie to. Mimo produkcie funguje nepodpísaná.

Forms secret sa **nepoužíva**. `MAKY_FORMS_HMAC_SECRET` autorizuje zápis §20a odstúpenia;
tajomstvo, ktoré dokáže toto, nesmie zároveň hovoriť, aké má niekto auto.

---

## 5. Požiadavky na CFM

1. **`saleorProductId` + `saleorVariantId` v fitment indexe**, popri `externalReference`.
   Živý Saleor nemá hromadný filter podľa `externalReference` (overené introspekciou
   `ProductWhereInput` aj `ProductFilterInput`) — bulk ide iba cez `ids:`, a strop je
   `first: 100`. ID sú viazané na inštanciu, preto dataset nesie `saleorInstance` a
   validátor odmietne nesúlad.

2. **`translation.slug` pri každom preklade.** `slugLanguageCode` nerobí fallback na
   base slug — preklad bez slugu je horší než žiadny.

3. **Stabilné media ID** pre lokalizovaný ALT (kľúčovanie poradím sa rozpadne).

4. **OPRAVA PODKLADOV — typová migrácia 39 PLAIN_TEXT atribútov NIE JE potrebná.**
   PLAIN_TEXT **sa filtrovať dá**, len nie starou cestou:

   ```
   filter:{attributes:[{slug:"material", values:["ABS plast"]}]}          → 0     ← pasca
   where:{attributes:[{slug:"material", value:{name:{eq:"ABS plast"}}}]}  → 21    ← funguje
   ```

   Legacy cesta vráti 0 (alebo 1 pri per-assignment hodnote), čo vyzerá ako „nefunguje to".
   `where` + `value.name.eq` / `oneOf` funguje a sedí s census-om katalógu.
   **Pozor:** `eq` je case-sensitive a katalóg už obsahuje case-varianty tej istej
   hodnoty (`rýchloupínací systém` vs `Rýchloupínací systém`, 9 + 9 produktov) — naivné
   facetovanie ich rozdelí na dve.

---

## 6. Opravy podkladov (overené, nie odhadnuté)

| tvrdenie v podkladoch                                                            | realita                                                                                                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| „forms/signature.ts sa nedá použiť, 300 s skew"                                  | **Nepresné.** `maxSkewSeconds` je per-call parameter s defaultom 300, nie konštanta. Dôvod nepoužiť ho je **oddelenie účelu secretu**, nie skew. |
| „vehicle filter variables sú hotové, treba len zapojiť"                          | **Zapojenie by klamalo.** Všetkých 8 atribútov v Saleore chýba, filter vráti 0 pre každé auto.                                                   |
| „2 call sites `buildFilterVariables`"                                            | **3** — pribúda `collections/[slug]/page.tsx:181`.                                                                                               |
| „5 vehicle attribute slugov"                                                     | **8** — plus `roof-type`, `bar-family`, `bar-color`.                                                                                             |
| „39 PLAIN_TEXT je nefiltrovateľných"                                             | **Filtrovateľné cez `where` + `value.name`.** Viď §5.4.                                                                                          |
| „promo je jediná chýbajúca sémantická kategória" (CLAUDE.md §4.1)                | **Zastarané.** `promo`, shadcn bridge, `brand`, `overlay` aj **celá `fitment-*` rodina** už existujú v `brand.css`.                              |
| „SheetTrigger vo forme spustí add-to-cart"                                       | **Nie.** Radix hardcoduje `type="button"`. Nebezpečný je `<Button>`, nie `SheetTrigger`.                                                         |
| „i18n parity musí byť 12/12 identických" (CLAUDE.md §11)                         | **Už na `a4d78cb` neplatí.** en-CA chýba 212 kľúčov, ostatných 10 po 1 (`checkout.summary.vatIncluded`, pridal ho sám HEAD). Nezhoršené.         |
| „`page(slugLanguageCode:)` Saleor nevie" (komentár v `pages/[slug]/page.tsx:34`) | Komentár je nesprávny, API to vie.                                                                                                               |
| „limit 5/6 obrázkov v galérii"                                                   | Neexistuje (potvrdené).                                                                                                                          |
| `<PurchaseTrust>` na r. 196                                                      | Na r. **197**; 196 je wrapper div.                                                                                                               |

**A jedna vec, ktorú podklady nespomínajú vôbec:** `next-intl` tu **nehádže výnimku** pri
chýbajúcom kľúči. `src/i18n/request.ts` deep-merguje en-US pod každý locale, takže
chýbajúci kľúč vyrenderuje **angličtinu**, nie cestu kľúča. To je horšie, nie lepšie —
nemecká stránka s anglickým textom vyzerá zámerne.

---

## 7. Známé obmedzenia

- **Fitment dáta sú vymyslené.** Fixture je označená v `source.system`, v `datasetVersion`
  (`fixture-…`) a **viditeľne v UI** pri každom verdikte. Provider je defaultne vypnutý.
- **`addListingItemToCart` neinšpektuje `checkoutLinesAdd.errors`**, takže Saleor doménová
  chyba (sklad, variant mimo kanála) vyzerá ako úspech. `addConfiguredSetToCart` preto
  pred pridaním overuje predajnosť a sklad sám a vracia výsledok. Prepisovať checkout
  som nesmel (§10) — je to zapísané ako obmedzenie.
- **Viacriadkové zostavy nejdú.** Mutácia pridáva jeden riadok na volanie a nemá per-line
  signál úspechu, takže čiastočné pridanie sa nedá rollbacknúť. v1 = jedna sada = jeden
  variant, čo tento problém obchádza.
- **Anonymný rate-limit na server actions nie je.** Selector actions sú read-only nad
  datasetom, ale sú volateľné priamo.
- **Header trigger používa raw `forest-*` primitívy** (CLAUDE.md §4). Zachované zámerne,
  aby zámena bola vizuálne no-op — nie moja plocha na redesign.

---

## 8. Validácia

```
pnpm test:run          66 súborov / 1076 testov  (base: 61 / 982 → +5 / +94)
pnpm exec tsc --noEmit 0 chýb
pnpm lint              0 errors, 6 warnings — všetky v súboroch, ktorých som sa nedotkol
pnpm i18n:check        commerce i18n closure OK · locale matrix OK (12 locales)
pnpm build             exit 0, 0 × "use server" chýb
```

Prehliadač: produkčný build (`next start`), desktop 1280 aj mobil 360 px, bez
vodorovného pretečenia. Overené stavy: `VERIFIED_FIT`, `NO_FIT` (explicitný negatív aj
absencia pri úplnom pokrytí), `UNKNOWN` (provisional, year-hold, mimo pokrytia),
`AMBIGUOUS` (konflikt aj nezodpovedaný kvalifikátor), kompatibilné-ale-nepredajné,
a 4 varianty poškodenej cookie (podvrh, junk, `%`, prázdna) — všetky 200 a prázdny stav,
žiadna 500.

**Najdôležitejší dôkaz:** to isté auto, ten istý fixture, dva trhy —
`sk` 2 zostavy, `de` 0 a hláška „kompatibilné zostavy existujú, ale nie sú v predaji".
Živý Saleor to potvrdzuje: tie ID majú `totalCount` 2 v `sk-eur` a 0 v `de-eur`.

---

## 9. Poznámka pre toho, kto bude ladiť dev server

`pnpm dev` (webpack) v tomto worktree **nehydratuje** — žiadny `<button>` nedostane
`__reactProps`, takže nefunguje ani existujúci PLP filter Sheet, nielen môj selector.
Nie je to regresia tejto vetvy. Všetko vyššie je overené proti `next build` + `next start`.
