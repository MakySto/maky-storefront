# ⭐ VSTUPNÝ BOD PRE NOVÉ STOREFRONT VLÁKNO (M)

Napísané 11. 9. 2026. **Toto je jediný súbor, ktorý musí nové vlákno prečítať celý.**
Ostatné handoffy sú detail; tento je mapa.

Všetko označené „zmerané" som naozaj odmeral. Čo som nemohol overiť, je `NOT_RUN` alebo
`UNKNOWN` — a to nie je to isté ako `FAIL`.

---

## 0. Kde to je

|          |                                                                           |
| -------- | ------------------------------------------------------------------------- |
| Repo     | `MakySto/maky-storefront` (⚠️ **verejný fork** — CLAUDE.md §10.1)         |
| Vetva    | `claude/maky-store-integration-abcd-4e54c6`                               |
| **HEAD** | **`f5b3be0339a525ba0edf8fda894444ca54a41733`**                            |
| Základ   | `9304c579` (US/CA tip) — 17 commitov nad ním                              |
| Worktree | `/opt/storefront/.claude/worktrees/storefront-integration-handoff-4e54c6` |
| Stav     | pushnuté, **NENASADENÉ**, strom čistý                                     |
| Testy    | **1884 passed**, 9 skipped                                                |
| Rozsah   | 97 súborov, +7 992 / −316                                                 |

**Najprv over `git ls-remote`.** Ak sa vetva medzitým posunula, novší stav zachovaj —
tento SHA nie je príkaz na reset.

---

## 1. ⚠️⚠️ PRVÉ, ČO MUSÍ NOVÉ VLÁKNO VEDIEŤ: produkčný zápis

Pri M3 walkthrough som klikol „Pridať do košíka" proti lokálnemu `next start`, ktorý bol
nastavený na **produkčné** `NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/`.
`checkoutCreate` je **reálna mutácia** a v kóde **nie je žiadna sandbox poistka**.

**Následok:** v produkčnom Saleore existujú draft Checkout objekty (kanál `sk-eur`,
položka Peruzzo adaptér). Nie objednávka, nie platba, nič sa neúčtovalo, sklad sa
nerezervoval. **Nezmazal som ich** — tiché upratanie by zničilo dôkaz.

**Pre nové vlákno je to tvrdá podmienka:** pred ďalším add-to-cart / form testom musí
existovať **sandbox Saleor alebo guard v kóde**. Na „budem si pamätať" sa nespoliehaj.

---

## 2. Čo je HOTOVÉ (zmerané, nie deklarované)

### Balík A/B/C — `cf02f52`, `c5a493a`, `aaa39e9`

|                       |                                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A — footer**        | `isSk` skrýval **všetky** právne odkazy na 11 z 12 trhov. Teraz cez `marketHasRoute()`. Overené po hydratácii: **sk 10 odkazov, ostatných 11 po 9**, 85/85 cieľov HTTP 200.                                                                                        |
|                       | +18 prekladov (`footer.shippingAndPayment`, `footer.withdrawal` v 9 jazykoch), znenie zo schválených `heading` právnych rout.                                                                                                                                      |
| **B — tlač**          | V `src/` nebolo **ani jedno** `@media print`. Teraz `print:hidden` na chrome + jeden blok v `globals.css`. Overené cez CDP: A4 aj Letter = 1 strana, s otvorenou aj zavretou cookie lištou **bajt-identický** text, vo všetkých 12 trhoch screen↔print identické. |
| **C — cookies label** | `it`, `es`, `ro` menovali ovládač, ktorý footer nevykresľuje. **Taliančinu zadanie vynechalo** — `piè di pagina` sa láme cez dva riadky, raw-text scan ju minie.                                                                                                   |

### M2 — CMS consumer + SEO — `87f1def`, `a9ef79f`

- `cmsPageRoute` bol zamknutý na `isSlovakChannel()`, a **všetko pod tou bránou
  predpokladalo trh, ktorý vylučovala**: jeden `staticTitle`, jeden `Bootstrap`,
  firemný blok ako slovenská próza. Zmazanie dvoch riadkov by servovalo **slovenské
  SEO pod nemeckou URL**.
- Copy je teraz **per-trh**. Trh bez bootstrapu dostane pri výpadku **lokalizovaný
  „dočasne nedostupné"** — nie 404, lebo výpadok nie je zmazanie.
- **Navigácia sleduje CMS** (`cmsRouteAvailable`) — statická brána prvá a short-circuituje,
  takže 11 trhov CMS vôbec neosloví.
- `CompanyDetails` prekladá 4 popisky, **žiadne fakty**.
- **hreflang** dopojený do právnych rout (3 z 8 si stavajú metadata samy!) + sitemap
  odvodený z route-policy.

### M3 — zákaznícka cesta — `d5bfc47`, `0ae3229`, `eff1ab3`

- **Hlavička linkovala `/poradna` na 12 trhoch, kde 11 vracia 404** — z každej stránky,
  a Next to prefetchuje. `HeaderPrimaryNav` brala `channel` a zahodila ho.
- Search/účet/auth/sort **hovorili anglicky** na slovenskom e-shope
  (`/sk/login` = „Welcome Back"). Počet produktov nešlo opraviť reťazcom — slovenčina má
  3 plurálové tvary; `plp.productCount` ich už mal.
- **Screen-reader texty boli anglické** („Open menu", „Primary navigation", stĺpce
  objednávok).

### Kontrakt CMS + Contact (11. 9.) — `cc7d2ab`, `005ef58`, `9e9a7cc`, `4aa2324`, `52195c3`

|             |                                                                                                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2A**      | `parsePagesResponse` vracal `ok` s `layout: []` → `found` → stránka = len H1 + firemný blok. Reprodukované **P-čkinými 4 fixtúrami** (checksumy overené). Teraz autoritatívna neprítomnosť. Pravidlo úzko len pre `o-nas`. |
| **2B**      | Sitemap aj hreflang čítali len route-policy → po odpublikovaní držali URL. Teraz cez `publishedCmsMarkets` (rovnaké cachované čítanie + tag).                                                                              |
| **2C**      | **Zmerané, zámerne nezmenené.** Každý page-level outcome je HTTP 200. Rizikový `200+noindex` outage je **dnes nedosiahnuteľný**. Návrh v `ANALYSIS-20260911-cms-outage-status.md`.                                         |
| **Contact** | Kontrakt 1.3.0 vendorovaný (38 artefaktov, manifest SHA sedí s P). UI + Server Action. **Default OFF vo všetkých trhoch aj v deve.**                                                                                       |

---

## 3. Čo NIE JE hotové — stavová tabuľka

| brána                           | stav                              | prečo                                                                           |
| ------------------------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| `STATIC_A_C_READY`              | ✅                                | 12/12 trhov                                                                     |
| `CMS_CONSUMER_READY`            | ✅                                | vrátane content-not-ready a oboch zdieľaných locale párov                       |
| `O_NAS_STAGING_E2E_VERIFIED`    | **NOT_RUN**                       | **staging provider neexistuje** (P: `BLOCKED_ENV`)                              |
| `CMS_AVAILABILITY_SEO_VERIFIED` | ✅ fixtúry / **NOT_RUN** provider |                                                                                 |
| `CONTACT_UI_BFF_READY`          | ✅                                |                                                                                 |
| `CONTACT_STAGING_E2E_VERIFIED`  | **NOT_RUN**                       | žiadny provider nebol kontaktovaný                                              |
| `CUSTOMER_JOURNEY_READY`        | ⏳ čiastočne                      | navigácia/search/účet ✅; konfigurátor, Garáž, PDP set/BOM, sandbox checkout ❌ |
| `D_STATUS`                      | otvorené                          | **D1 sa NEDÁ postaviť** (zmerané)                                               |
| `SK_WITHDRAWAL_E2E_VERIFIED`    | **NOT_RUN**                       | R vlastní kontrakt                                                              |
| `DEPLOYED` / `INDEXABLE`        | ❌                                | samostatné rozhodnutia                                                          |

---

## 4. Ako pokračovať — poradie

### M4.1 — O nás E2E, keď P dodá staging (blokované na P)

P je explicitný: `CMS_STAGING_PUBLISHED = BLOCKED_ENV`, staging URL `null`.
**Consumer je hotový a čaká.** Keď staging existuje:

1. `route-policy.ts` — `o-nas` z `SK_ONLY` na trhy, ktoré CMS naozaj má (**jeden riadok**).
2. 12 URL, cold aj warm cache, **oba smery DE↔AT a US↔CA**.
3. `publish → update → unpublish → republish` cez reálnu invalidáciu.
4. Po každej zmene: stránka, header/footer, sitemap, hreflang.
5. **2C musí byť uzavreté PRED otvorením indexácie** pre CMS routu.

P dodá: provider SHA, ID/revíziu dokumentu, anonymné odpovede pre 10 locales,
výsledky publish/unpublish/invalidácie.

### M4.2 — Contact staging E2E (blokované na P/R)

Kontrakt 1.3.0 je implementovaný. Chýba beh proti skutočnému provideru + mail sinku:
new, duplicate, conflict, slow response, persist-then-timeout, zlyhanie jednej mail
vetvy, retry po reštarte, rate limit, cross-origin, správny jazyk.

⚠️ **`CONTACT_EMAIL_DELIVERY_MODE=live` vyžaduje osobitné GO.** Default je `off`.

### M4.3 — zvyšok M3 (NEBLOKOVANÉ — rob hneď)

Toto sa dá robiť bez P aj bez K:

- **Konfigurátor**: presný rok, nejednoznačná generácia/karoséria, explicitná strecha.
  ⚠️ Bez `MAKY_FITMENT_PROVIDER=fixture` je **prázdny — to je default, nie chyba**.
- **Garáž**: skúšanie ≠ automatické uloženie, odstránenie, limit.
- **PDP**: viditeľná kompatibilita, set/BOM, variant identity, skladom vs. na objednávku.
- **Košík/checkout**: kanálová izolácia (overené: `/de/cart` prázdny je **správne**),
  reálne delivery/payment kroky **v sandboxe**.
- **RAV4 regresia** — potrebuje fixtúru od C.
- **Hydration warnings** (#418/#419) — reprodukovať a triážovať, **nezakrývať**
  globálnym `suppressHydrationWarning`.

### M4.4 — D (`<html lang>`) — oddelene

**D1 je mŕtve** — zmerané: `headers()` v root layoute = build error pri
`cacheComponents` (`Uncached data was accessed outside of <Suspense>`), a `<html>` sa
nedá dať do Suspense. **Vyhoďte D1 z tabuľky možností.**

D2 (route groups) zachová statiku, lebo kanály sú známe v build-time. Blast radius:
16 súborov priamo v `src/app/` + `/checkout` mimo `[channel]`.

⚠️ Google výslovne hovorí, že jazyk stránky **neurčuje** podľa `hreflang` ani HTML `lang`
— argument pre D2 stojí na **prístupnosti**, nie na SEO.

### M4.5 — sitemap split (pred multi-market katalógom)

Zmerané: **9 610 URL / 2,1 MB** pri sk-only. Pri 12 trhoch ~**115 000 URL = 2× nad
limitom 50 000**. Delenie je **podmienka**, nie voľba. Malý content release pod limitom
tým neblokuj.

---

## 5. ⚠️ PASCE — každá ma stála čas

### Prostredie a build

1. **`pnpm build` NIE JE rozbitý.** Tri handoffy tvrdia, že padá na codegen hooku.
   Padá **len** preto, že `.env` je gitignorovaný a v čerstvom worktree chýba. S tromi
   `NEXT_PUBLIC_*` prejde celý reťazec vrátane hooku (34 s, peak RSS 1,01 GB).
2. **Fetch Data Cache PREŽIJE rebuild.** Pri meraní CMS outcomes treba
   `rm -rf .next/cache` medzi buildmi — inak sa prehráva prvá odpoveď.
3. **`generateMetadata` sa piecze v BUILD-time** pri `cacheComponents`. Zmena
   `MAKY_LIVE_MARKETS` na `next start` **nespraví nič**. Trh naživo = **rebuild**.
4. **`randomUUID()` v prerenderovanom Server Component = build error.**
5. V čerstvom worktree chýbajú `node_modules`, `src/gql/`,
   `src/checkout/graphql/generated/`, `.husky/_`.
6. `next start -H 127.0.0.1` = redirect loop.

### Meranie a testy

7. **Reálny `<footer>` nie je `<footer>` element v servovanom HTML** — v shelli je len
   skeleton, skutočná pätička príde do `<div hidden id="S:9">`. Split podľa tagu ticho
   neoddelí nič a nahlási 96/96. **Regresiu čítaj z hydratovaného DOM.**
8. **Next renderuje `hrefLang` (camelCase)** — `grep -c 'hreflang='` hlási 0 na stránke
   so 4. Používaj `grep -i`.
9. **Filtrovanie blokov podľa trhu je DVOJITÉ** (`page-schema.ts` + `cms-blocks.tsx`).
   Falzifikácia musí vypnúť **obidve**.
10. **Test, ktorý zrkadlí implementáciu, súhlasí so zastaranou verziou.** Sitemap test si
    držal vlastnú kópiu `staticPathsFor` — preto si nikto nevšimol pridanie kroku.
11. **Falzifikácia, ktorá príde zelená, je nález o teste.** Odstránenie trhovej brány
    nespravilo nič, kým jediný testovaný prípad bola CMS routa.
12. **`next-intl` číta bodku ako namespace separator.** Ploché kľúče `topic.x` padnú až
    v reálnom builde. A `t("topic")` na objekte = `INSUFFICIENT_PATH`.
13. Prettier v pre-commit hooku **prepisuje staged JSON** a rozbije checksumy —
    vendorované artefakty patria do `.prettierignore`.

### Vecné

14. **Konfigurátor a Garáž sú prázdne bez `MAKY_FITMENT_PROVIDER=fixture`** — to je
    dokumentovaný bezpečný default, **nie chyba**.
15. **Search berie `?query=`, nie `?q=`.**
16. **`/de/cart` prázdny pri plnom `/sk/cart` je SPRÁVNE** — košíky sú per-kanál.
17. **Cookie lišta je v poriadku.** Posun na screenshote je artefakt
    `captureBeyondViewport`. Používaj **viewport-only** capture.
18. `isWithdrawalFormServable()` vracia **true** mimo produkcie — Contact to zámerne
    nekopíruje.

---

## 6. Ako to spustiť

```bash
cd /opt/storefront/.claude/worktrees/storefront-integration-handoff-4e54c6
export NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/
export NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur
export NEXT_PUBLIC_STOREFRONT_URL=https://maky.store
pnpm install --frozen-lockfile --ignore-scripts && node_modules/.bin/husky install
node_modules/.bin/tsc --noEmit && node_modules/.bin/eslint && node_modules/.bin/vitest run
pnpm run i18n:check
pnpm build && node_modules/.bin/next start -p 3457    # nikdy -H 127.0.0.1
```

⚠️ **Toto ukazuje na PRODUKČNÝ Saleor.** Na čítanie je to v poriadku; **na mutácie nie**
— pozri §1.

Prepínače: `MAKY_FITMENT_PROVIDER=fixture` (konfigurátor), `MAKY_LIVE_MARKETS="sk,cz,de"`
(hreflang, **build-time**), `MAKY_CONTACT_FORM_MARKETS=sk` (formulár, default prázdne).

Headless Chromium: `~/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`, cez CDP
obyčajným Node. Chrome zabíjaj cez `pgrep -x chrome`, **nikdy `pkill -f`**.

Harness v scratchpade tohto vlákna (`cdp.mjs`, `regress-dom.mjs`, `mock-cms.mjs`) —
skopíruj ho, je overený.

---

## 7. Koordinácia

| vlákno          | vlastní                                                        | stav pri odovzdaní                                    |
| --------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| **M** (toto)    | storefront: routy, navigácia, CMS consumer, UI, Contact UI/BFF | `f5b3be0`                                             |
| **P** (Payload) | O nás obsah, Contact backend                                   | P0 `daf94f3e`, P1 `f2b8163` — **staging BLOCKED_ENV** |
| **R** (Returns) | Returns/Withdrawal kontrakt                                    | SK backend live, UI chýba                             |
| **K** (Saleor)  | kanály, ceny, dane, doprava, Stripe                            | 12 kanálov, us/ca 0 produktov                         |
| **C** (CFM)     | katalóg, fitment, kategóriové texty                            | 1 475 stránok, **15 textov**, zvyšok čaká na rozpočet |

⚠️ **Payload stroj (`/opt/payload/...`) nie je z tohto boxu dostupný.** Artefakty ber
cez GitHub (`MakySto/maky-cms`), read-only.

⚠️ **CFM**: 1 475 vozidlových stránok je **draft**, obsah ide **samostatným artefaktom**
`maky_catalog_content_*.json` (nie cez fitment 3.0.0). Storefront ho **ešte nečíta** —
to je otvorená úloha pre M, podklad v `CFM_CONTENT_DELIVERY_20260911.md` v CFM repe.
⚠️ `CatalogPage.public_id` **nie je** to isté ako fitment `veh:*` ID — nepredpokladaj rovnosť.

---

## 8. Hranice

Vlastný worktree, integračná vetva, bežný push. **Žiadny** deploy, PM2, produkčný `.env`,
zmena trhových flagov, CMS publish, platba, refundácia, zásielka, živé podanie ani export
CFM do Saleoru bez osobitného GO. **Toto nie je oprávnenie mergeovať do `release/*` ani
`main`.** Produkčné secrety nikdy do worktree ani commitu — repo je **verejný fork**.

Lokálne testy **nie sú** GitHub CI. Produkčný SHA a BUILD_ID sa čítajú z
`MAKY_DEPLOY_META`, nevymýšľajú sa.
