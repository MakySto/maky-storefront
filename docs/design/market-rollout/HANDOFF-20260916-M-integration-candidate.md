# ⭐ M · COMMERCE-2 — GO-M-PATCH nasadený, integračný kandidát M1–M6 pripravený

Napísané 16. 9. 2026 vo vlákne `m-vlakno-storefront-continue` podľa `MAKY_M_DEPLOY_A_INTEGRACIA_20260916.md`
a spoločného kontraktu CFM ↔ M. **Nahrádza** `HANDOFF-20260916-ENTRY-M-NEXT-THREAD.md` §1 a
`HANDOFF-20260916-M-commerce2-storefront.md` §6 (revalidácia) a §9 (body 1–4) — tie platili pred týmto vláknom.
Všetko označené „zmerané" je zmerané na tomto stroji. Do produkčného Saleoru ani CFM sa nič nezapisovalo.

---

## 0. Stav v skratke

|                            |                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Produkcia**              | **`be0f795`** (kód `41cc44e`), BUILD_ID **`SKH7DHo8A1X7cxZx1zsi0`**, 16. 9. 13:07 UTC, odstávka 76 s — záznam ENTRY §0                           |
| **Revalidácia**            | **zapnutá** 13:10 UTC (`REVALIDATE_SECRET`, 64 hex, nevypísaný); 401/401/200 + `success` + tag overené lokálne aj cez maky.store                 |
| **Integračný kandidát**    | vetva `claude/m-vlakno-storefront-continue-c6ad59`, **kód `4299aa2`**, pushnutý, **NENASADENÝ** (potrebuje GO)                                   |
| Testy kandidáta            | vitest **2 135 passed / 34 skipped** (137 súborov; na `41cc44e` 2 012 / 28); acceptance nad `.2` **33/33, nič preskočené**; tsc 0; eslint 0 chýb |
| Build + lokálny smoke      | `pnpm build` 34 s exit 0; `next start` + read-only proxy pred produkčným Saleorom, `MAKY_SALEOR_WRITES=block`                                    |
| `MAKY_LIVE_MARKETS` (prod) | nezmenené: `sk`                                                                                                                                  |
| Zahraničné kanály          | 0 verejných produktov (zmerané anonymne, 12/12 kanálov)                                                                                          |

Commity kandidáta nad produkciou `be0f795`:

| commit    | čo                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------- |
| `c4f4016` | docs: záznam GO-M-PATCH                                                                              |
| `821dfd1` | **M4** tag `fitment-offers:{kanál}:{locale}`, odmietnutie neznámeho kanála (400)                     |
| `0c3fcc3` | docs: locale matrix `EN` pre US/CA (od `41cc44e` padal `pnpm i18n:check`)                            |
| `faad53a` | **M2** namespace `catalog` (10 kľúčov × 12 jazykov), SK bajtovo rovnaké                              |
| `37b0588` | **M1** lokalizované korene, aliasy 301, požičané stránky, brána existencie, kanonická URL Nordrive   |
| `c8fd4f3` | **M5** sitemap index + shardy, deploy brána a `check:published` cez index, hreflang na úrovni entity |
| `3b7b145` | **M3** field contract + read-back fixture + acceptance                                               |
| `4299aa2` | **M6** payment canary skript (nespustený; nemá cestu k platbe)                                       |

---

## 1. M1 — lokalizované korene (kanonické v zahraničí, SK bez zmeny)

**Jedna mapa:** `src/config/category-routes.ts` — trh → kanál → market locale → editorial language → Saleor ID +
base slug → kanonický segment. `categoryRouteTable()` vráti 24 riadkov (12 trhov × 2 entity).

| entita                            | Saleor             | umiestnenie               | sk                      | cs                      | de (de, at)          | pl                         | hu                        | it                        | fr                      | es                       | ro                         | en (us, ca)         |
| --------------------------------- | ------------------ | ------------------------- | ----------------------- | ----------------------- | -------------------- | -------------------------- | ------------------------- | ------------------------- | ----------------------- | ------------------------ | -------------------------- | ------------------- |
| `stresne-nosice`                  | `Q2F0ZWdvcnk6Mg==` | koreň `/{trh}/{seg}`      | stresne-nosice          | stresni-nosice          | dachtraeger          | bagazniki-dachowe          | tetocsomagtartok          | barre-portatutto          | barres-de-toit          | barras-de-techo          | bare-transversale          | roof-racks          |
| `nordrive-stresne-nosice` (dieťa) | `Q2F0ZWdvcnk6NQ==` | `/{trh}/categories/{seg}` | nordrive-stresne-nosice | nordrive-stresni-nosice | nordrive-dachtraeger | nordrive-bagazniki-dachowe | nordrive-tetocsomagtartok | nordrive-barre-portatutto | nordrive-barres-de-toit | nordrive-barras-de-techo | nordrive-bare-transversale | nordrive-roof-racks |

**Identita = base slug.** Saleor, cache tagy a fitment polica dostávajú vždy `stresne-nosice`; lokalizovaný segment je iba
verejný pravopis. Preložený `slug`, ktorý CFM zapíše do Saleoru, na routovanie **nepoužívame** (preklep v Saleore by ticho
presunul URL) — kontrola preloženého slugu po APPLY je v §11 bod 3.

**Proxy (`src/proxy.ts`), poradie:**

1. `/{trh}/categories/{base alebo lokalizovaný}` → **308** priamo na kanonický koreň trhu (`/cz/categories/stresne-nosice` → `/cz/stresni-nosice`, jeden skok). SK bez zmeny.
2. `/{trh}/categories/nordrive-stresne-nosice` v cudzom trhu → **301** `/{trh}/categories/nordrive-<koreň>`.
3. RETIRED VEHICLE PAGE (40 pravidiel RELEASE-4) — bez zmeny, beží pred aliasmi.
4. **Alias:** `/{trh}/stresne-nosice/…` v cudzom trhu → **301** `/{trh}/{lokalizovaný}/…`, query ostáva, `.rsc` → čistá stránka;
   cieľ, ktorý je sám retired, ide rovno na náhradu. **Výnimka:** 3 požičané stránky (§1.1) ostávajú; ich lokalizovaný
   pravopis ide 301 na ne.
5. Rewrite: lokalizovaný koreň trhu → `categories/{segment}/…` (segment ostáva v internej ceste — vozidlové stránky sa hľadajú
   podľa `urlPath` artefaktu). Cudzí pravopis (`/cz/dachtraeger`) kategóriou nie je.

### 1.1 Požičané stránky RELEASE-4 (dáta, nie kód)

`src/lib/catalog-content/borrowed-routes.json` (release `20260915.2`, vygenerované z artefaktov): v každom z 9 cudzích
jazykov presne 3 cesty pod SK koreňom — `/stresne-nosice/volkswagen/golf-variant/ba5`, `/stresne-nosice/hyundai/h-1-van/a1`,
`/stresne-nosice/subaru/legacy-kombi/bh` (`routeLanguage: sk`, published, bez textu → neindexovateľné). ⚠️ Je to **Golf Variant**
BA5, nie Golf Alltrack. Nové vydanie CFM = pregenerovať JSON; `category-routes.acceptance.test.ts` zlyhá, ak nesedí.

### 1.2 Ďalej v M1

- **Stránka kategórie** mapuje segment → base slug pre Saleor, cache a filter; kanonická URL, breadcrumb, `VehicleListingFilter`
  a index značiek idú cez `categoryUrlFor(kanál, base)`. Vozidlová stránka: koreň breadcrumbu = kanonický koreň trhu.
- Odkazy: hlavička, homepage dlaždice, Saleor menu, karty produktov, PDP breadcrumb, sitemap → `categoryUrlFor`.
- **Brána existencie** (`classifyRoute`): lokalizovaný koreň = rodina `category` so **base slugom**. Predtým by po zapnutí
  404-la kanonickú kategóriu každého cudzieho trhu (`category(slug:"stresni-nosice")` = null).
- **Opravený živý SK defekt:** 22 kategórií mimo katalógu (vrátane `nordrive-stresne-nosice`) malo kanonickú URL na koreňovú
  cestu, ktorú proxy neroutuje — zmerané na maky.store: canonical `/sk/categories/nordrive-stresne-nosice` =
  `https://maky.store/sk/nordrive-stresne-nosice` = „Produkt nenájdený" + `noindex`. Na kandidátovi
  `…/sk/categories/nordrive-stresne-nosice`. **V produkcii to trvá, kým sa kandidát nenasadí.**
- Produktové, modelové a generačné slugy sa **nemenia**.

**Zmerané lokálne (kandidát, GET):** `/cz/stresne-nosice` → 301 `/cz/stresni-nosice`; `/at/stresne-nosice/bmw?utm=x` →
301 `/at/dachtraeger/bmw?utm=x`; `/us/stresne-nosice` → 301 `/us/roof-racks`; `/cz/categories/stresne-nosice` → 308
`/cz/stresni-nosice`; `/cz/stresni-nosice/subaru/legacy-kombi/bh` → 301 požičaná; `…/bp` → 301 požičaná BH; `/es/bacas-de-techo/bmw`
→ 301 `/es/barras-de-techo/bmw` — **všetky ciele 200, žiadny druhý skok**. `/cz/stresni-nosice/skoda` 200, H1 „Střešní nosiče
pro vozy Škoda", canonical `…/cz/stresni-nosice/skoda`, breadcrumb koreň `/cz/stresni-nosice`, `x-robots-tag: noindex, nofollow`;
`/at/dachtraeger/bmw` „Dachträger für BMW"; `/us`, `/ca` `/roof-racks/bmw` „Roof racks for BMW". `/cz/stresni-nosice` (stránka
kategórie) = soft-404 + `noindex`, **lebo kategória nemá preklad v Saleore** (čaká na CFM taxonomy pack). Produkcia dnes
`/cz/stresni-nosice/…` = 404.

---

## 2. M2 — texty katalógu

Nový namespace `catalog` (10 kľúčov) v 12 súboroch; SK hodnoty = doslovné staré literály (ENTRY §6), vrátane
nesklonného „{count} zostáv". Znovupoužité: `configurator.resultsTitle`, `configurator.outOfStock`, `common.onOrder`,
`nav.roofRacks`. Cena ponuky: SK ostáva `72.00 EUR`, ostatné trhy `formatPrice` (napr. `72,00 Kč`).

**Dôkaz SK bez zmeny:** viditeľný text 4 SK stránok (BH, Peugeot 306 Break 7, `/sk/stresne-nosice`, `/sk/stresne-nosice/skoda`)
**zhodný s produkciou** riadok po riadku; jediné rozdiely sú „Vybrať vozidlo" (lokálne nie je `MAKY_GARAGE_COOKIE_SECRET`)
a poradie streamu pätičky — nie kód. Screenshoty desktop/mobil SK lokálne = produkcia; CZ generačná stránka celá po česky,
bez slovenského textu. Render test pinuje SK text proti starému JSX a overuje, že 11 trhov nevykreslí slovenskú vetu
(falzifikovaný; prvá verzia prepustila jednu skopírovanú vetu).

**Parita:** 12 súborov × 725 kľúčov, missing 0 / extra 0. `pnpm i18n:check` zelený (locale matrix opravená, §0).

---

## 3. M3 — field contract a read-back

- **`docs/contracts/commerce2/exact-locale-contract.json`** — čo musí preklad niesť (produkt, jeho kategória a atribúty,
  stránka kategórie/kolekcie, položka menu), editorial language po trhoch, pravidlo „nič nepadá na slovenčinu".
  `src/lib/saleor/exact-locale.contract.test.ts` maže každé pole zvlášť a porovnáva verdikt resolvera s dokumentom.
- **Read-back formát** `maky.commerce2.l10n-readback/1` + syntetická vzorka `l10n-readback.sample.json` (AT a DE s jedným DE
  textom a vlastnými cenami, US EN, CZ kategória). Skutočný read-back CFM po hidden APPLY:

```bash
MAKY_L10N_READBACK_PATH=<súbor od CFM> node_modules/.bin/vitest run src/lib/saleor/exact-locale.contract.test.ts
```

Kontroluje: kanál patrí storefrontu, `languageCode` = jazyk trhu, produkt a kategória prejdú hranicou, mena variantu = mena
kanála. Bez tokenov a osobných údajov; verejné dotazy ostávajú anonymné.

---

## 4. M4 — revalidácia (kontrakt a dôkaz)

**Požiadavka (CFM, platná bez zmeny):**

```
POST https://maky.store/api/revalidate
x-revalidate-secret: <REVALIDATE_SECRET>          (alebo Authorization: Bearer <…>)
{"product":{"slug":"<slug>","channel":{"slug":"at-eur"},"category":{"slug":"<base alebo lokalizovaný>"}}}
```

`channel` ako string aj `{slug}`. **Neznámy kanál (`xx`, `at`, `AT-EUR`, s medzerou) → 400 a nič sa nepurguje** (predtým 200 +
`success` so zbytočným tagom, lebo neznámy kanál sa ticho mapoval na `sk-SK`). Bez kanála = všetkých 12.

**Odpoveď na kandidátovi** (presne, product event, `at-eur`, kategória):

```json
{
	"paths": [
		"/at-eur/<slug>",
		"/at-eur/products",
		"/at-eur/categories/stresne-nosice",
		"/at-eur/categories/dachtraeger",
		"/at-eur",
		"/sitemap.xml"
	],
	"tags": [
		"product:at-eur:de-AT:<slug>",
		"category:at-eur:de-AT:stresne-nosice",
		"fitment-offers:at-eur:de-AT",
		"sitemap:at-eur"
	],
	"success": true
}
```

Presne táto odpoveď je zapinovaná v `src/app/api/revalidate/route.test.ts`. Úspech pre CFM = HTTP 200 **a** `success === true` **a** tag `product:<kanál>:<market locale>:<slug>`. **Produkcia (`be0f795`)**
vracia zatiaľ iba `product` tag + cesty; `fitment-offers:*` a `sitemap:*` pribudnú nasadením kandidáta.

| čo sa invaliduje (kandidát)                    | ako                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| PDP / detail                                   | tag `product:*` + cesta `/{kanál}/{slug}`                             |
| kategória, výpis                               | tag `category:*:{base}` + cesty segmentu aj base, `/{kanál}/products` |
| homepage                                       | cesta `/{kanál}`                                                      |
| **ponuky vozidlových stránok a konfigurátora** | **tag `fitment-offers:{kanál}:{locale}`** (nové; predtým nič)         |
| sitemap index + shardy kanála                  | tag `sitemap:{kanál}` + cesta `/sitemap.xml`                          |
| content snapshot CFM, fitment dataset          | nie (memo procesu 15 min / 300 s) — pri zmene ceny netreba            |

**Dôkaz cez verejnú URL (lokálne, kandidát):** read-only proxy pred produkčným Saleorom podvrhol cenu produktu
`stresny-nosic-nordrive-snap-alu-silver-…-bp-…` na 11.11 (Saleor netknutý). Pred POST: vozidlová stránka
`/sk/stresne-nosice/subaru/legacy-kombi/bh` aj PDP `/sk/<slug>` stále **143.00 EUR / 143,00 €** (cache; proxy ani neoslovený).
Po POST s CFM telom: **11.11 EUR / 11,11 €**. Deaktivácia (`isAvailableForPurchase: false`) → po POST **7 → 6 zostáv**; návrat →
7 a 143.00. `channel: xx` → 400; bez tajomstva → 401. Aplikácia neskúsila ani jednu mutáciu.

---

## 5. M5 — sitemap, hreflang, skryté PDP

### 5.1 Sitemap index + shardy

`/sitemap.xml` = **index** (`app/sitemap.xml/route.ts`), shardy `/sitemaps/{trh}-{pages|products|vehicles}-{n}.xml`
(`app/sitemaps/[file]/route.ts`), max **40 000 URL** na shard (limit Google 50 000 / 50 MB; plný shard dlhých URL < 20 MB,
test). Logika `src/lib/seo/sitemap.ts` (presun z `app/sitemap.ts`, `git mv`). Výstup shardu je bajtovo rovnaký ako Next
metadata route (test proti Next serializéru). Neexistujúci shard = **skutočná 404**. Dynamické routy (`connection()`):
`MAKY_LIVE_MARKETS` sa prejaví reštartom.

**Zmerané lokálne:** index `sk-pages-1` (33) + `sk-products-1` (9 577) + `sk-vehicles-1` (1 475) = **11 085 = produkčný jeden
súbor**. S `MAKY_LIVE_MARKETS=sk,cz` (iba lokálne, reštart bez buildu) pribudli `cz-pages-1` a `cz-vehicles-1` (1 472, všetky
pod `/cz/stresni-nosice/`, 3 požičané bez textu vynechané), `cz-products` nie (0 produktov).

⚠️ **Zmenený deploy skript** (`scripts/ops/deploy-production.sh`, brána sitemap): starý počítal `<loc>` v `/sitemap.xml` a proti
indexu by zlyhal každý deploy. Nový nasleduje index, každý shard musí odpovedať a parsovať, prah 400 platí pre súčet.
Overené vyňatím presného úseku skriptu proti lokálnemu serveru: 11 085 → pass; `MIN_SITEMAP_URLS=20000` → die.
`scripts/checks/published-content.mjs` tiež číta index (overené, 9 577 produktov).

### 5.2 hreflang iba na reálne náprotivky

`counterpartAlternates()` (`src/lib/seo/hreflang.ts`): len **živé** trhy, kde **tá istá entita** existuje a je indexovateľná,
každý so svojou URL; aktuálna stránka musí byť v zhluku; zhluk < 2 = nič; hreflang = market locale (`en-US` ≠ `en-CA`).
Vozidlové stránky: join na `vehicleId`, `indexabilityOf` v jazyku trhu. Kategória: preložená a so zásobou v kanáli.
PDP: `getProductOutcome` v kanáli trhu (exact-locale). **S `sk` samotným sa nič nemení.** Lokálne s `sk,cz` (reštart):
`/sk/stresne-nosice/skoda/octavia-combi` ↔ `/cz/stresni-nosice/skoda/octavia-combi` recipročne + `x-default`; BH, PDP a
`/sk/stresne-nosice` bez alternates (v CZ neexistujú). Statické a právne stránky: `buildHreflangAlternates` bez zmeny
(pečie sa pri builde → rebuild).

### 5.3 Skryté PDP a košík

Skrytý listing: PDP = **SOFT_404** (HTTP 200 + not-found telo + `noindex`), nie HTTP 404 PASS. Brána existencie je vypnutá;
po M1 správne klasifikuje lokalizované korene. Zapnúť per trh až po cielenom teste (§9). Anonymné pridanie skrytého
variantu do košíka = zápis → iba v post-hidden smoke pod GO (`payment-canary.mjs --hidden-negative`).

---

## 6. M6 — platby

**Zmerané read-only 16. 9. (anonymne):** `shop.availablePaymentGateways` pre všetkých 12 kanálov = iba legacy
`mirumee.payments.dummy` [USD, PLN] — transakčné appky tam nie sú, **nie je to dôkaz chýbajúceho Stripe**. Stripe app beží na
samostatnom serveri **maky-apps** (nie na tomto stroji; `/opt/saleor-stripe-app` tu neexistuje). Tento stroj **nemá správcovskú
identitu Saleoru** (`SALEOR_APP_TOKEN` v prod `.env` nie je; token SMTP appky som zámerne nepoužil — patrí inej službe).

| stav                      | sk-eur                                                                                   | ostatných 11 |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------ |
| `PAYMENT_CONFIG_VERIFIED` | historicky: 18. 7. `pk_test`, 20. 7. live platba obj. č. 15 (pamäť) — **dnes neoverené** | **nie**      |
| `PAYMENT_INIT_TESTED`     | NOT_RUN                                                                                  | NOT_RUN      |
| `PAYMENT_CHARGE_TESTED`   | NOT_RUN                                                                                  | NOT_RUN      |
| `ORDER_E2E`               | NOT_RUN (mimo historickej obj. č. 15)                                                    | NOT_RUN      |

**Jedna požiadavka na prístup (Marek):** v Saleor Dashboarde → Apps → Stripe → konfigurácie kanálov zapísať pre 12 kanálov
iba _kanál → názov konfigurácie → režim (pk_live/pk_test) → povolené meny_, bez kľúčov — alebo vydať dočasný staff token
s `MANAGE_APPS` do súboru 600 na tomto stroji, ktorý po overení zrušíte. `MANAGE_APPS` nepridávať runtime tokenu CFM.

**Canary pre GO-COMMERCE-LIVE:** `scripts/checks/payment-canary.mjs` (nespustený). Bez `--execute` iba plán (`--read` =
anonymné predkontroly). Zápis len s `MAKY_GO_COMMERCE_LIVE=<presne ten kanál>` a bez `MAKY_SALEOR_WRITES=block`:
checkoutCreate → najlacnejšia doprava → read-back meny/súčtu/dane → `paymentGatewayInitialize` (id, chyby, kľúče `data`,
live/test — nikdy kľúč) → **STOP**. `transactionInitialize`, `checkoutComplete` a pod. v súbore nie sú (test).

```bash
node scripts/checks/payment-canary.mjs --channel at-eur --variant <id> --product-slug <slug> --read
MAKY_GO_COMMERCE_LIVE=at-eur node scripts/checks/payment-canary.mjs --execute --channel at-eur --variant <id> --email <canary> --address <canary-address.at.json>
MAKY_GO_COMMERCE_LIVE=at-eur node scripts/checks/payment-canary.mjs --hidden-negative --channel at-eur --variant <skrytý id> --email <canary> --address <…>
```

---

## 7. Stav po kanáloch (16. 9. večer)

| trh                        | kód v prode (`be0f795`)                             | kandidát `4299aa2`                                           | dáta CFM (zmerané)                          | verejné produkty | index | predaj | platby          |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------- | ---------------- | ----- | ------ | --------------- |
| sk                         | živé; revalidácia zapnutá                           | + ponuky/sitemap purge, Nordrive canonical                   | živý katalóg                                | 9 577            | áno   | áno    | historicky live |
| cz, pl, hu, it, fr, es, ro | vozidlové stránky pod lokalizovaným koreňom **404** | koreň routovaný, texty v jazyku, hreflang/sitemap pripravené | APPLY neprebehol; **0 prekladov kategórií** | 0                | nie   | nie    | neoverené       |
| de, at                     | ako vyššie (DE text)                                | ako vyššie, `/dachtraeger`                                   | ako vyššie                                  | 0                | nie   | nie    | neoverené       |
| us, ca                     | EN mapovanie nasadené                               | ako vyššie, `/roof-racks`                                    | ako vyššie                                  | 0                | nie   | nie    | neoverené       |

---

## 8. Odpovede na štyri otázky CFM

1. **Invaliduje endpoint iný kanál a skutočnú verejnú cestu?** Áno. Tagy a interné cesty sú per kanál + market locale;
   verejná URL ide cez rewrite na tú istú internú cestu. Dôkaz cez verejné URL PDP aj vozidlovej stránky je v §4 (lokálne,
   so zmenou ceny aj deaktiváciou). Verejný AT/DE/US/CA dôkaz s reálnou stránkou je možný až po LIVE canary (dnes 0 produktov).
2. **Stačí produkt + kanál?** Áno. Locale sa odvodí z kanála (`at-eur` → `de-AT`); editorial language nie je cache locale.
   `category.slug` posielajte base alebo lokalizovaný — kandidát ho namapuje. Kanál vždy výslovne, Saleor slug (`at-eur`).
3. **URL a tajomstvo?** `POST https://maky.store/api/revalidate`, hlavička `x-revalidate-secret` alebo `Authorization: Bearer`.
   Tajomstvo je v prod `.env`; prenos do `/home/ubuntu/.config/cfm-saleor/storefront-revalidate.secret` (600, priečinok 700)
   jedným krokom z ENTRY §0 — tento stroj nemá SSH na CFM.
4. **Výpis, sitemap, hreflang?** Výpis a sitemap áno (na kandidátovi per kanál tagom). Ponuky vozidlových stránok: na kandidátovi
   tagom `fitment-offers`, v prode zatiaľ TTL 300 s. hreflang: entitné stránky sú request-time (reštart), statické sa pečú pri
   builde — pre prvé LIVE jeden koordinovaný build s konečným `MAKY_LIVE_MARKETS`.

---

## 9. Čo čaká — na koho

| čaká na                        | položka                                                                                                                                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GO (Marek)**                 | nasadenie kandidáta `4299aa2` (postup §10); zapnutie brány existencie per trh                                                                                                                                                                                                                       |
| **CFM dáta (DELTA-2 + APPLY)** | preklady kategórií `stresne-nosice` + `nordrive-stresne-nosice` × 9 jazykov (bez nich zahraničné PDP aj stránka kategórie = not-found); 82 413 produktových prekladov; hidden listingy; read-back súbor pre §3; šesť SK held Peugeot produktov stiahnuť z `sk-eur` (filter ich iba skrýva z ponuky) |
| **CFM (kontrola)**             | preložený `slug` kategórie = segment z §1 (alebo prázdny); inak kandidát routuje podľa mapy a Saleor slug ignoruje                                                                                                                                                                                  |
| **Marek (prístup)**            | prenos revalidačného tajomstva do CFM (ENTRY §0); Stripe konfigurácia 12 kanálov (§6)                                                                                                                                                                                                               |
| **GO-COMMERCE-LIVE**           | canary §6, verejný dôkaz revalidácie AT, `MAKY_LIVE_MARKETS` + rebuild                                                                                                                                                                                                                              |
| **Rozhodnutie copy (Marek)**   | SK „2 zostáv"/„1 zostáv" (nesklonné, zachované); SK cena ponuky `72.00 EUR` vs PDP `72,00 €` (zachované)                                                                                                                                                                                            |

---

## 10. Nasadenie kandidáta (keď príde GO)

Rovnako ako ENTRY §7: overiť `MAKY_DEPLOY_META` = `be0f795`, čistý `/opt/storefront`, žiadny súbežný deploy;
`cd /opt/storefront && git checkout --detach <tip vetvy>`; **lockfile sa nemenil** (install netreba); `--dry-run`; ostrý beh
na pozadí s logom. `.env` sa nemení. **Nový deploy skript z kandidáta** kontroluje sitemap cez index. Po nasadení:
`/sitemap.xml` = index (3 shardy, súčet 11 085 ± zmeny katalógu); `/sk/categories/nordrive-stresne-nosice` canonical na seba;
`/cz/stresni-nosice/skoda` 200 + noindex; `/cz/stresne-nosice` 301; SK BH 7 zostáv, Peugeot 7 = 0; POST revalidate vráti aj
`fitment-offers:*` a `sitemap:*`; PM2 log bez `failed validation`. Rollback = snapshot `be0f795` (vznikne pri deployi).

---

## 11. Post-hidden-APPLY smoke (po CFM APPLY, pred LIVE)

1. `pnpm check:fitment`, `pnpm check:catalog` (s env), `pnpm check:published` — SK sa nezhoršil.
2. **Pozitívne:** CFM read-back → `MAKY_L10N_READBACK_PATH=… vitest run src/lib/saleor/exact-locale.contract.test.ts` (§3).
3. **Taxonomy:** anonymne `category(slug:"stresne-nosice"){translation(languageCode:CS){name description seoTitle seoDescription slug}}`
   pre 9 jazykov; `slug` = segment z §1 alebo prázdny.
4. **Negatívne anonymne:** `/{trh}/<skrytý slug>` = 200 + not-found + `noindex` (SOFT_404); `/{trh}/products` a vyhľadávanie bez
   neho; `products(channel)` totalCount 0; `/sitemap.xml` bez zahraničných shardov.
5. **Negatívne pod GO:** `payment-canary.mjs --hidden-negative` pre AT → Saleor odmietne.
6. Revalidácia: POST pre AT skrytý produkt → 200 + `success` + tagy; stránka ostáva not-found.

---

## 12. Nálezy a pasce tohto vlákna

- **Fitment je viazaný na inštanciu Saleoru** (`saleorInstance` = host z `NEXT_PUBLIC_SALEOR_API_URL`, zahrnutý v `datasetHash`).
  Lokálny build proti proxy preto potrebuje lokálnu kópiu datasetu s prepočítaným hashom (skript v scratchpade, repo funkcia
  `datasetHashFromText`); inak 0 vozidlových stránok. Kópia nikdy neopustila scratchpad.
- `categories.test.ts` hľadá `` `/categories/<slug>` `` aj v komentároch — slug v backtickoch za `/categories/` zlyhá test.
- Po presune sitemap sa `routing.generated.ts` nezmenil: generátor rozpoznáva aj route priečinok s bodkou (`sitemap.xml/route.ts`).
- `check:published` sampluje absolútne URL zo shardov (produkcia), aj keď index číta z `--base` — predexistujúce správanie.
- `Edit`/`Write` v tomto vlákne nepadali na timeoute hooku.
- Varovania fitmentu `window.to.year exceeds generation production end` a React „resumable slots" v prod logu sú predexistujúce.
- Prázdny `/{trh}/products` je v sitemap pages sharde živého trhu aj s 0 produktmi (predexistujúce; pri LIVE trh produkty mať bude).
