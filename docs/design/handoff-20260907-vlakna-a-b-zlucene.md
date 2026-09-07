# MAKY.STORE — zlúčené vlákno A + B (2026-09-07)

**Toto je jediný dokument, ktorý nové vlákno potrebuje prečítať ako prvý.** Je samostatný.
Nahrádza `handoff-20260905-vlakno-a-stav-a-pokracovanie.md` a dopĺňa
`handoff-20260907-vlakno-b-pilot-prijaty.md` (vlákno B, vetva
`claude/vlakno-b-selektor-datasethash-0387f6`), ktorý ostáva platný pre detail B.

Od tohto vlákna sú **A aj B v jednej réžii**.

---

## 0. Stav — overený 2026-09-07, nie prevzatý zo starších reportov

| Vec | Hodnota |
| --- | --- |
| **Produkcia** | `a5978f5`, BUILD_ID `T5C-THElOjjF2KPiRXbCd`, nasadené 09:07 UTC, odstávka 73 s |
| **Vetva produkcie** | `claude/sf-a-jsonld-sku-fix` |
| **Katalóg** | **9 606 produktových PDP**, sitemapa 9 638 URL, HTTP 200 |
| **Snapshoty** | 3, vrátane pinnutého `b6b633da`; posledný `27b7088-EeqdrEsFOEh2OMnTDHF03` |
| **Vlákno B** | `claude/vlakno-b-selektor-datasethash-0387f6 @ 2139f1a` (kód `c01e58f`), branch-only |
| **Zlúčiteľnosť A↔B** | **čistý merge, overený aj sémanticky** (viď §6) |

Overuj cez `git ls-remote`, nikdy cez tracking ref. **Vetvy B sa volajú aj `vlakno-b-*`,
nielen `sf-b-*`** — filter na `sf-b-` tú aktuálnu minie.

---

## 1. Čo je nasadené a čo to opravilo

Dva deploye za posledné dva dni.

### `27b7088` (5. 9., odstávka 36 s) — vlákno A, 67 commitov / 182 súborov

| | teraz | predtým |
| --- | --- | --- |
| **Sitemapa pri 9k katalógu** | 9 638 URL, 200 | strop 2 000 → **tvrdý 500** |
| JSON-LD ponuka | `Offer` + presná cena | `AggregateOffer`, low=high |
| Dostupnosť | `BackOrder` | `InStock` na 417/417 |
| `/sk/cart` | `noindex, follow` | `index, follow` |
| Navigácia | „Všetky produkty“ | natvrdo anglické „All“ |

Prvý riadok bol skutočný blocker: `MAX_PAGES = 20` × 100 = strop 2 000, a pri prekročení
sa **vyhodila výnimka**, nie skrátená sitemapa. Publikácia na starý build by pri produkte
2 001 zhodila `/sitemap.xml` na 500. Deploy to stihol o hodiny.

### `a5978f5` (7. 9., odstávka 73 s) — únik SKU + skeleton + kontroly

**Únik interného identifikátora do Googlu.** PDP posielal
`N21059|N20003|N15424|N15424|CFMP-B-NOR-72670303068409-000000` ako `sku`. Viditeľná
stránka bola správna vždy — obišli ho len strojovo čitateľné kópie, a boli **tri na
stránku**. Tretia nebola v JSON-LD: celé pole variantov sa posielalo klientskému
komponentu, takže `sku` a `sourceSku` skončili v RSC flight payloade.
**TypeScript to zachytiť nemohol** — kontrola prebytočných vlastností platí len na
objektové literály, a pole sa odovzdávalo ako premenná.

Pri 417 produktoch to boli 3 varianty (0,7 %) a prehliadlo sa to. Publikácia z toho
spravila 94 %.

**Skeleton.** `--animate-skeleton-delayed`, `-long` a `--animate-cart-badge-pop` boli
nedefinované od `467d9ef` (21. 3. 2026). **Nie od migrácie Tailwindu** — tá ich prehodila
správne, `467d9ef` ich zmazal deň nato. 13 skeletonov v 12 súboroch držalo `opacity-0`
päť a pol mesiaca. Obnovené s pôvodnými hodnotami z `776c793`.

`VariantSectionSkeleton` potreboval aj štrukturálnu zmenu: mal `animate-skeleton-delayed`
a `animate-pulse` na **tom istom** elemente, obe `animation` s rovnakou špecificitou.
Sú teraz na dvoch vnorených elementoch. Pozor — ten pulz bol na **kontajneri**, ktorého
deti vlastný pulz nemajú; odobrať ho by ich zastavilo úplne.

---

## 2. Dve kontroly, ktoré sú cennejšie než tie opravy

Obidva defekty prešli cez zelený build, HTTP 200, 226 overených assetov **a** 1 213
testov. Nič z toho sa nepozerá na publikovanú stránku.

```bash
pnpm check:published          # 40 živých PDP zo sitemapy, --sample N, --base URL
pnpm check:css                # potrebuje build; číta VYBUILDENÝ stylesheet
```

`check:published` overuje, čo crawler naozaj dostane: žiadny `CFMP-` v HTML, značka,
čistý `sku`, presná cena, reálna dostupnosť. **Púšťaj po každom deployi aj po každej
publikácii katalógu.**

`check:css` číta `.next/static/chunks/*.css` a padne, keď trieda použitá v `src/`
negeneruje pravidlo. Tailwind v4 pre nedefinovaný token neemituje **nič** a build prejde
— toto je jediná vec, ktorá tú triedu chýb vidí (CLAUDE.md §11). Zámerne len `animate-*`;
farebné utility majú rovnaký failure mode, ale mená sa skladajú v `cn()`, takže by to
robilo falošné poplachy.

**Výsledok po poslednom deployi (vzorka 40):**

```
ok    page is 200                                  40/40
ok    no internal identifier anywhere in the HTML  40/40   ← pred deployom 1/40
ok    has product structured data                  40/40
FAIL  structured data carries a brand               1/40   ← CFM
ok    structured data carries a sku                40/40
ok    sku is free of the internal identifier       40/40
ok    has an offer                                 40/40
ok    offer states an exact price                  40/40
ok    availability is a schema.org value           40/40
```

---

## 3. Jediný živý defekt: chýbajúca značka (CFM)

39 zo 40 vzorkovaných produktov nemá v štruktúrovaných dátach `brand`. Storefront číta
atribút `externalReference = "cfm:attribute:manufacturer"`; Nordrive kohorta ho nemá
nastavený. Thule produkty ho majú a značka sa vykreslí — rovnaký kód, dva výsledky, takže
chyba je v dátach.

**Nie je to chyba storefrontu a kľúč sa vynecháva zámerne.** Predtým sa dopĺňala výplň
„MAKY.STORE“, čím sa Googlu tvrdilo, že výrobcom každého strešného boxu je MAKY.STORE.

**Táto oprava nepotrebuje deploy** — je to údaj v Saleore, číta sa za behu. Zadanie pre
CFM je napísané a odovzdané (viď §9).

---

## 4. Vlákno B — stav a prečo ho nezapínať naostro

Vetva `claude/vlakno-b-selektor-datasethash-0387f6 @ 2139f1a`, kód `c01e58f`, branch-only.
Brány hlásené vláknom B (mnou neoverené): tsc 0 · lint 0 · i18n 12/12 · **1 561 testov** ·
build `eGSbb-nArr3iB80axkR5M`.

Hotové: B0 (6/6), selektor `značka → model → rok`, Garáž v2, prijatie CFM pilota cez HTTP,
reálny priechod až do košíka.

**Prečo nezapínať:** pilot pokrýva **67 produktov z 9 606** a **6 značiek**. Zákazník so
Škodou otvorí „Vybrať vozidlo“ a uvidí BMW, FORD, TOYOTA, AUDI, KIA, HYUNDAI — prečíta si
to ako „tento obchod nemá nosiče na moje auto“. PDP mlčia správne (brána
`datasetSpeaksForProduct`), ale **selektor je viditeľný vždy**.

Odporúčané poradie vlákna B, ktoré preberám:

1. Nasadiť kód B s **vypnutým** providerom — `MAKY_FITMENT_PROVIDER` neuvedené = funkcia
   mlčí. Rovnaký vzor ako „deployed but OFF“ pri SEO bráne.
2. CFM doručí plný snapshot (9 192 riadkov) a opraví okno BMW X5 E53 presahujúce výrobu
   a `evidence.supplier` malými písmenami.
3. Až potom zapnúť provider — jeden ENV prepínač a reštart, bez buildu.
4. Rozhodnúť o 55 držaných riadkoch (47 mapping suspects + 21 clamp) — Marek + CFM.

Detail je v `docs/design/handoff-20260907-vlakno-b-pilot-prijaty.md` na vetve B. Jeho §6.1
opravuje predošlý handoff — meranie selektora proti resolveru priamo prečítalo výsledok
ako mlčanie, ale reálna cesta ide cez `saveVehicle`, ktorý strechu dosadzoval.

---

## 5. Publikovaný fitment dataset je vo verejnom repozitári

`test/fixtures` s CFM pilotom je v gite. Repozitár je **verejný fork**, takže je čitateľný
pre kohokoľvek a v sieti forkov dosiahnuteľný cez SHA natrvalo (CLAUDE.md §10.1).

Osobné údaje ani credentials tam **nie sú** — overené. `sourceRef` a `saleorProductId` boli
verejné aj predtým (renderujú sa na webe / dajú sa anonymne vytiahnuť z API). Skutočne nové
sú: `CFMP-` identifikátory, skóre dôvery `0.9/0.95`, a to, že 6 mapovaní držíme ako
podozrivé — posledné je komerčne najcitlivejšie, konkurent vidí, kde si nie sme istí.
Pri 6 riadkoch nízka stávka. **Riešenie nie je mazať commit** — buď požiadať CFM, aby
`confidence` a dôvody držania nešli do storefrontového payloadu, alebo migrácia na privátny
repozitár (nové repo, nie prepínač).

---

## 6. Zlúčiteľnosť A ↔ B — overená, nie predpokladaná

`git merge-tree` medzi `2139f1a` a produkčným `a5978f5`: **čistý merge, žiadny konflikt.**
B stojí na `27b7088`, teda 40 commitov nad predošlou produkciou.

Prekryv je v dvoch súboroch a **oba sa skladajú správne** — overené na zlúčenom strome,
nie len „git nehlási konflikt“:

- `variant-section-dynamic.tsx` — moja projekcia `variantsForClient` prežila (surové
  `variants={variants}` = 0×), B-čkovský `PdpCompatibility` prežil, `order` posun prežil.
- `[productSlug]/page.tsx` — `publicSku()` na oboch miestach.
- `brand.css` — moje tri animácie prežili.

**Nové vlákno teda môže mergnúť produkciu do B bez obáv.**

---

## 7. Prostredie — pasce, ktoré už stáli čas

1. **NIKDY `pnpm build` v `/opt/storefront`, kým beží PM2** (CLAUDE.md §13.1). Presne to
   spôsobilo výpadok 5. 9. Build vo worktree je výslovne povolený (§13.7).
2. **`pgrep -f "next start"` zabije tvoj vlastný shell.** PID hľadaj cez `ss -ltnp | grep :PORT`.
   Nikdy nesiahaj na `:3000`. Aj `kill` na vlastný wrapper si zabije shell — stalo sa mi to.
3. **`| tail` a `| tee` maskujú exit kód.** Zachytávaj `RC=$?` hneď za príkazom.
   Raz som takmer ohlásil ako úspešný deploy, ktorý zlyhal na preflighte.
4. **`ls` skrýva rollback snapshoty** — všetky začínajú bodkou. Použi `ls -a`. Táto falošná
   panika („žiadne snapshoty neexistujú“) stála čas dvakrát a je nepravdivá.
5. **`src/gql/` je gitignorované a generované.** Po prepnutí vetvy v `/opt/storefront`
   spusti `NEXT_PUBLIC_SALEOR_API_URL=… pnpm generate:all`, inak preflight padne na
   4 pagination testoch proti starému codegenu. **Neprebíjaj to cez `SKIP_TESTS=1`.**
6. **Build potrebuje aj `NEXT_PUBLIC_DEFAULT_CHANNEL`**, inak spadne na `/[channel]/cart`.
   Funkčná sada:
   ```
   NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/ \
   NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur \
   NEXT_PUBLIC_STOREFRONT_URL=https://maky.store \
   MAKY_LIVE_MARKETS=sk pnpm build
   ```
7. **`NEXT_PUBLIC_*` je zapečené do buildu.** Fault injection sa nedá spraviť premennou za
   behu — postav proxy na zapečenej URL.
8. **Pamäťový interlock deployu je 10 240 MB a na tomto stroji kolíše.** Zlyhal mi o 78 MB.
   Dokumentovaný postup je override na jeden beh, nie znižovanie defaultu:
   `MIN_FREE_MEM_MB=8192 ./scripts/ops/deploy-production.sh -m "…"`.
9. **`Write` tool a MCP nástroje padajú na hook timeoute.** Píš cez bash heredoc.
10. **Prehliadač: rozšírenie je pripojené, ale volania padajú na tom istom hook timeoute.**
    Overené, nie odhadnuté. **HTTP kontrolu nevydávaj za browser test.**
11. **Prettier v pre-commit hooku prepisuje staged súbory.** Po commite over znova — a
    podľa vlákna B ticho rozbije transportný hash pri zelených bránach.
12. **Dve pracovné kópie tej istej vetvy.** `/opt/storefront` aj worktree môžu mať tú istú
    vetvu vyzutú; commit v jednej posunie ref pod druhou. Pracuj na vlastnej vetve.

---

## 8. Otvorené rozhodnutia pre Mareka

- **BROWSER UAT vlákna A** — nikdy neprebehol. Checklist je hotový (31 bodov s overeným
  „pred/po“). Buď ho prejde Marek, alebo nové vlákno, ak mu prehliadač pôjde.
- **Nasadiť B s vypnutým providerom?** (§4, krok 1)
- **55 držaných fitment riadkov** — 47 mapping suspects + 21 clamp.
- **Lokalizované route slugy** — `/konfigurator` a `/garage` sú dnes rovnaké na všetkých
  trhoch. Neblokuje SK.
- **Šírka vyhľadávania na 360 px** (nález vlákna B).
- **Zmazať prekonanú vetvu `claude/sf-b-vehicles @ 667c986`?**
- **Verejný repozitár vs. fitment dataset** (§5).

---

## 9. Backlog — vedome odložené, needituj bez zadania

- **Sitemapa trvá 19,5 s**, trikrát po sebe rovnako → negeneruje sa z cache. 2,2 MB,
  ~96 dopytov do Saleoru pri každom stiahnutí crawlerom.
- **Cart page pri výpadku ~14 s** (3 lookupy × 4 pokusy). `retry: false` je jednoriadková
  zmena s reálnym kompromisom — rozhodnutie, nie oprava.
- **Poškodená checkout cookie** drží zákazníka v „nepodarilo sa načítať“.
- **`executeRawGraphQL`** nemá frontu, timeout ani signál.
- **Multimarket SEO (A4)** — pri jednom živom trhu je hreflang prázdny, neblokuje SK.
- **Hydration #418** — existuje na baseline; existencia nie je dôkaz nulového dopadu.
  Jeden reproducer v čistom profile, dotknutá hranica, dopad. Bez plošného vypínania SSR/PPR.
- **Zadanie pre CFM** (značka + fitment export) je napísané a odovzdané Marekovi.

---

## 10. Hranice

**Povolené:** kód, testy, izolovaný build vo worktree, commit, push, read-only dopyty na
produkciu a Saleor.

**Zakázané bez Marekovho výslovného GO:** produkčný deploy, zmena Saleor dát, aktivácia
trhov, zapnutie `MAKY_FITMENT_PROVIDER`, zásah do `maky-smtp-app`, force-push, mazanie
vetiev, publikácia alebo skrytie produktov.

---

## 11. Prompt pre nové vlákno

> Pokračujeme na MAKY.STORE. Toto vlákno preberá **vlákno A aj vlákno B**.
>
> ZAČNI TÝM, ŽE SI PREČÍTAŠ `docs/design/handoff-20260907-vlakna-a-b-zlucene.md`
> na vetve `claude/sf-a-jsonld-sku-fix`. Je samostatný. Neoveruj si ho celý znova —
> over si len SHA cez `git ls-remote` (nie tracking ref) a aktuálny stav produkcie cez
> `/opt/storefront/.next/MAKY_DEPLOY_META`.
>
> Pre detail vlákna B si prečítaj aj `docs/design/handoff-20260907-vlakno-b-pilot-prijaty.md`
> na vetve `claude/vlakno-b-selektor-datasethash-0387f6`.
>
> Produkcia je `a5978f5`, BUILD_ID `T5C-THElOjjF2KPiRXbCd`, zdravá. Katalóg má 9 606
> publikovaných PDP. Jediný živý defekt je chýbajúca značka v štruktúrovaných dátach a je
> to dátová diera CFM, nie storefrontu — nerieš ju v kóde.
>
> **Počkaj na moje zadanie.** Ak žiadne nemáš, navrhni jeden konkrétny ďalší krok
> z §8 alebo §9 handoffu a spýtaj sa — nepúšťaj sa sám do backlogu.
>
> Prvá vec, ktorú spravíš pred akýmkoľvek tvrdením o stave: `pnpm check:published`.

---

## 12. Čo v tomto vlákne opravilo staršie tvrdenia

Zapisujem to natvrdo, lebo inak sa tie omyly objavia znova:

- **„Rollback snapshoty neexistujú“** — nepravda. Existovali celý čas; `ls` ich skryl.
- **„Animáciu zabila migrácia Tailwindu `776c793`“** — nepravda, zabil ju `467d9ef` deň nato.
- **„Skeleton je 5 miest“** / „8 miest“ — je ich **13 v 12 súboroch**.
- **„Pätička je právny problém“** — nie je. `FooterSkeleton` neobsahuje ani jeden `<a>`,
  takže ani jedna z navrhovaných opráv by neobnovila jediný odkaz. Skutočný rozsah je
  `<Suspense fallback={null}>` okolo celého obsahu v `layout.tsx` — bez JS vidí návštevník
  skeleton hlavičky a nič iné. To je rozhodnutie o architektúre shellu, nie CSS token.
- **„Chunky padali, preto ostal skeleton“** — `$RC` je v **inline** skripte bez `src`,
  takže padajúce chunky samy o sebe výmenu zastaviť nemali. Tá diagnóza nie je uzavretá.
- **„40/40 dokazuje 9 606“** — nedokazuje. Vzorka je vzorka; `check:published` to aj píše.
