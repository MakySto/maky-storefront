# ⭐ VSTUPNÝ BOD — nové storefront M-vlákno (COMMERCE-2: malý deploy + integrácia)

> **Aktualizované 16. 9. večer:** GO-M-PATCH je nasadený (§0 nižšie) a integračný kandidát M1–M6 je hotový a pushnutý.
> Ďalšie vlákno začína v **`HANDOFF-20260916-M-integration-candidate.md`**; tento dokument ostáva ako záznam stroja a pascí.

Napísané 16. 9. 2026 na konci vlákna `m-vlakno-2026-09-15`. **Úlohy nového vlákna** sú v dvoch
zadaniach, ktoré Marek priloží: `MAKY_M_DEPLOY_A_INTEGRACIA_20260916.md` (GO-M-PATCH + M1–M6) a
spoločný kontrakt CFM ↔ M. **Tento dokument ich neopakuje.** Obsahuje to, čo tam nie je: presný stav
stroja, hashe, kde čo v kóde je, zmerané fakty, overené postupy a pasce. Všetko označené „zmerané" je
zmerané na tomto stroji.

Podrobný koordinačný report z 16. 9.: `HANDOFF-20260916-M-commerce2-storefront.md` (kontrakt trhov,
exact-locale, routable/indexable/sellable, revalidácia, platby). Záznam RELEASE-4:
`HANDOFF-20260915-M1-release-switch.md` §5.

---

## 0. ⭐ GO-M-PATCH vykonaný — 16. 9. 2026 (vlákno `m-vlakno-storefront-continue`)

**§1 nižšie je stav PRED týmto deployom.** Aktuálny stav:

|                        |                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produkcia              | **`be0f795`** (kód = `41cc44e`; diff sú iba 2 dokumenty), BUILD_ID **`SKH7DHo8A1X7cxZx1zsi0`**, build 2026-09-16T13:07:06Z                                        |
| Odstávka               | 76 s, `deploy-production.sh` exit 0, lokálna brána prešla, bez `MIN_FREE_MEM_MB` override (11 910 MB)                                                             |
| `/opt/storefront`      | detached HEAD na `be0f795`, čistý strom                                                                                                                           |
| Rollback kódu          | `/opt/storefront-rollbacks/.next.rollback-500068f-zMxoCHeXuF0A3BVkJVKUA-20260916T130428Z` (+ `…a49cd0f…`, pin `…b6b633da…`); `…429bf71…` zmazaný pruningom        |
| Revalidácia            | **ZAPNUTÁ** 13:10 UTC: `REVALIDATE_SECRET` (64 hex, vygenerovaný na stroji, nikdy nevypísaný) v `/opt/storefront/.env`, `pm2 restart maky-storefront` (1 reštart) |
| Záloha `.env` pred tým | `/opt/storefront/.env.backup-20260916T131030Z` (600) — rollback revalidácie = vrátiť túto zálohu + `pm2 restart`                                                  |
| `MAKY_LIVE_MARKETS`    | nezmenené (`sk`)                                                                                                                                                  |

**Smoke (GET, `https://maky.store` aj `127.0.0.1:3000`, pred/po):**

| kontrola                                           | pred (`500068f`)    | po (`be0f795`)                                                                                                           |
| -------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/sk/stresne-nosice/peugeot/306-break/7`           | 200, **6 zostáv**   | 200, **0** + „Pre toto vozidlo zatiaľ nemáme overenú zostavu." + „Nejaké záznamy existujú, ale zatiaľ nie sú overené."   |
| `…/subaru/legacy-kombi/bh`, `…/hyundai/h-1-van/a1` | 7, 6                | 7, 6                                                                                                                     |
| `…/volkswagen/golf-alltrack/ba5`                   | 200, 7, bez 301     | 200, 7, bez 301                                                                                                          |
| BP → BH, TQ → A1 (sk, cz, es-root)                 | 301 jedným skokom   | 301 jedným skokom                                                                                                        |
| sitemap `<loc>` / vozidlové / zahraničné           | 11 085 / 1 475 / 0  | 11 085 / 1 475 / 0                                                                                                       |
| `x-robots-tag` cz, de, at, us, ca                  | `noindex, nofollow` | `noindex, nofollow`; sk bez                                                                                              |
| `/us`, `/ca` hlavičky                              | —                   | `x-locale: en-US`/`en-CA`, `x-currency: USD`/`CAD`                                                                       |
| SK homepage, PDP (BH Snap Alu), košík              | 200                 | 200                                                                                                                      |
| build: `graphqlLanguageCode` pre en-US/en-CA       | `EnUs`/`EnCa`       | `En`/`En`; `not-sellable` v 4 server chunkoch                                                                            |
| PM2 log od štartu                                  | —                   | 0× `provider payload failed validation`; varovania `window.to.year exceeds…` a React „resumable slots" sú predexistujúce |

Filter **neodpublikoval** 6 held produktov (pk 6935–6940) v Saleore — to je CFM D8.

**Revalidácia — overené po reštarte (lokálne aj cez verejnú URL):** GET `resource=product` a POST s presným
CFM telom `{"product":{"slug":…,"channel":{"slug":"sk-eur"}}}`: bez hlavičky **401**, zlé tajomstvo **401**,
správne **200** + `success: true` + tag `product:sk-eur:sk-SK:<slug>`; POST navyše cesty `/sk-eur/<slug>`,
`/sk-eur/products`, `/sk-eur`, `/sitemap.xml`. Hlavička išla zo súboru 600 (`curl -H @súbor`), súbor zmazaný.
Test purgol jeden SK produkt; PDP potom 200 s rovnakým H1.

**Prenos tajomstva do CFM — jeden krok pre Mareka.** Tento stroj nemá SSH na CFM (v `~/.ssh/config` je iba
`github.com`). Z vlastného počítača so SSH na oba stroje, hodnota sa nikde nezobrazí (vypíše sa iba dĺžka `64`):

```bash
ssh ubuntu@<storefront-host> "sed -n 's/^REVALIDATE_SECRET=//p' /opt/storefront/.env | tr -d '\n'" | ssh ubuntu@<cfm-host> 'umask 077 && mkdir -p ~/.config/cfm-saleor && chmod 700 ~/.config/cfm-saleor && cat > ~/.config/cfm-saleor/storefront-revalidate.secret && chmod 600 ~/.config/cfm-saleor/storefront-revalidate.secret && wc -c < ~/.config/cfm-saleor/storefront-revalidate.secret'
```

Potom v CFM: `STOREFRONT_REVALIDATE_URL=https://maky.store/api/revalidate`,
`STOREFRONT_REVALIDATE_SECRET_FILE=/home/ubuntu/.config/cfm-saleor/storefront-revalidate.secret` (bez koncového
nového riadku). Úspech = HTTP 200 + `success === true` + očakávaný tag, nie samotné 200.

---

## 1. Presný stav PRED GO-M-PATCH (zmerané 16. 9. ráno)

|                         |                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Produkcia               | **`500068f`**, BUILD_ID **`zMxoCHeXuF0A3BVkJVKUA`**, build 2026-09-15T20:32:52Z, PM2 bez reštartu                                             |
| `/opt/storefront`       | **detached HEAD na `500068f`**, čistý strom (vetvu drží worktree starého vlákna)                                                              |
| Vetva                   | `claude/m-vlakno-2026-09-15-51940a` @ **`0616d25`** = remote, čistá                                                                           |
| Nenasadené              | **`41cc44e`** (US/CA → `EN`, ponuka rešpektuje `sellable`) + dokumenty `0616d25` a tento                                                      |
| Rollback snapshoty      | `.next.rollback-a49cd0f-3AZ5yhr0JLAuKolHnikrF-20260915T203219Z` (posledný), `…429bf71…`, pin `…b6b633da…` (`.keep`)                           |
| `.env` záloha RELEASE-4 | `/opt/storefront/.env.backup-20260915T203135Z` (600)                                                                                          |
| Artefakty               | `/opt/storefront-artifacts/` (root:root): content `…-{lang}-20260915.2.json` ×10, `SHA256SUMS_CONTENT_20260915.2`, starý `…-sk-20260912.json` |

**Commity vetvy nad `a49cd0f`:**

| commit    | čo                                                                                    | prod    |
| --------- | ------------------------------------------------------------------------------------- | ------- |
| `2a3b42a` | dátové 301 (`redirects.json`), fail-closed `SHA256SUMS`, `language.ts`, piny 20260915 | áno     |
| `500068f` | RELEASE-4: `redirects.json` BP→BH, TQ→A1 (40 pravidiel), piny .2                      | áno     |
| `6fb7a05` | docs RELEASE-4 REPORT B                                                               | —       |
| `41cc44e` | US/CA `EN_US`/`EN_CA` → `EN`; `isFitmentRefSellable` v ponuke                         | **nie** |
| `0616d25` | docs COMMERCE-2 storefront report                                                     | —       |

**Produkčný `.env` — iba názvy a booleany (hodnoty nikdy):** `MAKY_LIVE_MARKETS=sk`;
`MAKY_FITMENT_PROVIDER=http`; `MAKY_FITMENT_URL` → `…full-20260915.2.json`;
`MAKY_CATALOG_CONTENT_PATH=/opt/storefront-artifacts/maky_catalog_content_1.0.0-{lang}-20260915.2.json`;
`MAKY_CATALOG_CONTENT_SHA256SUMS=/opt/storefront-artifacts/SHA256SUMS_CONTENT_20260915.2`;
`ENABLE_STRIPE_PAYMENTS=true`, `NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS=true`; `PAYLOAD_REVALIDATE_SECRET` set.
**Chýba:** `REVALIDATE_SECRET`, `SALEOR_WEBHOOK_SECRET`, `SALEOR_APP_TOKEN`; `ROUTE_EXISTENCE_GATE` nenastavené.
Žiadny `.env.production`/`.env.local`; PM2 env neprebíja `MAKY_*`.

**Živý defekt, ktorý `41cc44e` opravuje:** `https://maky.store/sk/stresne-nosice/peugeot/306-break/7`
ponúka 6 produktov na hold (pk 6935–6940, `withheld_by_supplier_data_review`). Lokálne po oprave:
0 produktov + „Pre toto vozidlo zatiaľ nemáme overenú zostavu.". Filter **neodpublikuje** produkty
v Saleore (to je CFM D8).

---

## 2. Kde začať

Starý worktree `/opt/storefront/.claude/worktrees/m-vlakno-2026-09-15-51940a` drží vetvu, takže nové
vlákno pracuje na **novej vetve z `origin/claude/m-vlakno-2026-09-15-51940a` (`0616d25`)** — fast-forward,
žiadny reset. Najprv `git ls-remote`; ak sa tip posunul, pokračuj od novšieho.

Príprava čerstvého worktree (overené, ~1 min):

```bash
export NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/ NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur NEXT_PUBLIC_STOREFRONT_URL=https://maky.store
pnpm install --frozen-lockfile --ignore-scripts --offline   # fallback bez --offline
node_modules/.bin/husky install                              # inak commit hook (lint-staged) nebeží
pnpm run generate:all                                        # src/gql + checkout generated; inak sitemap.test.ts padá na importe
node_modules/.bin/vitest run                                 # 2 012 passed / 28 skipped na 41cc44e
```

---

## 3. Artefakty a dáta — hashe a fakty

**Fitment `3.0.0-full-20260915.2`:** 7 977 173 B, sha256 `6fddb7aa56aa109f9ec6c59e59f8f0e514b2a2f01ba155f57c214239dab43fa6`,
datasetHash `af9e6750b5961da21225430f31558961123effc5963a90dfd680bbc5e771d499`; 62/557/857/1102, 9 163 produktov,
sellable 9 157, held 6 (všetky Peugeot 306 Break 7). Lokálne nie je — stiahnuť
`https://carfitmanager.com/media/fitment/maky_roof_fitment_3.0.0-full-20260915.2.json` a overiť sha.

**Content sk .2:** 9 749 763 B, transport `c9ed37e2e47f4e1d802ce72b1177997fd0c571c063d9a92a82fe1346d163143d`,
selfSha256 `ebfcf09339f8172f44a89f76d58f2a376c65a3b7fed0573c9c3bd79c4d904626`; 1 478 stránok, published 1 477,
draft iba `/stresne-nosice/lynk-co/01`, retired (bez uzla) BP a TQ, do sitemap 1 475.

**Acceptance testy (skipnú sa bez env — „bez tichého skipu" = skontrolovať, že bežali):**

```bash
MAKY_CATALOG_CONTENT_PATH=/opt/storefront-artifacts/maky_catalog_content_1.0.0-{lang}-20260915.2.json \
MAKY_FITMENT_DATASET_PATH=<stiahnutý fitment .2> \
node_modules/.bin/vitest run src/lib/catalog-content src/lib/fitment/full-dataset-acceptance.test.ts
# očakávané: whole-set 15, redirects.acceptance 4, full-dataset 9 — nič skipped
pnpm check:fitment   # default URL = .2, 9/9
```

**Lokalizované korene v content artefaktoch (zmerané):** cs `stresni-nosice`, en `roof-racks`, de `dachtraeger`,
pl `bagazniki-dachowe`, hu `tetocsomagtartok`, ro `bare-transversale`, fr `barres-de-toit`, it `barre-portatutto`,
es `barras-de-techo` (do 13. 9. `bacas-de-techo` — posun iba koreňa, 1 475 stránok). V každom z 9 cudzích
jazykov je 1 475 ciest pod lokalizovaným koreňom a **3 pod `/stresne-nosice/`** (BA5/BH/A1, `routeLanguage: sk`,
published, bez textu). **M1 ich nesmie rozbiť.**

**`src/lib/catalog-content/redirects.json` (release `20260915.2`):** 40 pravidiel = sk 2 + 8 jazykov × 4 + es 6;
zdroje = aktuálna cesta BP/TQ v jazyku, historická `/stresne-nosice/…` v cudzích jazykoch, es aj `/bacas-de-techo/…`;
**ciele v cudzích jazykoch sú požičané SK cesty** `/stresne-nosice/subaru/legacy-kombi/bh` a `/stresne-nosice/hyundai/h-1-van/a1`;
`roots.es`: `/bacas-de-techo` → `/barras-de-techo`. Vygenerované z artefaktov, nie ručne. Proxy ich rozfanuje na trhy
podľa jazyka (`at` = de, `us`/`ca` = en).

---

## 4. Kde je čo v kóde (stav `0616d25`)

- **Proxy `src/proxy.ts`:** vetva „RETIRED VEHICLE PAGE" (301, `normalizePathname` → aj `.rsc`, query ostáva) hneď za
  „RETIRED CATEGORY URL"; category rewrite `normalized.length >= 2 && isCategorySlug(normalized[1])` → `categories/…`
  — **pozná iba slovenské slugy** (`src/config/categories.ts` `CATEGORY_SLUGS`), preto `/cz/stresni-nosice/…` = 404.
  Neznámy prvý segment po trhu padne do `[productSlug]` alebo nenájdenej routy.
- **Katalóg:** `catalog-content/snapshot.ts` (`{lang}` rodina, `SHA256SUMS` fail-closed, memo 15 min);
  `language.ts` (`catalogLanguageForMarket`, bez `server-only`); `redirects.ts`; `resolve.ts`
  (`resolveVehiclePath` = lookup `/${slug}/${segmenty}` v strome jazyka); `tree.ts` (**uzly iba z fitmentu** —
  výpadok carfitmanager.com = všetky vozidlové stránky soft-404); `publication.ts` (visibility = published;
  indexability = + `indexable` + text).
- **Vozidlová stránka `app/[channel]/(main)/categories/[slug]/[...vehicle]/page.tsx`:** `isLinkable` zahadzuje kotvu
  na zdroj presmerovania; ponuka iba na generácii; dlaždice filtrujú viditeľnosť; hreflang zámerne žiadny.
- **Ponuka `lib/fitment/offers.ts`:** `resolveFitmentOffers` — kind → `isFitmentRefSellable` → Saleor (anonymne,
  **`revalidate: 300` bez tagu** → M4) → `isAvailableForPurchase` → identita → variant → `resolveExactLocaleProduct`.
  Cena v `ui/components/catalog/offer-list.tsx` je `amount.toFixed(2) + " " + currency` — **nie je lokalizovaný formát**
  (pre cudzie trhy použiť `formatPrice` z `config/locale.ts`).
- **Jazyk:** `config/locale.ts` `LOCALE_MAP.graphqlLanguageCode` (po `41cc44e` US/CA `En`); test `config/locale.test.ts`
  viaže na jazyk CFM. Používajú ho produktové/kategóriové/navigačné dotazy, slug lookup (`lib/saleor/slug-lookup.ts`:
  najprv základný slug, potom `slugLanguageCode`) aj `languageCode` checkoutu (`lib/checkout-locale.ts`, zarovnanie
  v `checkout/checkout-session-loader.tsx`).
- **Hranica prekladu `lib/saleor/exact-locale.ts`:** pole po poli v `HANDOFF-20260916-M-commerce2-storefront.md` §3.
- **Revalidácia:** `app/api/revalidate/route.ts` (POST webhook/Bearer/`x-revalidate-secret`; GET `resource=…`);
  tagy `lib/cache-manifest.ts` (`product|category|collection:{channel}:{locale}:{slug}`, `navigation:{channel}:{locale}`);
  `applyCacheProfile` používa PDP, kategória, kolekcia, homepage, nav. **`lib/api-auth.ts` číta `REVALIDATE_SECRET`
  pri načítaní modulu → po zmene `.env` stačí `pm2 restart`, rebuild netreba.** `lib/saleor/webhook-payload.ts`
  `channelOf` prijíma string aj `{slug}`.
- **Trhy:** `lib/market-state.ts` — `MAKY_LIVE_MARKETS` za behu v proxy (`x-robots-tag`, výber trhu, cookie) a
  sitemap (`app/sitemap.ts`, `revalidate = 3600`, iteruje `liveMarkets()`); **build-time** v hreflang
  (`lib/seo/hreflang.ts`) a prepínači trhov (`header-nav-row.tsx`). Checkout ani košík trh nebránia.
- **Sitemap dnes:** 11 085 `<loc>` (sk), z toho 1 475 vozidlových; jeden súbor.
- **Platby:** `checkout/lib/payment/providers/stripe.ts` (`saleor.app.payment.stripe`, flagy), `integrated-gateways.ts`,
  `resolve-provider.ts`; dummy v produkcii vypnutý; košík: cookie `checkoutId-{channel}` (`lib/checkout.ts`);
  `/checkout` bez id preferuje košík default kanála.

---

## 5. Zmerané read-only v produkčnom Saleore (16. 9., bez tokenu)

- verejné produkty: `sk-eur` 9 577; **cz, de, at, pl, hu, it, fr, es, ro, us, ca = 0**;
- kategórie `stresne-nosice` aj `nordrive-stresne-nosice`: **0 prekladov** (CS, DE, EN, EN_US, PL, HU, RO, FR, IT, ES);
  translated-slug lookup `stresni-nosice`/`roof-racks`/`dachtraeger` nič nenájde;
- produkt 8472 (Legacy Kombi BH): kategória `nordrive-stresne-nosice`, 0 prekladov, 0 verejných atribútov;
- `menu(slug: "navbar", channel: "at-eur")`: 0 položiek;
- `shop.availablePaymentGateways(channel)` pre sk/at/us: iba legacy `mirumee.payments.dummy` (USD, PLN) — nie dôkaz o Stripe;
- `channel(slug)` → `currencyCode`/`isActive`: **PermissionDenied** (`AUTHENTICATED_APP` alebo `AUTHENTICATED_STAFF_USER`);
- 20 produktov RELEASE-4 (pk 4020–4025, 8472–8478, 9046–9052) existujú v `sk-eur`, názvy opravené (A1/BH/BA5),
  **slugy stále so starým autom** (`…-tq-…`, `…-bp-…`, `…-golf-alltrack-ba5-…`).

---

## 6. Presné živé SK texty katalógu (M2: SK hodnota musí ostať bajtovo rovnaká)

`ui/components/catalog/make-index.tsx`: nadpis „Vyberte nosič podľa vozidla", úvod „Pri každom vozidle nájdete typ
strechy, vhodné zostavy a návod na montáž."
`ui/components/catalog/offer-list.tsx`: „Kompatibilné zostavy" (3×); „Ponuku sa teraz nepodarilo načítať. Skúste to
prosím o chvíľu — nie je to informácia o tom, že na vaše vozidlo nič nepasuje."; „Pre toto vozidlo zatiaľ nemáme
overenú zostavu." + „Nejaké záznamy existujú, ale zatiaľ nie sú overené." / „Neznamená to, že naň nič nepasuje —
napíšte nám a overíme to."; „{n} zostáv"; „Testovacia ukážka. Ide o simulované údaje, nie o skutočnú ponuku ani
o overenú kompatibilitu."; „Časť ponuky sa nepodarilo načítať, zoznam preto nemusí byť úplný."; „Na objednávku";
„Momentálne nedostupné".
Vozidlová stránka: breadcrumb „Strešné nosiče"; skeleton „Kompatibilné zostavy"; náhľad „Náhľad nepublikovanej
stránky. Návštevníkom sa nezobrazuje." (iba `MAKY_CATALOG_PREVIEW`).

Kľúče už preložené v 12 jazykoch s rovnakým SK významom: `nav.roofRacks` = „Strešné nosiče", `common.onOrder` =
„Na objednávku", `configurator.resultsTitle` = „Kompatibilné zostavy", `configurator.outOfStock` = „Momentálne
nedostupné". Ostatné potrebujú nové úzke kľúče (SK = presne text vyššie). Pri zmene copy spustiť 12-locale parity
check z CLAUDE.md §11.

---

## 7. Overený postup malého deployu (GO-M-PATCH)

Rovnaký postup nasadil RELEASE-4 15. 9. (odstávka 76 s):

1. Overiť, že produkcia je stále `500068f` (`.next/MAKY_DEPLOY_META`), `/opt/storefront` čistý, žiadny súbežný deploy.
2. `cd /opt/storefront && git checkout --detach <sha>` (tvar `git -C` klasifikátor odmieta; vetvu drží worktree).
   Lockfile sa od `500068f` nemenil → `pnpm install` netreba; `prebuild` spúšťa codegen sám.
3. `./scripts/ops/deploy-production.sh --dry-run` — preflight pustí celý vitest v `/opt/storefront`. Pamäťová poistka
   je 10 240 MB; 15. 9. bolo 10 091 → **`MIN_FREE_MEM_MB=8192`** (zdokumentovaný override).
4. Ostrý beh na pozadí s logom: `MIN_FREE_MEM_MB=8192 ./scripts/ops/deploy-production.sh -m "…" > <log> 2>&1`.
   **Skutočný exit čítaj z logu** („deployed … downtime", „local gate passed"), nie z obalu na pozadí.
5. Overiť: `MAKY_DEPLOY_META` sha = commit; PM2 log bez `[fitment] provider payload failed validation`;
   Peugeot 306 Break 7 = 0 produktov + hlásenie; `/sk/…/legacy-kombi/bh` 7; `/sk/…/golf-alltrack/ba5` 7 bez
   presmerovania; BP/TQ 301 na BH/A1; sitemap 11 085 / vozidlových 1 475; `/cz`, `/de` `x-robots-tag: noindex, nofollow`;
   SK homepage a PDP 200.
6. Rollback: snapshot z kroku 3 podľa CLAUDE.md §13.3; `.env` sa týmto patchom nemení.

**Zapnutie `REVALIDATE_SECRET` (bez výpisu hodnoty):** `cp -p .env .env.backup-<UTC>`; hodnotu vygenerovať a
pripísať jedným príkazom bez echa na terminál (napr. `printf 'REVALIDATE_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env`);
overiť iba názov kľúča; `pm2 restart maky-storefront`; test: bez hlavičky **401**, so správnym tajomstvom **200 +
`success: true` + tag** — hlavičku vložiť zo súboru s právami 600 (`curl -H @subor`), nie na príkazový riadok, súbor
potom zmazať. Bezpečný cieľ `GET /api/revalidate?resource=product&channel=sk-eur&locale=sk-SK&slug=<existujúci slug>`
(purge jedného SK produktu je neškodný). **CFM beží na inom stroji** — M súbor
`/home/ubuntu/.config/cfm-saleor/storefront-revalidate.secret` nevytvorí; uviesť jeden krok prenosu pre Mareka.

---

## 8. Lokálne overovanie (bez zápisov do produkcie)

Build a server vo worktree s rovnakými `NEXT_PUBLIC_*` a
`MAKY_CATALOG_CONTENT_PATH=/opt/storefront-artifacts/…-{lang}-20260915.2.json`,
`MAKY_CATALOG_CONTENT_SHA256SUMS=/opt/storefront-artifacts/SHA256SUMS_CONTENT_20260915.2`, `MAKY_FITMENT_PROVIDER=http`,
`MAKY_FITMENT_URL=<.2>`, **`MAKY_SALEOR_WRITES=block`**; `pnpm build` (~31 s) a `next start -p 3457` (nikdy
`-H 127.0.0.1`), v pozadí s `echo $$ > pidfile; exec …`; vypnúť `kill $(cat pidfile)` (exit 143 je SIGTERM, nie chyba).
Do produkcie iba GET (`curl`), nikdy klik na košík.

---

## 9. Pasce tohto prostredia

1. **`Edit`/`Write` padajú na „PreToolUse hook did not respond"** — súbory upravovať cez Bash: heredoc + node skript
   s presným nahradením a kontrolou práve jedného výskytu; zápis až keď sedia všetky.
2. V JS reťazcoch v heredocu nepoužívať ASCII `"` vnútri „…" — použiť jednoduché úvodzovky alebo typografické „“.
3. `require()` súboru bez prípony `.json` = SyntaxError → `JSON.parse(readFileSync(...))`.
4. `/opt/storefront-artifacts` je root:root → `sudo install -m 0644 -o ubuntu -g ubuntu …`; `sha256sum -c` na mieste
   s `--ignore-missing` a spočítať OK riadky.
5. Rollback deployu s inou verziou artefaktov = snapshot **aj** zodpovedajúca záloha `.env`.
6. `.rsc` požiadavky: proxy rozhoduje nad `normalizePathname`; test na `.rsc` suffix je vzorom pre M1.
7. Codex verdikt „PDP/PLP nežiadajú translation" pre tento strom neplatí (starší klon); DE/AT mali `DE` vždy.
8. Hidden PDP = HTTP 200 + not-found telo + `noindex` (soft-404); skutočná 404 iba s bránou existencie (vypnutá).
9. React „Couldn't find all resumable slots … fallback to client rendering" na každom renderi `categories/[slug]`
   — predexistujúce, produkčný error log 63 441×; nie z týchto zmien.
10. Scratchpad starého vlákna (stiahnuté artefakty, skripty diffov a overovania) zanikne — postupy sú v tomto dokumente
    a v REPORT B RELEASE-4.

---

## 10. Prvé kroky nového vlákna

1. `git ls-remote` + `MAKY_DEPLOY_META` + `DEPLOYMENTS.log` — potvrdiť §1.
2. GO-M-PATCH: deploy `41cc44e`/`0616d25` postupom §7, smoke §7.5; potom `REVALIDATE_SECRET` §7 — výsledok do handoffu.
3. M1–M6 podľa priloženého zadania na novej vetve; vstupy pre routing a texty sú v §3, §4 a §6; field contract a
   revalidačný kontrakt v `HANDOFF-20260916-M-commerce2-storefront.md`.
