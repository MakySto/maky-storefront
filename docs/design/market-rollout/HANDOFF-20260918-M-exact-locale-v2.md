# M · COMMERCE-2 — exact-locale kontrakt v2 a zapojenie preloženého slugu

Napísané 18. 9. 2026 vo vlákne `m-worktree-cfm-checkpoint-eba859` podľa Marekovho zadania pre M („PRVÝ VÝSTUP PRE CFM …
POTOM DOKONČI IBA CHÝBAJÚCE M ZAPOJENIE“). Do produkčného Saleoru ani CFM sa nič nezapisovalo; všetky merania sú anonymné
čítania alebo lokálny build za read-only proxy.

---

## 0. Stav v skratke

|                           |                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Kontrakt v2 (pre CFM)** | commit **`bf7c5e9d6675084ec63a875337c4f836b2f45b00`** — pushnutý                                                                  |
| **M zapojenie**           | commit **`5ce2f0bebf7448a53805b746f6653cb2281f1f1a`** — pushnutý, **NENASADENÝ** (deploy zablokovalo povolenie nástroja, §4)      |
| Vetvy                     | `claude/m-worktree-cfm-checkpoint-eba859` a fast-forward `claude/m-vlakno-storefront-continue-c6ad59` (predtým `c6bd62a`)         |
| Základ                    | prod `ed7b153` (Codex `codex/frontend-recovery`, na GitHube predtým nebol) + merge `c6bd62a` (isAvailableForPurchase) = `2c48abf` |
| Produkcia                 | **stále `ed7b153`, BUILD_ID `_tWCo4Vh0f4z6oIe5Yk7V`** — zdravá (`/sk` 200, CSS 200 / 124 KB, 18. 9. ~19:45 UTC)                   |
| ⚠️ `/opt/storefront`      | **zdrojový strom je na `5ce2f0b` (detached)**, artefakt `.next` je `ed7b153` — pozri §4                                           |
| Testy                     | vitest **2 241 passed / 34 skipped** (+34 nových), tsc 0, eslint 0 chýb, i18n parita 12 × 726, build 34 s                         |

## 1. Pre CFM — kontrakt v2 na vendorovanie

**Commit `bf7c5e9d6675084ec63a875337c4f836b2f45b00`** (tie isté bloby platia aj na `5ce2f0b`, okrem `channel-map.ts`):

| súbor                                                 | git blob                                   | sha256                                                             | bajty  |
| ----------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ | ------ |
| `docs/contracts/commerce2/exact-locale-contract.json` | `51e60be70550c6067154e309548884c1859c6263` | `d054a7ce3d4df4535e8ffe0d74d01c0b2ee6bb595a0e702066fa5418f64217d8` | 7 015  |
| `docs/contracts/commerce2/l10n-readback.sample.json`  | `9785961e0a6808d8407056c8bf01335a38f0ee99` | `b7fdc95a193ebbc55ecec0006cc9eb30ed25c9b67431f3df6bd0a630f5a13b57` | 6 680  |
| `src/lib/saleor/exact-locale.ts`                      | `34c80feeec314d144876099e58443ed2e3ef7123` | `8e3e949ad16858fd6e6324d4ae3bffbf430aa092fa526cce10a3a2b85db974e5` | 10 133 |
| `src/lib/saleor/exact-locale.contract.test.ts`        | `ac9cdb5e1e0d30925322d557e0f40625121fbbe1` | `1588fb4041f227c65903378526a4b459979fb91045e9f77769842d25ed597455` | 19 169 |
| `src/config/locale.ts`                                | `6af83c5f677bc8d0ee11bf8d59fe84992134f277` | `781feaa74836acd857b3a5bc6fa31a5ac6089f5bf444d6e11467a4135a2ec375` | 8 165  |
| `src/lib/channel-map.ts` (na `bf7c5e9`)               | `353fdb762925b15677bfa3ace9f41ca20e373811` | `0cbcc673d11823a03b3f2062e4f33ea57c4d7dbcd103ddf4ea332091478c35e5` | 3 683  |
| `src/lib/saleor/slug-lookup.ts`                       | `63aab99f8ef0daa701a152f5bbe26d8be307bce6` | `eca431bc4cf108136e3933f2f2edc91040b60c39834ab8cd94bd34d8edfed50f` | 2 620  |
| `docs/i18n/commerce-locales.json`                     | `204d113e05c7164e74d79f7ae74c05532bbb1838` | `2b2ee5f76fc961e63ca390c8e222728abf45484ff96a7721d7ba02196ace7ef0` | 5 900  |

Kanonický artefakt pre CFM guardy je **JSON kontrakt** (schema `maky.commerce2.exact-locale-contract/2`); TS súbory sú
referencia, čo s ním storefront robí. Overenie kópie: `git show bf7c5e9:<cesta> | sha256sum`.

**Čo v2 hovorí (a test to drží proti kódu):**

- Matica `markets`: trh → kanál → locale → `languageCode`. **AT → `DE_AT`, CA → `EN_CA`, US → `EN`**; SK = base row, nikdy preklad.
  Kľúč v1 `editorialLanguageByMarket` ostal s novými hodnotami.
- `targetLanguageCodes` = CS, DE, DE_AT, PL, HU, IT, FR, ES, RO, EN, EN_CA (11, všetko platné hodnoty Saleor enumu);
  `sourceRenderLanguages` = 9 (bez DE_AT/EN_CA); `notTargets` = SK, EN_US.
- `regionalLanguageCodes`: DE_AT ← DE, EN_CA ← EN — osadiť raz z hotového 5-poľového záznamu, potom nezávislý záznam;
  storefront číta iba regionálny kód, **nikdy nepadá na DE/EN**.
- **Produkt vyžaduje name, description, seoTitle, seoDescription, slug** (null, "" aj medzery = chýba). Fallbacky v1
  (seoTitle → preložený názov, slug → base slug) sú preč. Slug musí spĺňať `^[a-z0-9]+(?:-[a-z0-9]+)*$` (všetky živé CS/DE
  slugy vo vzorke ho spĺňajú). Kategória, kolekcia, menu bez zmeny.
- `dependenciesOfARegionalCode`: pre kohortu sú to 5 polí produktu + preklady kategórií `stresne-nosice` a
  `nordrive-stresne-nosice` (4 polia pre stránku kategórie) v tom istom kóde. Product:9164 nenesie viditeľné atribúty,
  menu `navbar`/`footer` sú v Saleore prázdne (zmerané 18. 9.).

**Read-back:** schéma `maky.commerce2.l10n-readback/1` bez zmeny tvaru, prísnejšie pravidlá:

```bash
MAKY_L10N_READBACK_PATH=<súbor od CFM> node_modules/.bin/vitest run src/lib/saleor/exact-locale.contract.test.ts
```

Odmietne: kód mimo matice (napr. `EN_US`), `DE` čítané pre AT, `EN` pre CA, produkt bez seoTitle alebo slugu, zlý formát
slugu, menu kanála ≠ mena variantu.

**Revalidácia (požiadavka CFM bez zmeny):** `POST /api/revalidate` s `product.slug` = **base slug** a kanálom. Odpoveď pre
zahraničný kanál má navyše tag `product-miss:{kanál}:{locale}` (napr. AT: `product:…`, `category:…`, `fitment-offers:…`,
`product-miss:at-eur:de-AT`, `sitemap:…`). SK odpoveď je bajtovo rovnaká. Kritérium úspechu pre CFM platí ďalej
(200 + `success` + tag `product:<kanál>:<locale>:<slug>`). Preložený slug posielať netreba — storefront ho z udalosti odvodí
tagmi (§2.5).

## 2. M zapojenie (`5ce2f0b`) — čo chýbalo a čím je to dokázané

Lokálny build tohto commitu za read-only proxy pred produkčným Saleorom (iba `query`, mutácie 403, `cz-czk`/`at-eur` mapované
na SK listing a `DE_AT` → `DE`, aby sa dali skúsiť skutočné CS a DE riadky; ceny sú preto v EUR). `MAKY_LIVE_MARKETS=sk,cz,at`
iba lokálne.

1. **`isAvailableForPurchase` cez search:** fragment ho už mal (`c6bd62a`); provider → `SearchProduct.isPurchasable` (povinné) →
   karta: nedostupný produkt ostáva vo výsledkoch s textom „…není dostupný k objednání“. Cena karty vo formáte trhu
   (SK výstup identický, 9 súm). Screenshot desktop/mobil v CZ.
2. **Preložený slug end-to-end:** detail (`lookupBySlug` base → `slugLanguageCode`), listingy (`/cz/stresni-nosice` 12 odkazov na
   CS slugy), search, ponuky vozidlovej stránky (`/cz/stresni-nosice/alfa-romeo/156-crosswagon/156-crosswagon` → CS slugy)
   — tie už fungovali. Chýbalo: **hreflang a prepínač trhu** sa v iných trhoch pýtali URL slugom (v zahraničí preloženým) →
   produkt s preloženým slugom stratil všetky protějšky. Teraz `productCounterparts` cez **base slug**; SK PDP lokálne
   nesie `cs-CZ` na CS slugu a `de-AT` na DE_AT slugu.
3. **Prepínač trhu:** stránka produktu, kategórie a vozidla registruje ciele (vlastná `Suspense`, stránku nezdrží); bez
   protějšku → domov cieľového trhu; ostatné stránky → rovnaká cesta s vlastným slovom košíka. Klik v headless Chromiu:
   CZ PDP → `/sk/<base slug>`, CZ vozidlo → `/at/dachtraeger/…`, `/at/warenkorb` → `/cz/kosik`.
4. **Správne ID, kanálová cena, canonical:** PDP, JSON-LD a ponuky berú ID a cenu z kanála (bez zmeny); canonical a JSON-LD
   `url` = preložený slug trhu. SK PDP lokálne = produkcia (title, canonical, robots, h1, JSON-LD cena/dostupnosť).
5. **Stará URL bez reťazcov:** `/cz/<base slug>` vykreslí produkt bez presmerovania, canonical na CS slug;
   `/cz/products/<slug>` = **jeden** 308. (Redirect base → preložený slug by pri `/products/` vyrobil reťazec a v PPR ho
   stránka ani nevie poslať ako 30x.)
6. **Cache/revalidácia (existujúci endpoint, žiadny nový route ani secret):** nájdený zahraničný PDP má navyše tag base slugu,
   zahraničný not-found tag `product-miss:{kanál}:{locale}` (purge pri product, category aj nepomenovanej udalosti).
   ⚠️ **Zmerané, že tagy samy nestačili:** lookup fetch ležal v Data Cache (`revalidate: 300`, bez tagov) a po purge sa načítal
   späť. V zahraničí je preto jedinou vrstvou `"use cache"`; SK ostáva na 300 s fetch cache bez zmeny. Dôkaz lokálne:
   miss na `/cz/<cs slug>` → udalosť s base slugom → FOUND; cena na `/cz/<cs slug>` 87.99 → 11.11; premenovaný CS slug →
   stará URL not-found, nová found; SK scenár M4 (139 → 11.11) prechádza.

## 3. Čo sa nasadením zmení (a čo nie)

- **SK:** nič viditeľné. Všetkých 9 571 SK produktov má `isAvailableForPurchase: true` (zmerané), takže `c6bd62a` sa neprejaví;
  switcher pri jedinom živom trhu nie je rozbaľovací; SK revalidačná odpoveď rovnaká.
- **AT/CA:** čítajú `DE_AT` / `EN_CA`. Dnes 0 verejných produktov v 11 zahraničných kanáloch, takže nič nezmizne; stránka
  kategórie `/at/dachtraeger` a `/ca/roof-racks` bude not-found, kým CFM nezapíše preklady kategórií v regionálnom kóde.
  Vozidlové stránky (CFM artefakt `de`/`en`) sa nemenia.
- **DE a ostatné:** produkt bez seoTitle/slugu (napr. 235 post-bulk/pre-slug DE riadkov, Product:9164) v danom trhu neexistuje,
  kým CFM nedopíše.

## 4. Nasadenie — čaká na povolenie (Marek)

Ostrý `deploy-production.sh` (aj následný návrat checkoutu) zablokoval klasifikátor oprávnení nástroja. Preflight a
`--dry-run` nad `5ce2f0b` prešli (testy zelené, sudo, pamäť 11,3 GB, disk 86 GB, servíruje sa `_tWCo4Vh0f4z6oIe5Yk7V`).
`/opt/storefront` je **už na `5ce2f0b`**, takže nasadenie je jeden príkaz:

```bash
cd /opt/storefront && ./scripts/ops/deploy-production.sh -m "COMMERCE-2 exact-locale v2 + translated-slug wiring (5ce2f0b); SK unchanged"
```

Ak sa nasadzovať nemá, vrátiť strom k artefaktu:

```bash
cd /opt/storefront && git checkout codex/frontend-recovery
```

Po nasadení: `MAKY_DEPLOY_META` = `5ce2f0b…`; SK PDP/kategória/vozidlo/search 200 a zhodné s dneškom; POST revalidate bez
tajomstva 401; `/at/<slug>` a `/ca/<slug>` not-found + noindex (0 produktov); PM2 log bez `failed validation`.
Rollback = snapshot `ed7b153` (vznikne pri deployi).

## 5. Zahraničie: katalóg, nákup, indexovanie — poradie

1. M deploy `5ce2f0b` (§4) → SHA/BUILD_ID z hosta pre CFM.
2. CFM: základné jazyky (5 polí), potom DE_AT/EN_CA vrátane 2 kategórií; grouped ceny/listingy v existujúcej dráhe.
3. CFM grouped canary (viditeľný) → **M canary dôkaz** (verejné URL: PDP, listing, search, ponuka, hreflang, revalidácia).
4. Nákup: listing publikovaný + doprava, dane a Stripe kanála overené (Stripe konfigurácia 12 kanálov stále čaká na Mareka,
   `HANDOFF-20260916-M-integration-candidate.md` §6); `payment-canary.mjs` pod GO.
5. Indexovanie: `MAKY_LIVE_MARKETS` doplniť o trhy s publikovaným katalógom **+ rebuild** (hreflang statických stránok sa
   pečie pri builde). Nie skôr — pri 0 produktoch by do indexu išli prázdne trhy.

## 6. Nálezy pre CFM (dáta, nie storefront)

- Každý preložený produktový slug nesie interné ID: `…-cfmp-b-nor-9fbd74569243be-000000` (CS aj DE). Je to verejná URL.
- Rozsah rokov stráca pomlčku: SK `2004-2007`, CS/DE `20042007`; „Dachträger“ → `dachtrager` (kategória má `dachtraeger`).
- `seoTitle` kategórií `stresne-nosice` a `nordrive-stresne-nosice` v CS/DE je „MAKY.STORE“ — to bude `<title>` stránky kategórie.
- Preložené slugy musia byť po publikácii stabilné: Saleor nedrží históriu slugov, takže premenovanie = stará URL not-found
  (storefront to po udalosti správne vyčistí, ale presmerovanie nemá odkiaľ vziať).
- 18. 9.: kohorta 9 157 (`nordrive-stresne-nosice`); vo vzorke 100: CS 100 % úplné, DE 44 slugov / 64 seoTitle, PL 0 slugov,
      EN/DE_AT/EN_CA žiadne riadky.

## 7. Pasce

- Fetch vo vnútri `"use cache"` s `revalidate` má vlastný Data Cache záznam s tagmi aktívnymi v čase fetchu; `cacheTag()`
  pridaný po ňom ho nezasiahne. Test cez proxy to odhalil, unit testy nie.
- Prepínač: registrácia je kľúčovaná `window.location.pathname` (verejná cesta, nie interný rewrite).
- `prettier --write` na celý priečinok preformátuje aj cudzie súbory — neformátovať hromadne.
- Proxy/fitment postup: [[reference-local-readonly-saleor-proxy]]; kópia datasetu s `saleorInstance` `127.0.0.1:3458` a
  prepočítaným hashom sa nikdy nepublikuje.
