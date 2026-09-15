# M-1 · prepnutie CFM vydania: kód hotový, nasadenie čaká na náhradné vydanie

Napísané 15. 9. 2026 v M-vlákne. **Nič nie je nasadené.** Kód na prepnutie fitmentu a contentu,
dátové 301 a fail-closed pin manifestu sú hotové a otestované. Vydanie CFM `20260915` sa
**nenasadzuje** (GO-M upravené): všetkých 20 produktov, ktoré VOZIDLA-2 presunulo, je v ňom
stále `hold` / `sellable:false`. CFM pripravuje náhradné vydanie (`CFM-RELEASE-4`). Keď príde
jeho handoff a sedia presné acceptance kritériá (§3), M dokončí test, build a nasadenie
atomicky podľa už udeleného GO — ďalšie GO netreba.

Všetko označené „zmerané" som odmeral na tomto stroji.

---

## 0. Kde to je

|             |                                                                                      |
| ----------- | ------------------------------------------------------------------------------------ |
| Repo        | `MakySto/maky-storefront` (⚠️ verejný fork — CLAUDE.md §10.1)                        |
| Vetva       | `claude/m-vlakno-2026-09-15-51940a`                                                  |
| Základ      | `a49cd0f` = produkcia, BUILD_ID `3AZ5yhr0JLAuKolHnikrF` (z `MAKY_DEPLOY_META`)       |
| Prod `.env` | fitment `20260907.2` (HTTP), content pevný `sk-20260912` + `_SHA256` — **nezmenené** |

Vydanie z 13. 9. nasadené nebolo; ES presmerovanie koreňa z neho je v tejto vetve.

---

## 1. Čo je v kóde

| súbor                                                              | čo robí                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/catalog-content/redirects.json`                           | tabuľka retired stránok, kľúč = jazyk CFM, cesty bez prefixu trhu; `exact` (cesta → cesta) a `roots` (koreň → koreň). Dnes: 1121 Legacy Kombi BP a 1348 H-1 Van TQ v 10 jazykoch vrátane historických ciest, ES `/bacas-de-techo` → `/barras-de-techo`. Vygenerovaná z artefaktov 20260915, zhoda so správou CFM 100 %. |
| `src/lib/catalog-content/redirects.ts`                             | lookup: trh číta tabuľku jazyka svojho katalógu (`at` = `de`, `us`/`ca` = `en`); presné pravidlo, potom posun koreňa zložený s presným pravidlom → vždy jeden skok                                                                                                                                                      |
| `src/proxy.ts`                                                     | vetva „RETIRED VEHICLE PAGE" hneď za retired category URL: **301**, rozhoduje normalizovaná cesta (aj `.rsc`), query zostáva                                                                                                                                                                                            |
| `src/app/[channel]/(main)/categories/[slug]/[...vehicle]/page.tsx` | `isLinkable` nepustí odkaz na zdroj presmerovania — texty modelov Legacy Kombi a H-1 Van odkazujú na BP/TQ vo všetkých 10 jazykoch                                                                                                                                                                                      |
| `src/lib/catalog-content/snapshot.ts`                              | `MAKY_CATALOG_CONTENT_SHA256SUMS` je **fail-closed**: nečitateľný manifest alebo súbor, ktorý manifest neuvádza = odmietnuté (predtým sa načítal bez kontroly); neúspešné čítanie manifestu sa nepamätá                                                                                                                 |
| `src/lib/catalog-content/language.ts`                              | `catalogLanguageForMarket` bez `server-only`, aby ho mohla použiť proxy; `resolve.ts` ho re-exportuje                                                                                                                                                                                                                   |
| testy                                                              | `redirects.test.ts` (tabuľka sama so sebou), `redirects.acceptance.test.ts` (tabuľka proti artefaktom, 10 jazykov), `proxy.test.ts` (+6), `snapshot.test.ts` (+3); piny `whole-set.acceptance` a `full-dataset-acceptance` na **20260915**                                                                              |
| skripty                                                            | `check:catalog` spúšťa aj `redirects.acceptance`; `check:fitment` default URL = 20260915                                                                                                                                                                                                                                |

Mimo rozsahu (GO-M): modelový blok ponuky, routovanie lokalizovaných koreňov cudzích trhov.

---

## 2. Overené (zmerané)

- `tsc` 0 · eslint 0 · prettier OK · **vitest 2008 passed / 28 skipped** (131 súborov; 3 acceptance
  suity sa bez artefaktov preskočia, rovnako ako v deploy preflighte).
- Acceptance nad stiahnutými artefaktmi 20260915 (`sha256sum -c` OK): whole-set **15/15**,
  full-dataset **9/9**, redirects **4/4** (10 jazykov). Storefrontový validátor prijme fitment,
  prepočítaný datasetHash = deklarovaný `245dc59e…`.
- **7 falzifikácií** — každá nová kontrola padne na svojej chybe, potom obnovené bajtovo zhodne:

  | pokazené                                                           | padlo                                                   |
  | ------------------------------------------------------------------ | ------------------------------------------------------- |
  | manifest neuvádza súbor → načíta sa                                | `refuses a {lang} artifact the manifest does not list`  |
  | nečitateľný manifest → načíta sa                                   | `refuses every language…`, `picks up a manifest…`       |
  | neúspešné čítanie manifestu sa pamätá                              | `picks up a manifest that was not on the box…`          |
  | proxy 308 namiesto 301                                             | 3 testy „retired vehicle pages"                         |
  | proxy číta surovú cestu                                            | `sends the client router's .rsc request…`               |
  | posun koreňa bez zloženia                                          | `lands a retired page under a retired root in one hop…` |
  | dáta: mŕtvy cieľ, osirelá stránka, tieniaci zdroj, nepoužitý koreň | všetky 4 redirects acceptance                           |

- **Build vo worktree** nad artefaktmi 20260915 (`{lang}` + SHA256SUMS, fitment HTTP,
  `MAKY_SALEOR_WRITES=block`): exit 0 za 33 s. Lokálny `next start -p 3457`, iba `curl` GET:
  - 301 priamo na cieľ: `/sk/…/legacy-kombi/bp` → `/sk/…/legacy-kombi`, `/sk/…/h-1-van/tq` →
    `/sk/…/h-1-van`; `.rsc` → čistá stránka; query zostáva; `/cz/stresne-nosice/…/bp` →
    `/cz/stresni-nosice/…/legacy-kombi`; `/at/dachtraeger/…/tq` a `/ca/roof-racks/…/bp` podľa
    `de` a `en`; `/es/bacas-de-techo/…/bp` → `/es/barras-de-techo/…/legacy-kombi` jedným skokom;
    `/es/bacas-de-techo/bmw/x3` → `/es/barras-de-techo/bmw/x3`. `/sk/stresni-nosice/…/bp` sa
    nepresmeruje (český zdroj pod slovenským trhom).
  - Legacy Kombi a H-1 Van: 0 odkazov na `/bp` a `/tq`, slová „generáciu BP/TQ" v texte ostali.
  - Golf Variant: dlaždice 1J, 1K, AJ, CG (draft BA5 skrytá); `/golf-variant/ba5` = 200 +
    `noindex` (soft-404). Golf Alltrack BA5: 7 produktov (naživo 14 — 7 na hold odišlo na Variant).
  - sitemap: 11 082 `<loc>`, vozidlových 1 472 (naživo 1 474), BP/TQ/BA5/BH/A1 ani raz.
- ⚠️ **Predexistujúce, nie z tejto vetvy:** každý render routy `categories/[slug]` — aj
  `/sk/stresne-nosice` a `/sk/stresne-nosice/bmw` — loguje `Couldn't find all resumable slots by
key/index during replaying … fallback to client rendering`; `/sk`, `/sk/kontakt` a `/sk/products`
  nie. Produkčný PM2 error log ho má 63 441×. Mimo rozsahu M-1.

---

## 3. Keď príde CFM-RELEASE-4

### 3.1 Acceptance kritériá (zo zadania CFM, overiť na stiahnutých bajtoch)

**Fitment** proti `20260915`: strom, generácie, obdobia, aplikácie a produktové referencie rovnaké;
presne 20 produktov `qaStatus hold → accepted`, `eligibility.sellable false → true`, odstránený iba
dôvod stale mapping suspect; `products_held` **26 → 6**; žiadny iný produkt nemení eligibility;
Alumia 67452 / 66621 / 60894 ostáva mimo; validátor storefrontu PASS.

Storefront nevidí CFM id (60892, 67450, 66619 …). Tých 20 sú v `saleorProductId` (base64
`Product:<pk>`): **H-1 Van A1 = 4020–4025, Legacy Kombi BH = 8472–8478, Golf Variant BA5 =
9046–9052** (zmerané z fitmentu 20260915, reason `withheld_by_supplier_data_review`).

**Content** proti `20260915`: presne tri `publicId` `draft → published` — `1b200a63…` (Golf Variant
BA5), `1c995f54…` (H-1 Van A1), `8075da3c…` (Legacy Kombi BH); nové textové polia iba v `sk`;
ostatných 1 475 stránok bez zmeny obsahu, cesty aj stavu; 1121/1348 v exporte ostávajú.

**301**: všetky BP cesty → priamo Legacy Kombi **BH**, všetky TQ cesty → priamo H-1 Van **A1**, bez
reťazenia; Golf Alltrack BA5 sa nepresmerováva. ⚠️ BH/A1 môžu mať v cudzích jazykoch požičanú
slovenskú cestu (`routeLanguage: "sk"`, `/stresne-nosice/…`) — cieľ brať presne z artefaktu.

Čokoľvek iné = STOP a report, nie deploy.

### 3.2 Postup

1. Stiahnuť do scratchpadu fitment, 10 content súborov, oba SUMS a schémy; `sha256sum -c` na
   **stiahnutých bajtoch**; SUMS == hashe v handoffe. Datované názvy CFM nie sú nemenné.
2. Sémantický diff proti 20260915 podľa §3.1 (fitment aj content, všetkých 10 jazykov).
3. `redirects.json` prepísať podľa tabuľky 301 z handoffu; `pnpm check:catalog` ju overí proti
   artefaktom. Piny v `whole-set.acceptance` a `full-dataset-acceptance` **znovu zmerať**, nie
   prepísať z handoffu. Zoznam v teste „knows exactly which rendered copy points at a page that
   will not render" sa zmení (BH/A1 publikované, texty modelov stále odkazujú na BP/TQ).
   `check:fitment` default URL na nové vydanie.
4. Cielené testy + `check:catalog` (`MAKY_CATALOG_CONTENT_PATH=…-{lang}-….json`,
   `MAKY_FITMENT_DATASET_PATH=…`) + `check:fitment --file …` + `tsc` + eslint; jeden build vo worktree.
5. Commit + push (bez force).
6. Box — jediný zápis mimo gitu, tesne pred deployom:
   - `/opt/storefront-artifacts/` je `root:root`: `sudo install -m 0644 -o ubuntu -g ubuntu` 10
     content súborov a `SHA256SUMS_CONTENT_<dátum>`; `sha256sum -c` znovu na mieste.
   - `.env`: záloha `cp -p .env .env.backup-<UTC>`, potom
     `MAKY_FITMENT_URL=…/<nový fitment>.json`,
     `MAKY_CATALOG_CONTENT_PATH=/opt/storefront-artifacts/maky_catalog_content_1.0.0-{lang}-<dátum>.json`,
     `MAKY_CATALOG_CONTENT_SHA256SUMS=/opt/storefront-artifacts/SHA256SUMS_CONTENT_<dátum>`,
     riadok `MAKY_CATALOG_CONTENT_SHA256` odstrániť. Hodnoty nikdy do gitu ani do chatu.
   - `/opt/storefront`: `cd /opt/storefront && git fetch && git checkout <commit>` (tvar `git -C`
     klasifikátor odmieta), codegen, potom `./scripts/ops/deploy-production.sh -m "…"`.
     Build číta nový `.env` → fitment aj content sa prepnú v jednom kroku.
7. Overenie po deployi (`curl`, HTML):
   - `MAKY_DEPLOY_META` sha = commit; PM2 log bez `[fitment] provider payload failed validation`;
   - `/sk/stresne-nosice/subaru/legacy-kombi/bp` → **301** → `…/legacy-kombi/bh`,
     `/sk/stresne-nosice/hyundai/h-1-van/tq` → **301** → `…/h-1-van/a1`; historická ES cesta → 301;
   - `…/legacy-kombi/bh`, `…/h-1-van/a1`, `…/golf-variant/ba5` 200, SK H1, ponuka s produktmi
     vyššie; `…/golf-alltrack/ba5` 200 bez 301;
   - sitemap: BP/TQ nie; BH/A1/BA5 len ak sú `indexable` a majú text;
   - modelová stránka Legacy Kombi bez `href` na `/bp`;
   - rollback: CLAUDE.md §13.3 **a** `.env` zo zálohy.

---

## 4. Pasce

1. **`{lang}` rodina s manifestom je teraz fail-closed.** Chýbajúci riadok v SUMS = katalóg toho
   jazyka vypnutý (všetky jeho vozidlové stránky soft-404). Preto `sha256sum -c` na mieste pred
   deployom.
2. **Uzly stromu vznikajú len z fitmentu** (`tree.ts`). Výpadok carfitmanager.com = všetky vozidlové
   stránky soft-404 a sitemap ich stratí. Predexistujúce, nemenené.
3. **Lokalizované korene nie sú routované.** `/cz/stresni-nosice/…`, `/us/roof-racks/…` vracajú 404;
   cudzie 301 vedú na tieto 404. Preview trhy (noindex) — nie regresia, samostatná práca.
4. **Ponuka filtruje iba `productKind`, nie `sellable`** (`offers.ts`) — produkty na hold sa
   zobrazujú. Dnešné správanie, nemenené.
5. Deploy `.env` číta v builde aj za behu — meniť ho tesne pred skriptom, obe premenné naraz.
6. Po checkoute inej vetvy v `/opt/storefront` spustiť codegen, inak preflight padá na starom `src/gql/`.
7. Deploy exit `75` „market state" býva falošný poplach (závod s PM2 logom) — overiť priamo v logu.
