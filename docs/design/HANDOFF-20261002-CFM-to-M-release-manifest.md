# CFM → M · SYNC-1: vydania katalógu podľa trhov — čo sa mení v storefronte (2. 10. 2026)

Pre M (maky-storefront). Napísalo vlákno CFM (SYNC-1), kontakt s M išiel cez Mareka a cez tento repozitár.
**Nič z toho nie je nasadené ani zapnuté.** Zmena sa dotýka integrácie s CFM, takže podľa `CLAUDE.md` §10 sa
nezlučuje ani nenasadzuje bez M-ovho súhlasu. Posúď ju, rozhodni, nasaď podľa vlastného postupu a výsledok zapíš
do `M_TO_CFM_STATUS.md` (§9).

|                       |                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| vetva                 | `claude/sync1-release-manifest` v `MakySto/maky-storefront`, základ `release/r1-thule-20261001` (`6e0f378`)     |
| commity               | `199f4fc` (načítavač vydaní, stavový endpoint) a `7b29b1b` (voliteľná cache posledného overeného vydania)       |
| kontrakt (v CFM)      | `backend/docs/contracts/MAKY_RELEASE_MANIFEST_CONTRACT.md` + JSON schémy a príklady (repozitár CarFitManager-4) |
| príklady v tomto repe | `src/lib/catalog-release/fixtures/*.example.json` (bajt po bajte rovnaké ako v CFM, nenaformátovať prettierom)  |

## 1 · Čo sa zmení a čo nie

**Pre návštevníka sa nezmení nič, kým nie je nastavená `MAKY_RELEASE_MANIFEST_URL`.** Bez nej je všetko, ako bolo:
rozhodujú `MAKY_CATALOG_CONTENT_*` a `MAKY_FITMENT_*`.

Po jej nastavení storefront sám preberá z CFM dve veci: texty vozidlových stránok (po trhoch) a dataset
kompatibility. Cieľ je, že zmena, ktorú CFM schváli a publikuje, sa na webe objaví do ~1 minúty **bez buildu, bez
reštartu a bez zásahu do `.env`**. Prevzatie súboru je overené testami; to, že sa nový text hneď ukáže na
stránke, treba ešte zmerať živo (§5, krok 5). Čo sa nemení: ceny, Saleor, produkty, médiá, checkout, objednávky,
Payload a `/api/revalidate`. `/api/fitment/status` ostáva a v režime manifestu hlási dataset z manifestu
(`mode: "release"`, tie isté polia vrátane `datasetHash`). SYNC-1 je iba obsah vozidlových stránok a fitment.

## 2 · Ako to funguje

1. Pri štarte a potom každých ~30 s (±20 %) sa proces podmienene (ETag, 304) opýta na jeden pointer `MANIFEST.json`.
2. Pre každý trh, ktorého súbor sa zmenil, stiahne súbor, overí **veľkosť, SHA-256, JSON, kontrakt, jazyk a počet
   stránok** a až potom ho vymení. Render nikdy nečaká; číta pamäť.
3. **Aktivácia je po cieli.** Zlý nemecký súbor nezdrží Rakúsko, Slovensko ani dataset. DE a AT zvyčajne ukazujú na
   jeden súbor, ten sa stiahne a spracuje raz; sú to napriek tomu dva ciele s dvoma stavmi.
4. **Pri chybe ostáva posledná overená verzia** (stale-if-error) a stavový endpoint povie prečo. Raz overený trh
   sa už nikdy nevráti k `MAKY_CATALOG_CONTENT_*`, ktoré môže byť staršie než to, čo stránka už ukazuje.
5. Súbory idú iba z toho istého https pôvodu ako pointer (presmerovanie inam sa odmietne), s limitom veľkosti.
6. Prevzatie potvrdzuje **iba** `GET /api/catalog/status`: aktívny súbor a SHA-256 po cieli, osobitne fitment a
   `datasetHash`. HTTP 200 súboru nič nepotvrdzuje.

**Precedencia zdrojov obsahu:** manifest > `MAKY_CATALOG_CONTENT_PATH` > `MAKY_CATALOG_CONTENT_URL`. Staršie dve
odpovedajú za trh iba dovtedy, kým manifest pre trh neoveril súbor; boot to vypíše vedľa seba.

## 3 · Premenné prostredia

| premenná                           | predvolene  | význam                                                                                                                |
| ---------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `MAKY_RELEASE_MANIFEST_URL`        | nenastavená | **jediný vypínač.** https adresa pointra, bez prihlasovacích údajov. Nenastavená = režim `off`, správanie ako doteraz |
| `MAKY_RELEASE_POLL_SECONDS`        | 30          | ako často sa pýta na pointer (držané v rozsahu 10–300)                                                                |
| `MAKY_RELEASE_MANIFEST_TIMEOUT_MS` | 10 000      | časový limit pointra                                                                                                  |
| `MAKY_RELEASE_FILE_TIMEOUT_MS`     | 60 000      | časový limit jedného súboru                                                                                           |
| `MAKY_RELEASE_CACHE_DIR`           | nenastavená | voliteľné, absolútna cesta: tam sa uloží posledné overené vydanie, aby reštart nezačínal zo starších nastavení        |

Adresa pointra je `CATALOG_PUBLICATION_BASE_URL` z CFM + `MANIFEST.json`; predvolená hodnota v CFM je
`https://carfitmanager.com/media/fitment/releases/MANIFEST.json`. Skutočnú hodnotu potvrdí plán nasadenia od CFM.
Chybná hodnota (nie https, údaje v adrese) režim nezapne a boot to napíše; relatívna cesta v `MAKY_RELEASE_CACHE_DIR`
vypne iba cache.

**Cache (voliteľná, odporúčam).** Bez nej reštart zabudne vydanie a trh je do prvého úspešného prechodu odpovedaný
starším nastavením, teda aj datasetom, ktorý CFM medzitým mohol nahradiť (napr. stiahnutá nepravdivá kompatibilita).
S cache sa po reštarte obnoví posledné overené vydanie z disku **cez tie isté kontroly ako pri sťahovaní**
(poškodený alebo vymenený súbor sa neobnoví), pred prvou otázkou na sieť. Pointer sa potom pýta bez podmienky a
rozhoduje aj tak on. Zapisuje iba do podadresára `maky-release-cache` v zadanom adresári, súbory sú 600, vlastné
nepoužívané súbory maže až po hodine. Adresár nemusí existovať, stačí zapisovateľný rodič; použi cestu mimo
`/opt/storefront`, aby ju nasadenie nezmazalo. Cache, ktorú sa nepodarí zapísať, je jeden riadok v logu a nič iné.
Po oprave oprávnení sa zapíše pri ďalšej zmene vydania alebo pri ďalšom štarte.

## 4 · Čo je v kóde

Nové: `src/lib/catalog-release/{manifest,config,sync,status,cache}.ts`, `src/app/api/catalog/status/route.ts`.
Upravené: `src/instrumentation.ts` (`startReleaseSync()` na konci `register()`, nie počas buildu, bez `await`),
`catalog-content/{snapshot,resolve,vehicle-href}.ts`, `fitment/{provider,saleor-instance}.ts`, `seo/sitemap.ts`,
`ui/components/catalog/make-index.tsx` a stránka vozidla (`categories/[slug]/[...vehicle]/page.tsx`): každé čítanie
obsahu teraz nesie trh, nielen jazyk (DE a AT čítajú nemčinu, ale môžu mať rôzne súbory). Test
`release-call-sites.test.ts` zlyhá, ak niekto pridá volanie bez trhu.

`GET /api/catalog/status`: bez vedľajších účinkov (nič nesťahuje, nečíta disk, nemení stav), odpovedá 200 aj pred
prvým manifestom (potom `missing`), `Cache-Control: private, no-store`. Bez tajomstva nenesie nič citlivé; s
`Authorization: Bearer <REVALIDATE_SECRET>` pridá `process.pid` a čas štartu, ako `/api/fitment/status`.

## 5 · Odporúčané poradie (až po schválení plánu nasadenia od Mareka)

**Najprv zisti počet procesov.** V dokumente z 1. 10. máš `maky-storefront` ako **1 proces** (fork). CFM potrebuje presné
číslo ako `CATALOG_STOREFRONT_EXPECTED_PROCESSES`; zisti ho z bežiaceho stavu, nie z repozitára:

```bash
pm2 jlist | jq '[.[] | select(.name=="maky-storefront" and .pm2_env.status=="online")] | length'
```

(Predpokladaný tvar výstupu `pm2 jlist`; ak sa líši, je to počet riadkov `maky-storefront` v `pm2 ls`.) Odpoveď jedného
procesu nie je potvrdenie všetkých: CFM berie cieľ ako prevzatý, až keď **všetky** očakávané procesy hlásia `active`
s rovnakým SHA-256.

### Krok 1 · Nasadiť vetvu bez zapnutia (režim `off`)

Tvojím postupom, `CLAUDE.md` §13 (nikdy `next build` pri bežiacom PM2):

```bash
cd /opt/storefront && MIN_FREE_MEM_MB=9216 ./scripts/ops/deploy-production.sh -m "…"
```

Po nasadení musí boot napísať `[release] mode=off (MAKY_RELEASE_MANIFEST_URL not set)` a
`curl -s https://maky.store/api/catalog/status | jq .capabilities` musí dať `{"contentByTarget": false}`. Dovtedy sa
na webe nič nezmenilo.

### Krok 2 · 56 úvodov C1 (sada 20261001) nie je súčasť SYNC-1

Ostáva tvoje vydanie a SYNC-1 doň nezasahuje. Zapnutie manifestu (krok 3) odporúčam až po ňom.

### Krok 3 · Zapnúť (jednorazová zmena prostredia)

Rovnaký postup ako 30. 9. pri `MAKY_FITMENT_URL` (tvoj §9.2). Záloha, pridanie dvoch kľúčov, reštart:

```bash
cd /opt/storefront && cp -p .env .env.backup-$(date -u +%Y%m%dT%H%M%SZ)
```

```bash
cd /opt/storefront && printf '\nMAKY_RELEASE_MANIFEST_URL=%s\nMAKY_RELEASE_CACHE_DIR=%s\n' '<adresa pointra od CFM>' '<absolútna cesta mimo /opt/storefront>' >> .env
```

```bash
pm2 restart maky-storefront
```

**Okamžite zahriať**, lebo štart po reštarte môže prvú žiadosť poslať 500-kou (`NEXT_STATIC_GEN_BAILOUT`, tvoje
zistenie z 1. 10.; táto vetva to nemení ani nelieči):

```bash
for p in /sk /sk/stresne-nosice /sk/konfigurator /sk/categories/thule-stresne-nosice; do curl -sS -o /dev/null -w "$p %{http_code}\n" https://maky.store$p; done
```

Je to **jediný reštart**. Ďalšie zmeny textov a datasetu už nevyžadujú terminál, sudo, `.env`, build ani reštart.

### Krok 4 · Overiť z bežiaceho procesu (nie z `.env`, nie zo súboru)

```bash
pm2 logs maky-storefront --nostream --lines 300 | grep '\[release\]'
```

Očakávané riadky: `[release] mode=manifest source=… poll=30s boot=… older-content-setting=… cache=…`, potom
`[release] manifest v<N> taken (… targets, fitment <verzia>)`, `[release] content <trhy> active: <súbor> (… B, sha256 …)`
a `[release] fitment active: <verzia> <datasetHash> (… B, … ms)`. Pri neprázdnej cache pred nimi
`[release] restored from the cache: …`.

```bash
curl -s https://maky.store/api/catalog/status | jq -c '{boot: .process.bootId, manifest: .manifest.version, content: (.content.targets | map_values({state, source, release, sha: .sha256[0:12]})), fitment: (.fitment | {state, source, datasetVersion, hash: .datasetHash[0:12]})}'
```

Pre každý trh v zozname musí byť `state: "active"` a `source: "manifest"`; `legacy` alebo `stale` znamená, že tento trh
ešte neprevzal súbor z manifestu (a stavový endpoint povie prečo v `error`). Volaj ho viackrát: `boot` je pri jednom
procese stále ten istý.

### Krok 5 · Živý test zmeny, bez reštartu

Marek v CFM publikuje drobnú zmenu pre jeden trh (napr. SK). Do ~1 minúty sa v stave zmení `sha` a `release` iba
tohto trhu, ostatné ostanú; stránka vozidla v tomto trhu ukáže nový text.

**Otvorená otázka.** Stránka vozidla je čiastočne prerenderovaná (komentár v `page.tsx`: text a dlaždice sú v shelli,
ponuka je dynamická). Podľa kódu nič ďalšie nevidím cachovať, ale nemám to zmerané na `next start`. Ak sa po prevzatí
v stave nový text na stránke neobjaví, treba k prevzatiu doplniť cielené `revalidatePath`/`revalidateTag`; to by bola
samostatná zmena a CFM by volal `/api/revalidate` až po potvrdenom prevzatí. Prosím zmeraj a zapíš.

### Krok 6 · Vrátenie (kedykoľvek)

`cp -p .env.backup-… .env`, `pm2 restart maky-storefront`, zahriať. Režim je potom `off` a rozhodujú staré nastavenia,
ako pred touto zmenou. Úplné vrátenie kódu: tvoj rollback z `deploy-production.sh`.

## 6 · Čo som ponechal tak, ako je

`MAKY_CATALOG_CONTENT_*` a `MAKY_FITMENT_*` **nemaž ani nemeň**: ostávajú ako záloha, kým trh nemá overený súbor
z manifestu. Dataset z manifestu odpovedá z pamäte bez ďalšej požiadavky, takže po prevzatí sa starý zdroj (`MAKY_FITMENT_URL`)
už nepýta; pri štarte sa starý ešte raz načíta (prewarm), kým prvý prechod neoverí nový.
Produkčný `.env`, secrets a ceny som nevidel ani nemenil.

## 7 · Pamäť a Cloudflare

- `next-server` mal podľa tvojho dokumentu z 1. 10. **2,73 GB RSS** po 30 h a `max_memory_restart` nie je nastavený. Táto zmena
  pridáva jeden spracovaný snapshot na jazyk (DE a AT zdieľajú jeden) a dataset v pamäti; kým je staršia kópia
  v memo (TTL 15 min), môže byť jazyk krátko dvakrát. Je to odhad z veľkosti súborov (~10 MB obsah, ~8–16 MB dataset),
  **nie meranie z produkcie.** Sleduj `ps -o rss=` pre `next-server` (PM2 ukazuje iba obal `npm`) pred a po zapnutí.
- `/api/catalog/status` posiela `Cache-Control: private, no-store`; Cloudflare ho nesmie cachovať
  (`cf-cache-status` má byť `DYNAMIC`). Ak CFM dostane starú odpoveď, vyhodnotí prevzatie zle.

## 8 · Čo je a nie je overené

**Overené (izolované testy, bez živého webu):** 303 testov okolo tejto zmeny prechádza (manifest, načítavač,
cache, stav, endpoint, napojenie obsahu a datasetu, sken volaní bez trhu); `eslint --max-warnings=0` a `prettier`
čisté; `tsc` nehlási nič v týchto súboroch. Testy som overil aj zámerným rozbitím kódu: každé rozbitie, ktoré som
skúsil, nejaký test zabil, okrem jedného, ktoré je v správaní ekvivalentné (súbor chráni aj záznam na disku).

**Neoverené:**

- `next build` a beh na `next start` s touto vetvou. V mojom prostredí nie je vygenerovaný `src/gql`, preto `tsc`
  hlási 388 chýb a **61 testových súborov padá** (`Cannot find package '@/gql/graphql'`). Rovnaké čísla má základ
  `6e0f378` bez mojich zmien, takže nejde o regresiu, ale tvoj `pnpm build` je prvý skutočný test.
- Správanie za Cloudflare a pod PM2 (reštart, zahrievanie, pamäť), viď §5 a §7.
- Živý beh proti produkčnému CFM. Žiadny kontakt s CFM serverom ani s produkciou som nemal.

## 9 · Čo zapísať do `M_TO_CFM_STATUS.md`

Názvy sú návrh, uprav ich podľa svojho súboru. Dôkaz je výstup z bežiaceho procesu, nie tvrdenie.

```
SYNC1_BRANCH_REVIEW=<OK|NEOK + dôvod>          # vetva claude/sync1-release-manifest @ <commit>
SYNC1_DEPLOYED=<áno|nie> <sha, BUILD_ID, čas UTC z MAKY_DEPLOY_META>
SYNC1_MODE=<off|manifest>                      # z riadku [release] mode=…
SYNC1_PROCESSES=<počet z pm2 jlist>            # CFM ho nastaví ako CATALOG_STOREFRONT_EXPECTED_PROCESSES
SYNC1_STATUS=<výstup curl + jq z kroku 4>      # po prvom prevzatí
SYNC1_LIVE_TEST=<PASS|FAIL + čo sa zmenilo, za koľko sekúnd, bez reštartu?>
SYNC1_REVALIDATE_NEEDED=<áno|nie>              # otvorená otázka z kroku 5
SYNC1_RSS_BEFORE_AFTER=<MB pred / po>
```

## 10 · Jedna veta pre Mareka, ktorú pošle M

> M, prosím posúď vetvu `claude/sync1-release-manifest` v `MakySto/maky-storefront` podľa
> `docs/design/HANDOFF-20261002-CFM-to-M-release-manifest.md` (kontrakt je v CFM:
> `backend/docs/contracts/MAKY_RELEASE_MANIFEST_CONTRACT.md`); nič sa nenasadzuje, kým Marek neschváli plán nasadenia.
