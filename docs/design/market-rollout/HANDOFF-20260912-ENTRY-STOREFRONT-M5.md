# ⭐ VSTUPNÝ BOD PRE NOVÉ STOREFRONT VLÁKNO (M5)

Napísané 12. 9. 2026. **Toto je jediný súbor zo storefrontu, ktorý musí nové vlákno
prečítať celý.** K nemu dostaneš samostatne zhrnutie z CFM vlákna a z Payload (maky-cms)
vlákna — tie sú autoritatívne pre svoje strany a tento dokument ich nezdvojuje.

Všetko označené „zmerané" som naozaj odmeral na tomto stroji. Čo som nemohol overiť, je
`NOT_RUN` alebo `UNKNOWN` — a to nie je `FAIL`.

---

## 0. Kde to je

|          |                                                                    |
| -------- | ------------------------------------------------------------------ |
| Repo     | `MakySto/maky-storefront` (⚠️ **verejný fork** — CLAUDE.md §10.1)  |
| Vetva    | `claude/maky-store-m4-3-42ed3b`                                    |
| **HEAD** | **`f3acaa1`**                                                      |
| Základ   | `3248ffb` (integračná vetva) — 6 commitov nad ním                  |
| Stav     | pushnuté, **NENASADENÉ**, strom čistý                              |
| Testy    | **1970 passed / 0 failed**, 22 skipped · tsc 0 · eslint 0 errors   |
| Prod     | `578c33b`, BUILD_ID `buJZ-9DFbOKS9s5akP4-n` (z `MAKY_DEPLOY_META`) |

Najprv `git ls-remote`. Ak sa vetva posunula, **novší stav zachovaj** — tento SHA nie je
príkaz na reset. Integračná vetva `claude/maky-store-integration-abcd-4e54c6` je stále na
`3248ffb`; moja práca do nej **nie je** zlúčená.

---

## 1. ⚠️⚠️ PRVÁ VEC: snapshot sa zmenil pod hotovým consumerom

Consumer som staval a overoval nad **pre-publish** kópiou z 11. 9. CFM medzitým publikoval
a vydal **post-publish** artefakty z 12. 9. Rozdiel je vecný, nie kozmetický:

|                    | 11. 9. (nad čím bežal preview) | 12. 9. (čo treba prevziať)   |
| ------------------ | ------------------------------ | ---------------------------- |
| bajty (sk)         | 9 681 675                      | **9 737 293**                |
| transport sha256   | `2833203a…`                    | **`5a8b9e4807893555…`**      |
| `selfSha256`       | `e5285dee…`                    | **`b9aa9774bf93f3a8…`**      |
| `state`            | draft 1475                     | **published 1474 / draft 1** |
| `hasEditorialText` | 1473                           | **1474**                     |
| bez textu          | `lynk-co/01`, `seat/ateca`     | **len `lynk-co/01`**         |
| jazyky             | 1 (sk)                         | **10**                       |
| nové pole          | —                              | **`routeLanguage`**          |

**Zmerané mnou, nie prevzaté:** stiahol som `maky_catalog_content_1.0.0-sk-20260912.json`
aj `-de-`, hash sk sedí na publikovaný `5a8b9e48…`, a `pnpm check:catalog` nad novým
súborom **padá na 6 z 13 kontrol** — presne preto, že pinuje starú dodávku. To je prvá
úloha, nie chyba.

```
× is the artifact we accepted, byte for byte
× renders text for every page that claims to have it
× names the pages without text, so they cannot grow silently
× derives a split for every page, because the export ships none
× publishes nothing yet: every page is draft
× would index 1 473 of them once published, and never the two thin ones
```

**Čo sa NEZMENILO a je stále nosné:** `top`/`body` sú **naďalej prázdne na všetkých 1 475**
(sk: intro-only 1474, split 0; de: intro-only 1471, split 0). Odvodenie splitu pri prvom
nadpise zostáva jediný dôvod, prečo stránky nie sú prázdne.

**Brána je `state`, nie `indexable`.** `indexable=true` je na všetkých 1 475 vrátane
draftu. Overil som, že moje brány sa správajú správne aj nad novými dátami:
**visible 1474, indexable 1474**, draft `/stresne-nosice/lynk-co/01` zostáva skrytý.
Consumer, ktorý by filtroval podľa `indexable`, by tú stránku zverejnil bez textu.

---

## 2. Čo je hotové (6 commitov, všetko falzifikované)

### Guard proti zápisu do produkcie — `a43c529`, `8ded490`, `6a3540a`

Predchádzajúce vlákno omylom zapísalo do produkčného Saleoru (draft checkouty, kanál
`sk-eur`, **nechané ako dôkaz**). Guard: mutácia na `api.maky.store` je odmietnutá, pokiaľ
proces nepovie `MAKY_SALEOR_WRITES=allow` alebo neservíruje build opečiatkovaný deploy
skriptom (`.next/MAKY_DEPLOY_META`, ktorého `build_id` musí sedieť na `.next/BUILD_ID`).

Tri veci, ktoré recenzia správne vytkla a sú opravené: klasifikácia ide cez **parser**
balíka `graphql`, nie regex (`,mutation X{}` a `fragment F on Mutation{} mutation X{}` sa
čítali ako query — prešli by guardom **aj dostali retry budget** na neidempotentný zápis);
testy sú nezávislé od `cwd` (deploy preflight púšťa vitest v `/opt/storefront` s ešte
prítomným markerom — 3 testy tam padali a **zablokovali by deploy**); marker musí obsahom
sedieť na build, nielen existovať.

⚠️ **Nie je to sandbox a nie je to úplné pokrytie.** `@saleor/auth-sdk` má vlastný
`globalThis.fetch` (31 miest) — `signIn`/`resetPassword` guard obchádzali, teraz sú
kontrolované v `bff-server.ts`. Payload forms, CMS klient, fitment provider a Stripe majú
každý vlastný fetch a **kryté nie sú**.

### Oprava Garáže pri 360 px — `b928409`

„Volkswagen Golf VIII (CD)" sa lámalo uprostred slova. Plus oprava zastaraného komentára:
`MAKY_GARAGE_COOKIE_SECRET` **JE** v produkcii nastavený (overené cez prítomnosť kľúča a
cez živú stránku, hodnotu som nečítal).

### CFM katalógový consumer — `cd8748a`, `fdc86c4`, `f3acaa1`

Kontrakt, brány, parser inline HTML, loader s memo+inflight, strom, whole-set acceptance
a **funkčné stránky** `/sk/stresne-nosice/[make]/[model]/[generation]`.

Overené v produkčnom builde: tri pilotné stránky vykresľujú H1, metadáta, canonical, úvod,
dlaždice alebo ponuku a poradenský článok. T-Roc A1 = **35 reálnych zostáv s cenami**.
Značka a model **netvrdia kompatibilitu** — to je až generácia.

---

## 3. Stavová tabuľka

| brána                             | stav         | poznámka                                                |
| --------------------------------- | ------------ | ------------------------------------------------------- |
| `SALEOR_WRITE_GUARD_READY`        | ✅           | falzifikované, nie je to sandbox                        |
| `CATALOG_CONSUMER_READY`          | ✅           | nad **starým** snapshotom                               |
| `CATALOG_SNAPSHOT_20260912_TAKEN` | ❌           | **prvá úloha** — 6 kontrol padá                         |
| `CATALOG_MULTILANG_READY`         | ❌           | consumer je jednojazyčný                                |
| `CATALOG_PREVIEW_VERIFIED`        | ✅ 3 stránky | + automatická kontrola celej množiny                    |
| `CATALOG_DEPLOYED`                | ❌           | samostatné GO                                           |
| `MARKETS_LIVE`                    | ❌ len `sk`  | `MAKY_LIVE_MARKETS`, **build-time**                     |
| `PRODUCTS_IN_OTHER_CHANNELS`      | ❌           | vlastník K, 11 kanálov má 0 produktov                   |
| `O_NAS_PAYLOAD_E2E`               | NOT_RUN      | consumer hotový, čakal na staging — **viď P**           |
| `CONTACT_STAGING_E2E`             | NOT_RUN      | UI+BFF hotové, default OFF                              |
| `CUSTOMER_JOURNEY_READY`          | ⏳           | konfigurátor/Garáž ✅, PDP set/BOM ❌, checkout ❌      |
| `HYDRATION_418`                   | NOT_ISOLATED | site-wide, **živé aj na maky.store**, nie z tejto vetvy |

---

## 4. Poradie práce (podľa Marekovho rozhodnutia)

### M5.1 — prevziať post-publish snapshot a zapnúť SK kategórie

1. Stiahnuť všetkých 10 artefaktov + `SHA256SUMS_CONTENT_20260912`, overiť hash
   **stiahnutých bajtov** proti publikovanému zoznamu.
2. Aktualizovať `DELIVERED` konštanty vo `whole-set.acceptance.test.ts` na novú dodávku
   a **znovu si ich odmerať**, nie prepísať z tohto dokumentu.
3. Doplniť `routeLanguage` do kontraktu (`contract.ts`) — nové pole.
4. Znovu overiť tri pilotné stránky **bez** `MAKY_CATALOG_PREVIEW`, lebo 1 474 stránok je
   teraz `published` a majú sa vykresliť normálne.
5. Sitemap + hreflang: zaradiť len to, čo je `published` **a** `indexable` **a** má text.
   Zmerať výsledný počet URL a veľkosť (limit 50 000 / 50 MB).
6. Viditeľný vstup do stromu z existujúcej sekcie Strešné nosiče — dnes sa tam nedá
   dostať inak než priamou URL.

### M5.2 — viacjazyčnosť katalógu

Consumer číta **jeden** súbor cez `MAKY_CATALOG_CONTENT_PATH`. Treba locale-aware zdroj:
jeden artefakt na jazyk, výber podľa trhu, a **žiadna automatická indexácia cudzích
jazykov** — CFM to hovorí výslovne. Pozor na `routeLanguage`: stránka bez textu v danom
jazyku nesie `hasEditorialText: false` a **cestu požičanú zo slovenčiny**
(`routeLanguage: "sk"`) — v `de` sú také 4. Nie je to chyba exportu.

### M5.3 — zapnúť trhy

`MAKY_LIVE_MARKETS` je **build-time** (`generateMetadata` sa piecze pri `cacheComponents`)
→ zmena trhu = **rebuild**, nie reštart. ⚠️ Predpoklad, ktorý treba overiť skôr než
čokoľvek: **11 z 12 kanálov má v Saleore 0 produktov** a `/cz/kontakt` bolo 404. Zapnúť
trh s prázdnym katalógom znamená pustiť Google na prázdny obchod.

### M5.4 — publikovať produkty do ostatných kanálov

Vlastník **K** (Saleor). Storefront to nevie spraviť a nemá. Bez toho je M5.3 kozmetika.

### M5.5 — „O nás" cez Payload (až po M5.1–M5.4)

Consumer aj Contact UI/BFF **existujú a sú hotové** — neimplementuj ich znova. Chýbal iba
dostupný provider (`CMS_STAGING_PUBLISHED = BLOCKED_ENV`). Aktuálny stav si vypýtaj
z Payload zhrnutia. Keď provider je: `o-nas` z `SK_ONLY` na trhy, ktoré CMS naozaj má
(jeden riadok v `route-policy.ts`), 12 URL, cold aj warm cache, oba smery DE↔AT a US↔CA,
publish → update → unpublish → republish cez reálnu invalidáciu. **2C musí byť uzavreté
pred otvorením indexácie** pre CMS routu.

### M5.6 — zvyšok zákazníckej cesty

PDP set/BOM a variant identity; košík→checkout **len v sandboxe od K**; RAV4 regresia
(potrebuje fixtúru od C — fixture má 5 modelov a každý presne jednu generáciu, takže
nejednoznačnú generáciu sa v UI **nedá** prejsť); hydration #418.

---

## 5. ⚠️ PASCE — každá ma stála čas

### Katalóg

1. **`top`/`body` sú PRÁZDNE vo všetkých 1 475.** Plán aj `reading` pole v artefakte
   tvrdia opak. Doslovná implementácia = 1 473 prázdnych stránok, ktoré **prejdú buildom**.
   Split sa odvodzuje pri prvom nadpise (každá stránka ho má).
2. **Routa `stresne-nosice/` pod `[channel]` je ZAKÁZANÁ.** Urobí zo slugu market-root
   segment a `config/categories.test.ts` to bans — padli 4 guardy naraz. Stránky sú vnútri
   `categories/[slug]`, proxy rewrite išiel z `=== 2` na `>= 2`.
3. **Ponuka MUSÍ byť v Suspense.** Bez nej sa výpis spočíta v **build-time** na stroji bez
   Saleoru a prehráva sa navždy — zmerané: čerstvý request nespravil ani jedno volanie.
4. **`params.channel` je `sk-eur`, nie `sk`.** Canonical aj odkazy boli `/sk-eur/...` —
   cesty, ktoré neexistujú. Používaj `marketHref` / `buildCanonicalUrl`.
5. **Spájaj cez `vehicleId`, nikdy cez `urlPath`.** `publicId` = identita STRÁNKY.
   Rodičia z `makeId`/`modelId`, nie z krájania URL.
6. **`roofTypes` sú na `applications[].qualifiers`** (1102/1102), nie na produktoch
   (0/9163). Diagram v CFM pláne to má zle, próza správne.
7. **`state`/`indexable`/`vehicleId` NIE SÚ v `required`.** Absencia musí odmietnuť.
8. **Neresolvovateľná cesta vracia 200 + noindex + not-found telo**, nie tvrdú 404 — pod
   `cacheComponents` je shell odoslaný skôr, než `notFound()` stihne nastaviť status.
   Tvrdá 404 potrebuje bránu v proxy.
9. **`describe.skipIf` aj tak vyhodnotí telo describe** — fixtúru načítavaj lenivo, inak
   padá každý bežný `pnpm test`.

### Prostredie a build

10. **`pnpm build` NIE JE rozbitý** — padá len na chýbajúcom `.env`. S tromi
    `NEXT_PUBLIC_*` prejde celý reťazec (~34 s, peak RSS ~1,06 GB).
11. **`NEXT_PUBLIC_*` je build-time inlinované** — zmerané: 26 literálov, **0 runtime
    čítaní**. Guard musí čítať doslovný `process.env.NEXT_PUBLIC_X`, inak je to no-op,
    ktorý prejde každým unit testom.
12. **Next necachuje nič nad 2 MB** — `next: { revalidate }` ticho nerobí nič; preto
    memo + inflight.
13. **Fetch Data Cache prežije rebuild** — pri meraní `rm -rf .next/cache`.
14. V čerstvom worktree chýbajú `node_modules`, `src/gql/`, `src/checkout/graphql/generated/`,
    `.husky/_`. Po prepnutí vetvy spusti codegen, inak preflight padá.
15. `next start -H 127.0.0.1` = redirect loop. Chrome zabíjaj cez `pgrep -x chrome`,
    **nikdy `pkill -f`**.
16. **`Write` tool a MCP volania padajú na hook timeoute** — používaj bash heredoc.
    Pozor na literálne control-znaky v heredocu (validátor ich odmietne).

### Meranie

17. **Reálny `<footer>` nie je `<footer>` element v servovanom HTML** — regresiu čítaj
    z hydratovaného DOM.
18. Next renderuje `hrefLang` (camelCase) — `grep -i`.
19. **Falzifikácia, ktorá príde zelená, je nález o teste**, nie o kóde.
20. Cookie lišta je v poriadku — používaj **viewport-only** capture.

---

## 6. Ako to spustiť

```bash
cd <vlastný worktree>
export NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/
export NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur
export NEXT_PUBLIC_STOREFRONT_URL=https://maky.store
pnpm install --frozen-lockfile --ignore-scripts && node_modules/.bin/husky install
pnpm run generate:all
node_modules/.bin/tsc --noEmit && node_modules/.bin/eslint && node_modules/.bin/vitest run
pnpm run i18n:check

# katalóg
export MAKY_CATALOG_CONTENT_PATH=/cesta/maky_catalog_content_1.0.0-sk-20260912.json
export MAKY_FITMENT_PROVIDER=http
export MAKY_FITMENT_URL=https://carfitmanager.com/media/fitment/maky_roof_fitment_3.0.0-full-20260907.2.json
export MAKY_SALEOR_WRITES=block          # read-only priechod
pnpm build && node_modules/.bin/next start -p 3457     # nikdy -H 127.0.0.1

pnpm check:catalog   # potrebuje MAKY_CATALOG_CONTENT_PATH + MAKY_FITMENT_DATASET_PATH
```

Prepínače: `MAKY_CATALOG_PREVIEW=enabled` (zobrazí aj `draft` — po 12. 9. už netreba pre
tých 1 474), `MAKY_SALEOR_WRITES=block|allow`, `MAKY_FITMENT_PROVIDER=fixture|http`,
`MAKY_LIVE_MARKETS` (**build-time**), `MAKY_CONTACT_FORM_MARKETS` (default prázdne),
`MAKY_GARAGE_COOKIE_SECRET` (bez neho je Garáž v `next start` **vypnutá** a „Potvrdiť
vozidlo" ticho nerobí nič).

Artefakty **nekomituj** — repo je verejný fork. Headless Chromium:
`~/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`, cez CDP obyčajným Node.
Nezávislý sieťový blokátor zápisov použi pri každom read-only priechode; môj harness
(`netblock.cjs`, `cdp.mjs`) je overený a stojí za skopírovanie.

---

## 7. Koordinácia

| vlákno          | vlastní                              | stav                                          |
| --------------- | ------------------------------------ | --------------------------------------------- |
| **M** (toto)    | storefront: routy, consumer, UI, SEO | `f3acaa1`, nenasadené                         |
| **C** (CFM)     | katalóg, fitment, texty, preklady    | publikované 12. 9., 10 artefaktov, `5609805`  |
| **P** (Payload) | O nás obsah, Contact backend         | viď samostatné zhrnutie                       |
| **K** (Saleor)  | kanály, ceny, dane, doprava, Stripe  | **11 kanálov s 0 produktmi** — blokuje M5.3/4 |
| **R** (Returns) | Returns/Withdrawal kontrakt          | SK backend live                               |

---

## 8. Hranice

Vlastný worktree, bežný push, **žiadny force**. Bez osobitného GO: žiadny deploy, PM2,
produkčný `.env`, zmena trhových flagov, CMS publish, platba, refundácia, zásielka, živé
podanie ani export do Saleoru. **Toto nie je oprávnenie mergeovať do `release/*` ani
`main`.** Produkčné secrety nikdy do worktree ani commitu.

Lokálne testy **nie sú** GitHub CI. Produkčný SHA a BUILD_ID sa čítajú z
`MAKY_DEPLOY_META`, nevymýšľajú sa. Rozlišuj: unit test · mock UI · dočasná reálna
integrácia · staging · nasadenie · predaj · indexácia. Nemiešaj ich do jednej zelenej
položky.
