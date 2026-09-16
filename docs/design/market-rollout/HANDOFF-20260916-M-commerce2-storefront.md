# M · COMMERCE-2 — storefront po kanáloch: čo je hotové, čo dodá CFM, čo treba schváliť

> **Zastarané v častiach (16. 9. večer):** `41cc44e` je nasadený, revalidácia je zapnutá (§6 „nefunguje" už neplatí) a §9 body
> 1–4 rieši integračný kandidát. Aktuálny stav: **`HANDOFF-20260916-M-integration-candidate.md`**.

Napísané 16. 9. 2026 v existujúcom M-vlákne ako odpoveď na „MAKY.STORE — delta pre existujúce
storefront M-vlákno" (16. 9.). Všetko označené „zmerané" som zmeral na tomto stroji: kód, testy,
lokálny build a **read-only** dotazy do produkčného Saleoru bez tokenu. Do Saleoru, CFM, `.env` ani
produkcie som nič nezapísal.

CFM handoff `CFM_COMMERCE_2_STOREFRONT_HANDOFF_20260916.md` leží na stroji CFM a odtiaľto sa nedá
prečítať, jeho „4 otázky pre M" som teda nevidel. Oddiely §3, §5, §6 a §7 odpovedajú na otázky
z delta zadania; ak sú štyri otázky iné, treba ich vložiť.

---

## 0. Stav v skratke — oddelene

|                     | stav                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo                | `claude/m-vlakno-2026-09-15-51940a` — kód `41cc44e`, tento dokument nad ním                                                                                       |
| Nasadené            | `500068f`, BUILD_ID `zMxoCHeXuF0A3BVkJVKUA` (z `MAKY_DEPLOY_META`, 15. 9. 20:33 UTC) — `41cc44e` **nenasadený**                                                   |
| Pripravený kód      | trhy, kanál a jazyk v PDP/PLP/košíku/checkoute, hranica prekladu bez SK fallbacku, cache podľa kanála aj locale; nové: US/CA → `EN`, ponuka rešpektuje `sellable` |
| Aplikované dáta CFM | **0 z 11** zahraničných kanálov: zmerané verejne 0 produktov; produkt 8472 bez prekladu; kategórie bez prekladu                                                   |
| Overené platby      | sk-eur konfigurácia 2026-07-18; ďalších 11 kanálov **neoverených**; inicializácia a E2E **NOT_RUN**                                                               |
| Predaj              | iba `sk`                                                                                                                                                          |
| Indexovanie         | iba `sk` (`MAKY_LIVE_MARKETS=sk`)                                                                                                                                 |
| Revalidácia         | endpoint existuje, v produkcii **nefunkčný** — chýba tajomstvo (§6)                                                                                               |

---

## 1. Kontrakt trhov — z kódu, nie z tabuľky v zadaní

Zdroj: `src/lib/channel-map.ts` (`CHANNEL_MAP`), `src/config/locale.ts` (`LOCALE_MAP`),
`src/lib/catalog-content/language.ts`. Zhoduje sa s tabuľkou v delta zadaní.

| trh | Saleor kanál | mena | locale | jazyk CFM (content) | jazyk Saleor prekladu   |
| --- | ------------ | ---- | ------ | ------------------- | ----------------------- |
| sk  | sk-eur       | EUR  | sk-SK  | sk                  | SK (zdroj, nie preklad) |
| cz  | cz-czk       | CZK  | cs-CZ  | cs                  | CS                      |
| de  | de-eur       | EUR  | de-DE  | de                  | DE                      |
| at  | at-eur       | EUR  | de-AT  | de                  | DE                      |
| pl  | pl-pln       | PLN  | pl-PL  | pl                  | PL                      |
| hu  | hu-huf       | HUF  | hu-HU  | hu                  | HU                      |
| it  | it-eur       | EUR  | it-IT  | it                  | IT                      |
| fr  | fr-eur       | EUR  | fr-FR  | fr                  | FR                      |
| es  | es-eur       | EUR  | es-ES  | es                  | ES                      |
| ro  | ro-ron       | RON  | ro-RO  | ro                  | RO                      |
| us  | us-usd       | USD  | en-US  | en                  | **EN** (bolo `EN_US`)   |
| ca  | ca-cad       | CAD  | en-CA  | en                  | **EN** (bolo `EN_CA`)   |

AT a DE zdieľajú jazyk, nie kanál: cache kľúč nesie kanál aj locale (`product:{channel}:{locale}:{slug}`),
takže AT nikdy nedostane DE cenu. Cena a mena idú vždy z ceny variantu v danom Saleor kanáli; storefront
nič neprepočítava kurzom.

---

## 2. Čo pridáva táto vetva (`41cc44e`, nenasadené)

1. **US/CA čítajú preklad `EN`.** Dotazy pýtali `EN_US`/`EN_CA`, CFM zapisuje jeden `EN`. Hranica prekladu
   by v oboch trhoch odmietla každý produkt. Test `src/config/locale.test.ts` viaže jazyk Saleoru každého
   trhu na jazyk CFM. Dotýka sa aj `languageCode` checkoutu v US/CA (dnes tam neexistuje žiadny checkout).
2. **Ponuka na vozidlovej stránke rešpektuje `sellable`.** Generačná stránka posielala do ponuky všetky
   produkty z aplikácií vrátane tých, ktoré CFM drží (`qaStatus: hold`). **Živý defekt:**
   `/sk/stresne-nosice/peugeot/306-break/7` dnes na maky.store ponúka 6 produktov na hold (pk 6935–6940).
   Oprava uplatňuje produktovú polovicu `isFitmentOfferable` (`isFitmentRefSellable`, `contract.ts`)
   a počíta ich ako `not-sellable`.

Overené: vitest 2 012 testov / 132 súborov, `tsc` a eslint 0, obe nové kontroly falzifikované (návrat
`EN_US` aj vypnutý filter ich zhodí), build 31 s a lokálny `next start` nad vydaním 20260915.2: Peugeot
306 Break 7 = 0 produktov a hlásenie „zatiaľ nemáme overenú zostavu", BH a Golf Alltrack BA5 po 7,
SK homepage a PDP 200. **Nasadenie potrebuje GO.**

---

## 3. Lokalizovaný text — čo storefront vyžaduje od CFM

Hranica je `src/lib/saleor/exact-locale.ts`. V cudzom trhu **nič nepadá späť na slovenčinu**; chýbajúci
preklad znamená, že produkt alebo stránka v tom trhu neexistuje.

| čo                                                                         | povinné polia prekladu                                                                                                                | inak                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| produkt (PDP, výpis, ponuka)                                               | `name`, `description`, `seoDescription`; `seoTitle` voliteľné (inak preložený názov); `slug` voliteľné (inak URL so základným slugom) | produkt v trhu neexistuje     |
| kategória produktu (`product.category`)                                    | `name`                                                                                                                                | **produkt v trhu neexistuje** |
| každý atribút viditeľný v storefronte + jeho hodnoty (produkt aj varianty) | `name`                                                                                                                                | produkt v trhu neexistuje     |
| stránka kategórie / kolekcie                                               | `name`, `description`, `seoTitle`, `seoDescription`                                                                                   | stránka not-found             |
| položka menu                                                               | `name` (+ preklad odkazovanej kategórie)                                                                                              | položka sa skryje             |

**Zmerané read-only 16. 9.:** kategórie `stresne-nosice` aj `nordrive-stresne-nosice` (kategória
produktu 8472) majú **0 prekladov** v 10 jazykoch; produkt 8472 nemá preklad v `EN`/`EN_US`/`DE`/`CS`;
viditeľné atribúty nemá žiadne. ⚠️ **Bez prekladu kategórií bude každé zahraničné PDP not-found aj po
zápise 82 413 produktových prekladov.** CFM musí preložiť aj kategórie produktov kohorty.

Ak CFM zapíše preložený `slug`, stane sa URL produktu v danom trhu a zároveň identitou pre revalidáciu (§6).

---

## 4. ROUTABLE / INDEXABLE / SELLABLE — čo ich naozaj riadi

| rozmer                              | riadi                                                                                                              | kedy sa prejaví                                                                                                                                                                           | kde                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **routable** (trh odpovedá)         | `CHANNEL_MAP`, všetkých 12                                                                                         | vždy                                                                                                                                                                                      | `src/proxy.ts`                                                        |
| **indexable**                       | `MAKY_LIVE_MARKETS` (default `sk`)                                                                                 | `x-robots-tag` na preview trhoch **za behu**; výber trhu a cookie za behu; sitemap za behu (`revalidate = 3600`); **hreflang a prepínač trhov v hlavičke sa piekli pri builde → rebuild** | `proxy.ts`, `sitemap.ts`, `lib/seo/hreflang.ts`, `header-nav-row.tsx` |
| **vozidlová stránka indexovateľná** | `state` published + `indexable` + text v danom jazyku                                                              | za behu                                                                                                                                                                                   | `catalog-content/publication.ts`                                      |
| **technicky predajné**              | Saleor na produkt × kanál: publikácia, dostupnosť na nákup, cena variantu, sklad/zóna dopravy, platobná app kanála | za behu                                                                                                                                                                                   | Saleor; storefront iba volá mutácie s kanálom                         |
| **fitment ponuka**                  | navyše CFM `qaStatus: accepted` + `sellable: true`                                                                 | za behu                                                                                                                                                                                   | `fitment/offers.ts` (`41cc44e`)                                       |
| **verejný predaj povolený**         | GO-COMMERCE-LIVE → CFM publikuje listingy                                                                          | —                                                                                                                                                                                         | CFM                                                                   |

`MAKY_LIVE_MARKETS` **neriadi predaj ani checkout.** Storefront nemá žiadnu trhovú bránu košíka ani
checkoutu a druhý register trhov som podľa zadania nepridal. Z toho plynie **podmienka poradia pre LIVE:**
listing v kanáli sa smie publikovať až po doprave, daniach a platobnej app pre ten kanál. Inak storefront
ukáže kúpiteľný produkt a checkout padne na doprave alebo platbe.

Preview trh (noindex, dosiahnuteľný) a skrytý listing (produkt v Saleore nepublikovaný) sú dva nezávislé
stavy a storefront ich nemieša.

---

## 5. Skrytý listing — čo uvidí anonym (na overenie po hidden APPLY)

- **PDP** `/{trh}/{slug}`: Saleor verejne vráti `null` → not-found telo + `robots noindex`, **HTTP 200**
  (soft-404 pod PPR). Skutočnú 404 dáva iba brána existencie v proxy, ktorá je nasadená, ale **vypnutá**
  (`ROUTE_EXISTENCE_GATE` nie je nastavené). Test „anonymný hidden 404" preto overuje telo a `noindex`, nie
  status, alebo treba bránu zapnúť.
- **Výpis, vyhľadávanie, sitemap:** produkt v nich nie je (verejné API).
- **Pridanie do košíka:** Saleor mutáciu odmietne, storefront ukáže `cart.addUnavailable`.
- **Žiadny token neobíde publikáciu:** produktové čítania idú anonymne (`executePublicGraphQL`),
  `SALEOR_APP_TOKEN` v produkčnom `.env` nie je, autentifikovaný executor slúži iba zákazníckemu účtu.

---

## 6. Revalidácia — existujúci kontrakt pre CFM

Endpoint `https://maky.store/api/revalidate` (`src/app/api/revalidate/route.ts`). CFM nemá stavať nový.

**Udalosť (odporúčané pre publikáciu, zmenu ceny a stiahnutie):**

```
POST /api/revalidate
Content-Type: application/json
Authorization: Bearer <REVALIDATE_SECRET>        (alebo x-revalidate-secret: <REVALIDATE_SECRET>)

{ "product": { "slug": "<URL slug v danom trhu>", "previousSlug": "<starý slug, voliteľné>",
               "channel": "<Saleor kanál, napr. at-eur; bez neho všetkých 12>",
               "category": { "slug": "<slug kategórie, voliteľné>" } } }
```

Invaliduje hneď (`expire: 0`): tag `product:{kanál}:{locale}:{slug}` (aj pre `previousSlug`), cestu
`/{kanál}/{slug}`, `/{kanál}/products`, pri `category.slug` aj tag a cestu kategórie, `/{kanál}` a
`/sitemap.xml`. Odpoveď `200 {"paths":[…],"tags":[…],"success":true}`; `401 {"error":"Unauthorized"}`;
`400 {"error":"Invalid payload"}`. Rovnaký endpoint prijme aj Saleor webhook s HMAC `saleor-signature`
(`SALEOR_WEBHOOK_SECRET`) a obaly `productVariant.product`, `translation.product`, `productMedia.product`,
`category`, `collection`.

**Cielene (jeden produkt × kanál):**
`GET /api/revalidate?resource=product&channel=<kanál>&locale=<locale kanála>&slug=<slug>` s
`Authorization: Bearer <REVALIDATE_SECRET>`. `locale` musí patriť kanálu (`at-eur` → `de-AT`, `us-usd` →
`en-US`), inak 400. Neinvaliduje sitemap ani výpis.

**Identita:** kanál = Saleor slug kanála (`at-eur`, nie `at`); locale = `CHANNEL_MAP` locale;
slug = **URL slug v danom trhu** — preložený `slug`, ak ho CFM zapíše, inak základný. Pri zmene
preloženého slugu poslať oba.

**Čo sa týmto neinvaliduje:** ponuka na vozidlových stránkach (fetch `revalidate: 300` s), content snapshot
CFM (pamäť procesu 15 min), fitment dataset (300 s), hreflang a prepínač trhov (build).

**Overenie úspechu:** `200` so `success: true` a očakávaným tagom v odpovedi; potom anonymný `GET` PDP
a porovnanie ceny alebo dostupnosti. Bez purge sa PDP obnoví najneskôr po `cacheLife("minutes")`.

⚠️ **V produkcii to dnes nefunguje:** `REVALIDATE_SECRET` ani `SALEOR_WEBHOOK_SECRET` nie sú v `.env`,
`verifySecret` preto vráti `false` a každé volanie dostane 401. Zapnutie je zmena `.env` a potrebuje GO:
vygenerovať ≥32 znakov priamo na stroji do `.env` (nikdy do chatu ani gitu), odovzdať CFM bezpečným
kanálom, `pm2 restart maky-storefront` (premenná sa číta za behu, rebuild netreba), overiť `GET
resource=product` → 200.

---

## 7. Platby

**Cesta (z kódu):** Saleor Transaction API cez Saleor Stripe App (`saleor.app.payment.stripe`):
`paymentGatewayInitialize` vráti publishable key podľa konfigurácie kanála, `transactionInitialize`
vytvorí PaymentIntent, platí sa cez Stripe Elements. Storefront flagy `ENABLE_STRIPE_PAYMENTS` a
`NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS` sú v produkcii `true` (globálne, nie po trhoch). Dummy brána je
v produkcii vypnutá. Dobierka sa neponúka; právne texty vrátane US/CA hovoria o platbe vopred.

| stav                      | sk-eur                            | ostatných 11 kanálov |
| ------------------------- | --------------------------------- | -------------------- |
| `PAYMENT_CONFIG_VERIFIED` | áno, 2026-07-18 (vtedy `pk_test`) | **nie**              |
| `PAYMENT_INIT_TESTED`     | NOT_RUN                           | NOT_RUN              |
| E2E platba                | NOT_RUN                           | NOT_RUN              |

**Prečo sa to odtiaľto overiť nedá — presne:**

- anonymné `shop.availablePaymentGateways(channel)` vracia pre sk, at aj us iba legacy
  `mirumee.payments.dummy` (USD, PLN) — transakčné appky tam nie sú, **nie je to dôkaz chýbajúceho Stripe**;
- `checkout.availablePaymentGateways` a `paymentGatewayInitialize` potrebujú checkout = zápis do produkcie
  (write guard ho blokuje a povolenie nie je);
- konfigurácia Stripe app vyžaduje `MANAGE_APPS`;
- mena a aktívnosť kanála vyžadujú `AUTHENTICATED_APP` alebo `AUTHENTICATED_STAFF_USER`
  (anonymne `PermissionDenied`, zmerané).

**Treba:** konfiguráciu Stripe app pre 11 kanálov (EUR, CZK, PLN, HUF, RON, USD, CAD) s live kľúčmi a
povolenie na kontrolovanú inicializáciu platby na canary checkoute alebo staging Saleor.

---

## 8. Stav po kanáloch (16. 9. 2026)

| trh                                | kód storefrontu                                      | dáta CFM (zmerané)                       | verejných produktov | platby            | predaj | index |
| ---------------------------------- | ---------------------------------------------------- | ---------------------------------------- | ------------------- | ----------------- | ------ | ----- |
| sk                                 | ✓ nasadené                                           | živý katalóg                             | 9 577               | config 2026-07-18 | áno    | áno   |
| cz, de, at, pl, hu, it, fr, es, ro | ✓ PDP/PLP/košík/checkout; vozidlové stránky ✗ (§9.2) | APPLY neprebehol, kategórie bez prekladu | 0                   | neoverené         | nie    | nie   |
| us, ca                             | ✓ po nasadení `41cc44e` (EN); vozidlové stránky ✗    | APPLY neprebehol                         | 0                   | neoverené         | nie    | nie   |

---

## 9. Pred verejným spustením

1. **Nasadiť `41cc44e`** (US/CA `EN`, filter `sellable`) — potrebuje GO. Pred overovaním US/CA po APPLY
   musí byť nasadený, inak storefront pýta `EN_US`.
2. **Lokalizované korene katalógu** (`/cz/stresni-nosice/…`, `/at/dachtraeger/…`) dnes vracajú 404 — proxy
   pozná iba slovenské slugy kategórií. Návrh:
   - mapa lokalizovaných koreňov pre `stresne-nosice` v `config/categories.ts`, overená acceptance testom
     proti koreňom v artefaktoch CFM (cs `stresni-nosice`, en `roof-racks`, de `dachtraeger`, pl
     `bagazniki-dachowe`, hu `tetocsomagtartok`, ro `bare-transversale`, fr `barres-de-toit`, it
     `barre-portatutto`, es `barras-de-techo`); proxy rozpozná koreň podľa jazyka trhu;
   - texty UI katalógu z už preložených kľúčov: `configurator.resultsTitle`, `configurator.resultsCount`,
     `configurator.outOfStock`, `configurator.noVerifiedSetDetail`, `configurator.errorCatalogueUnavailable`,
     `common.onOrder`, `nav.roofRacks`.
   - **Rozhodnutie A (odporúčané):** kanonická URL kategórie v cudzom trhu je lokalizovaný koreň; CFM zapíše
     preklad kategórie so `slug` rovným koreňu. **B:** stránka kategórie na základnom slugu, vozidlové
     stránky pod lokalizovaným koreňom — dve schémy URL v jednom trhu, neodporúčam.
   - **Rozhodnutie o texte:** nadpis a úvod výberu značky nemajú preložený kľúč. Buď nové kľúče s prekladom
     z L10N procesu CFM, alebo `fitment.selectVehicle` + `configurator.description`, čo zmení aj živý SK text.
3. **hreflang a alternates** iba na trhy, kde stránka naozaj existuje — pred druhým živým trhom.
4. **Rozdelenie sitemap** podľa trhov — sk má 11 085 URL, pri plných listingoch prekročí limit 50 000 pri piatom trhu.
5. **Skutočná 404** pre skryté PDP: zapnúť bránu existencie po trhoch, alebo prijať soft-404 s `noindex`.
6. **Revalidačné tajomstvo** (§6) — zmena `.env`, GO.
7. React chyba „resumable slots" na `categories/[slug]` (predexistujúca, produkčný log 63 441×).
8. Otvorenie trhu = zmena `MAKY_LIVE_MARKETS` **a rebuild** (hreflang, prepínač trhov).

---

## 10. Testovanie podľa fázy

- **Teraz (pred APPLY):** fixtúry a unit testy — hotové (§2).
- **Po hidden APPLY:** oprávneným čítaním (staff/app) cena a mena variantu v kanáli, preklady `name`,
  `description`, `seoDescription` + preklad kategórie; anonymne PDP not-found telo s `noindex`, žiadny
  výskyt v `/{trh}/products` ani vo vyhľadávaní; `/sitemap.xml` bez zahraničných URL; pridanie do košíka
  odmietnuté. Checkout skrytého produktu **nesmie** prejsť.
- **Po GO-COMMERCE-LIVE (AT canary):** PDP s nemeckým textom a cenou v EUR, košík, adresa v AT, doprava,
  daň, `paymentGatewayInitialize` bez capture; revalidácia ceny (§6); `x-robots-tag` a sitemap podľa
  `MAKY_LIVE_MARKETS`. Chyba USD/CAD nezastavuje EÚ, ak nejde o spoločný kód.
