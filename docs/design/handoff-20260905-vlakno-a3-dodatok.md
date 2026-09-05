# Vlákno A3 — dodatok k zadaniu (2026-09-05)

**Čítaj SPOLU so zadaním `A3-SKU-GALERIA-KOSIK-SEO.md`. Tento dokument ho nenahrádza —
opravuje v ňom to, čo je proti dátam nepravdivé, a dopĺňa, čo v ňom chýba. Kde si
odporujú, platí tento.**

Všetko nižšie je overené priamym čítaním kódu na `59c32a1` alebo dotazom na živý
`api.maky.store` dňa 2026-09-05. Nezačínaj tým, že si to overíš znovu.

---

## 0. Východisko

|                         |                                                                 |
| ----------------------- | --------------------------------------------------------------- |
| Vetva A                 | `origin/claude/sf-a-catalog-l10n-seo @ 59c32a1` — **pushnutá**  |
| Vetva B                 | `origin/claude/sf-b-vehicles @ 3a981ac`                         |
| Produkčný adresár       | `/opt/storefront` na `feat/cms-m2 @ e353c70`                    |
| **Bežiaci artefakt**    | **`bdcc925` / BUILD_ID `iyLXwmjRqPX0jdVSumaqz`**                |
| Predchádzajúce handoffy | `handoff-20260905-vlakno-a.md`, `handoff-20260905-vlakno-a2.md` |

Gate na `59c32a1`: tsc 0 · lint 0 errors · **1142 testov / 73 súborov** · i18n OK (12
locales) · `next build` zelený v izolovanom worktree.

**Produkcia nemá NIČ z tejto vetvy.** Preto každé „na živej stránke stále vidno X" o
JSON-LD, `AggregateOffer`, `index, follow` na `/sk/cart` alebo počte produktov v listingu
**popisuje `bdcc925`, nie `59c32a1`**. Nezadávaj tie opravy znovu — sú hotové a čakajú na
deploy. Over ich proti buildu vetvy, nie proti maky.store.

---

## 1. OPRAVA A3 §1 — `cfm_source_sku` je NULL, celý postup stojí na neexistujúcom poli

A3 hovorí: „krátky zdrojový kód je v dátovom kontrakte pripravený" a nech A prepne PDP na
`sourceSku`. **To by nezobrazilo nič.**

Overené na referenčnej Niva PDP (`UHJvZHVjdDo0ODE=`):

```
variant.name    : N21048|N20003|N15428|N15428          ← požadovaný krátky kód
variant.sku     : N21048|N20003|N15428|N15428|CFMP-B-NOR-57acce2f8ef56b-000000
cfm_source_sku  : null                                  ← A3 predpokladá, že tu niečo je
availability    : sale_to_order  (na VARIANTE)  qty 50
```

Takže krátky kód v draweri **nepochádza zo `sourceSku`**, ale z `variant.name`.

Čo z toho vyplýva pre implementáciu:

- **Nezavádzaj `sourceSku` ako zdroj, kým CFM nepotvrdí pokrytie.** Dnes je prázdny.
- `variant.sku` je doslova `<krátky kód>|<CFMP suffix>`. Krátky kód je jeho **prefix** —
  a práve preto je lákavé ho odrezať. **Nerob to.** Prefix je pravdivý na tomto produkte,
  nie kontraktom.
- Zdroj musí byť **deklarovaný**, nie uhádnutý. Priorita: schválené autoritatívne pole →
  `variant.name`, ak CFM potvrdí formát a pokrytie → inak **nezobraziť nič**. Interné
  `CFMP-*` sa zákazníkovi nesmie ukázať nikdy.
- V kóde to volaj `displayCode` / `publicCode`. **Nie `sku`.** Nemusí byť unikátny a
  nesmie sa stať kľúčom pre spájanie, deduplikáciu ani fitment.
- `N15428|N15428` sa nesmie „vyčistiť" — sú to dva priečniky.

### Konkrétna chyba na tejto vetve, ktorú A3 nemenuje

`[productSlug]/page.tsx:246-247` posiela do JSON-LD:

```ts
sku: variants[0]?.sourceSku || variants[0]?.sku,
mpn: variants[0]?.sourceSku || variants[0]?.sku,
```

So `sourceSku = null` teda **oboje = dlhé technické SKU**. `sku` tak je v poriadku (stabilná
identita, presne ako sa odporúča), ale **`mpn` je nepravdivé**: komponentový reťazec ani
CFMP suffix nie je výrobné číslo dielu. **Odstráň `mpn`**, kým neexistuje skutočné. To isté
platí pre riadok 262 vo variantovej vetve.

---

## 2. OPRAVA A3 §2 — a oprava môjho vlastného prvého záveru

A3 navrhuje ~1600 px pre galériu a 2400–2560 px pre lightbox, a odporúča test kvality
`q=75` vs `q≈85`. **Zmeral som celý reťazec — stiahnuté súbory, dekódované pixely,
odhad JPEG kvality a porovnanie cez `sharp`, nie čísla z URL.** Výsledok vyvracia A3
aj moju vlastnú prvú hypotézu, že problém je v kompresii.

### 2.1 Rozlíšenie: strop je 1000×1000

```
size:1024 / 2048 / 4096 / url (bez size)   →  všetko dekóduje 1000×1000
```

Vyššie rozlíšenie neexistuje. Cieľ 2400 px je na týchto dátach nedosiahnuteľný.
**Nehlás „zvýšili sme rozlíšenie", keď si len zväčšil číslo v URL.**

### 2.2 Varianty existujú — a je ich viac, než sa zdalo

Saleor drží pre jedno médium niekoľko odvodených súborov:

```
_thumbnail_2.jpg   256×256     4,7 KB   JPEG q≈65
_thumbnail_.webp   1000×1000  12,5 KB   WebP      ← toto stránka používa
_thumbnail_4.jpg   1000×1000  33,8 KB   JPEG q≈65 ← „originál", ktorý Saleor dostal
```

**Oprava mojho skoršieho tvrdenia:** napísal som, že `size:4096` sa servíruje z
`api.maky.store` namiesto CDN. To bol **artefakt prvého dotazu** — Saleor thumbnail
generuje on-demand, prvé volanie vráti origin URL a po vygenerovaní je súbor na CDN.
Pri druhom meraní `size:4096` vracia CDN. **Nie je to trvalá vlastnosť a nie je to
dôvod nežiadať väčšie veľkosti** — dôvod je jednoducho ten, že väčšie pixely neexistujú.

### 2.3 Kompresia NIE JE problém — a toto je hlavný záver

Porovnal som WebP (12,5 KB), ktorý stránka používa, proti JPEG (33,8 KB), teda proti
najmenej komprimovanému, čo pre toto médium existuje:

```
PSNR                 42,97 dB     (>40 = vizuálne prakticky nerozoznateľné)
priemerná odchýlka    1,81 / 255
vzorky nad 8/255      1,15 %
edge energy (detail)  JPEG 54,00   vs   WebP 53,95
```

**Edge energy je zhodná na dve desatiny promile.** WebP nestratil ostrosť — je 2,7×
menší pri prakticky nezmenenom detaile. Prechod na JPEG variant by pridal ~9 % bajtov
(13 860 B vs 12 702 B cez `/_next/image`) a **žiadny detail**.

Zároveň: **produkcia dnes prijme iba `q=75`.** Každá iná hodnota vracia **HTTP 400**,
lebo Next 16 vyžaduje `images.qualities` a tá v `next.config.js` nie je. Takže test
„75 vs 85" sa bez zmeny konfigurácie ani nedá spustiť — a podľa meraní vyššie by aj tak
nič nezískal.

### 2.4 Skutočná príčina mäkkého dojmu: kompozícia, nie kodek

Zmeral som, koľko z tej štvorcovej plochy zaberá samotný výrobok (bounding box po
orezaní bielej):

```
médium        rámec        produkt        využitie rámca
…IzNjc=    1000×1000     820×487            40 %
…IzNjg=    1000×1000    1000×433            43 %
…IzNjk=    1000×1000    1000×659            66 %
…IzNzA=    1000×1000     871×335            29 %
…IzNzE=    1000×1000     931×460            43 %
…IzNzI=    1000×1000     619×514            32 %
```

Strešný nosič je široký plochý predmet vo **štvorcovom** rámci, takže 34–71 % plochy je
biela. Vertikálne má produkt iba **335–659 px**. Galéria ten štvorec navyše vkladá do
`aspect-[4/3]` boxu s `object-contain p-2`, čiže **letterboxuje druhýkrát** — štvorec
zaberie 75 % šírky kontajnera a produkt z toho ešte len svoju časť.

V lightboxe je `sizes="100vw"`, ale zdroj má 1000 px, takže pri 2× DPR sa obraz
**zväčšuje nad svoje rozlíšenie**. To je presne ten mäkký dojem.

### 2.6 Koľkokrát sa obrázok komprimuje a čo to stojí

Reťazec má **tri lossy priechody**, nie jeden:

```
1.  niečo vyrobilo 1000×1000 JPEG q≈65      (CFM alebo dodávateľ — zvonku nerozlíšiteľné)
2.  Saleor thumbnail  → WebP 12,5 KB
3.  Next /_next/image → WebP 12,4 KB        (áno, Next komprimuje ZNOVU)
```

Zmerané, čo každý priechod stojí (PSNR proti najmenej komprimovanému, čo existuje):

```
Saleor WebP                       42,97 dB     edge 53,95
Next výstup (čo prehliadač dekóduje) 42,55 dB  edge 53,91
Next samotný priechod (WebP → WebP)  51,27 dB  ← prakticky bezstratový
```

**Next síce komprimuje druhýkrát, ale stojí to takmer nič.** Hlavný krok je Saleorov
WebP, a ani ten nestratil detail (edge energy nezmenená).

Jeden lacný zisk sa však našiel: keby Next dostal ako zdroj **JPEG namiesto Saleorovho
WebP**, výsledok je **45,68 dB** namiesto 42,55 dB — o 3,1 dB bližšie k originálu za
**+1,1 KB** (13,5 vs 12,4 KB). Odstráni to jeden z troch priechodov. Malé, ale reálne.

### 2.7 AVIF sa neservíruje vôbec — a CFM derivatives sú nevyužité

`next.config.js` **nemá `images.formats`**, takže platí default `['image/webp']`.
Overené proti produkcii:

```
Accept: image/avif,image/webp,*   →  image/webp   12 702 B
Accept: image/webp,*             →  image/webp   12 702 B
Accept: image/*                  →  image/jpeg   19 464 B
```

**Ani keď prehliadač AVIF výslovne ponúkne, dostane WebP.**

Zároveň: storefront berie obrázky zo **Saleorových thumbnailov**
(`cdn.maky.store/thumbnails/products/…_thumbnail_.webp`), nie z CFM tabuľky
`mediaderivative`. Tých ~8 834 AVIF/WebP derivátov (320/640/960, profil `tazar_v1`)
**storefront dnes nepoužíva vôbec.** Buď ich zapojiť — sú predgenerované, obišli by
Next optimizer aj tretí priechod — alebo prestať generovať. Poznámka: ich strop je
960 px, takže pre lightbox by aj tak nestačili.

### 2.8 Zhoršilo kvalitu CFM? — poctivá odpoveď: zo storefrontu sa to nedá určiť

Zmeral som iba to, čo drží Saleor. Čo dostal na vstupe, odtiaľto nevidno. Dve fakty,
ktoré k tomu treba priložiť:

```
Nordrive strešné nosiče — 17 médií z 3 produktov:  VŠETKY presne 1000×1000 JPEG
                                                    0,026–0,061 B/px
iné produkty (Amos) v tom istom Saleore:           1400×1400 PNG, až 692 KB
                                                    540×540, 800×533 …
```

Saleor teda **nenormalizuje** — iné produkty majú 1400×1400 a stokrát väčšie súbory.
Ale celá Nordrive sada je **na pixel rovnaká 1000×1000 JPEG**, čo je podpis
normalizačného kroku niekde pred Saleorom. Či ten krok dostal väčší originál, alebo mu
dodávateľ dal rovno 1000×1000, **vie povedať iba CFM** — v admine je pri asset vidno
zdrojový rozmer (screenshot ukazuje `png 768x768`, `jpeg 1024x768`, `png 900x675`,
`png 1400x1400`, čiže vstupy sa líšia).

**Konkrétna otázka na CFM:** aký bol zdrojový rozmer a formát pre Nordrive assety, ktoré
skončili ako 1000×1000 JPEG? Ak bol väčší, normalizácia stratila detail a dá sa to
prenastaviť. Ak nie, obrázky sú také, aké prišli, a lepšie sa dá len tesnejším orezom.

### 2.5 Čo teda zadaj

Na frontende (reálne zisky, žiadne sľuby o rozlíšení):

- **`sizes` podľa skutočnej šírky kontajnera.** Dnes je `50vw`, no galéria je polovica
  `max-w-7xl`, teda ~640 px, nie 960 px pri FHD. Prehliadač si pýta väčší kandidát, než
  vie využiť.
- **Neletterboxovať dvakrát.** Zváž pomer strán galérie bližší obsahu, prípadne render
  podľa skutočného bounding boxu. Orezanie ale mení kompozíciu — nerob to naslepo a
  nikdy neorezávaj montážne detaily.
- **V lightboxe nezväčšuj nad zdroj.** Strop zoomu na skutočné rozlíšenie je pravdivejší
  než rozmazaný upscale.
- Oddelený thumbnail/galéria/lightbox zdroj **ponechaj** — má zmysel, keď lepšie
  originály prídu. Dnes ale žiadny zisk neprinesie.
- **Nezvyšuj `q` plošne** a `images.qualities` dopĺňaj len ak preukážeš prínos. Podľa
  meraní ho nemá.

Na CFM (bez toho sa detail nezlepší):

- originály nad 1000 px;
- **tesnejší orez** — 29 % využitia rámca je horší problém než kodek;
- roly médií a ALT per médium (dnes má 6 médií jeden identický ALT s duplicitou
  „Cx Black Cx").

## 3. POTVRDENÉ A3 §3 — a je to jediný skutočný P0 v tejto vlne

`actions.ts:153` stále:

```ts
if (after === quantityBefore) {
	return { status: "rejected", message: "the request did not reach the checkout — nothing was added" };
}
```

Recenzia má pravdu a ja som to napísal príliš sebavedomo. Po timeoute môže pôvodná mutácia
**stále dobiehať**; okamžitý read bez zmeny nie je dôkaz, že nikdy nepríde. Ak v tej chvíli
povieme „nič sa nepridalo", zákazník klikne znova — a `checkoutLinesAdd` **nie je
idempotentné** (overené: 1 → 2 → 3).

Oprav presne takto:

- definitívne `rejected` **iba** pri doloženom doménovom odmietnutí, alebo keď mutácia
  ešte nebola odoslaná;
- timeout + nezmenený read → **ohraničené opakované čítanie**, potom `unconfirmed`.
  Po deadline sa neistota **nesmie** premenovať na potvrdené zlyhanie;
- neúspešné čítanie checkoutu nie je potvrdené zlyhanie;
- **nikdy** druhý add a nikdy absolútny prepis množstva ako „oprava";
- bez op-id netvrď exactly-once. Nadmerné množstvo neprepisuj — pošli človeka do košíka.

**Toto je jediná vec z celej vlny, ktorá poškodzuje zákazníka na produkcii** (produkcia
nemá ani `8569507`, ani `59c32a1` — beží tam pôvodný retry aj pôvodné pohltenie chýb).

---

## 4. DOPLNENIE — košík, ktorý A3 vôbec nerieši

Overené v kóde na tejto vetve:

- **Drawer nemá odkaz na `/{market}/cart`.** Ponúka len „Prejsť k pokladni"
  (`/checkout?checkout=…`) a „Pokračovať v nákupe" (`/products`). Samostatná stránka je
  teda pre zákazníka prakticky nedosiahnuteľná.
- **`/sk/cart` nevie meniť množstvo** — 0 výskytov `QuantityStepper` aj
  `CheckoutLinesUpdate`. Stránka je dnes slabšia než drawer.
- „Pokračovať v nákupe" odvedie z PDP preč, namiesto toho aby len zavrelo drawer.

To je ale **nová funkcionalita**, nie oprava. Zaraď ju za P0 (§3) a za SKU (§1) — a ak sa
vlna naťahuje, `/sk/cart` pokojne odlož. `noindex, follow` na cart/account/orders už na
tejto vetve je (`2be2899`); produkcia to nemá len preto, že sa nedeployovalo.

---

## 5. DOPLNENIE — čo je hotové a NESMIE sa zadať znovu

Toto zadanie stavia na dvoch predchádzajúcich vlnách. Na `59c32a1` je hotové:

|                                                                       | commit    |
| --------------------------------------------------------------------- | --------- |
| A0 base-slug fallback (release base inak 404-oval celý katalóg)       | `29b89f9` |
| prev-pagination (na prod. dodnes rozbíja mriežku kategórie)           | `581cea5` |
| pravdivé prázdne stavy + odstránené anglické placeholdery             | `f96ed8f` |
| noindex na cart/account/orders                                        | `2be2899` |
| pravdivé počty („12 produktov" pri 101 / 414)                         | `94be49b` |
| media `id` + zdieľaný `imageKey`                                      | `606fec4` |
| sitemap: kategórie s kurzorom, `/poradna`                             | `5c1a3bb` |
| search `direction=prev`, `/sk/products` metadata + canonical          | `37ca4d0` |
| kategóriový filter prestal ticho nefiltrovať                          | `8e872dd` |
| **typed add-to-cart** (`added/rejected/unconfirmed`)                  | `8569507` |
| tabuľka v popise už nepanuje stránkou                                 | `a704dfd` |
| revalidácia: 12 trhov, preklady, médiá, starý slug, `{expire:0}`      | `d03313b` |
| **JSON-LD `Product+Offer` / `ProductGroup+hasVariant`**, `lastmod`    | `3fb6b65` |
| **mutácie sa neopakujú na drôte** + `CartForm` s viditeľným výsledkom | `59c32a1` |
| read-only Nordrive manifest (`scripts/ops/nordrive-manifest.mjs`)     | `561c2fe` |

`$RX` na kategóriách je **uzavreté**: Next 16 PPR „resumable slots", digest spárovaný so
serverovým logom, serverové HTML nesie h1, počet, všetky produktové odkazy aj
`direction=next`. Nerob k tomu ďalší audit — ale ani neprenášaj „nulový dopad" na
interakcie, to overené nie je.

---

## 6. Prostredie — pasce, ktoré stoja hodiny

1. **`pnpm generate:all` v novom worktree ZLYHÁ** (worktree nemá `.env`). Spúšťaj
   `NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/ pnpm generate:all`.
   A **`| tail` maskuje exit kód** — mne to raz prešlo ako „exit 0", hoci codegen padol.
2. **Generované dokumenty sú `TypedDocumentString`, nie AST.** `print(doc)` z `graphql`
   hodí „Invalid AST Node"; použi `String(doc)`.
3. **`knip` na tejto vetve padá už teraz** (~15 pre-existing nepoužitých exportov).
   Nepridávaj ďalšie — nové typy nechávaj neexportované.
4. **vitest zbiera iba `src/**/\*.test.ts`** (nie `.tsx`, env `node`). React komponent sa
otestovať nedá — preto sú rozhodovacie pravidlá vytiahnuté do čistých funkcií
(`listingEmptyReason`, `listingResultCount`, `classifyCheckoutErrors`, `listingResultCount`).
5. **`cart.*` je commerce-manifest namespace.** Nový kľúč vyžaduje aj záznam v
   `docs/i18n/commerce-source-en.json`, inak `pnpm i18n:check` padne. A ten súbor
   **needituj cez `json.dumps`** — prettier ho formátuje inak a spraví to 450-riadkový
   diff. Vkladaj textovo.
6. **NA TOMTO STROJI NIE JE PREHLIADAČ.** Box je `aarch64` a Chrome for Testing nemá
   linux-arm64 build; puppeteer cache je prázdny prerušený download a inštalátor zlyhá.
   **Browser PASS sa z tohto stroja vyrobiť nedá.** HTTP kontrolu za browser test
   nevydávaj. (Toto vyvracia staršiu poznámku „headless Chromium na VPS funguje".)
7. **`generateSitemaps()` v Next 16.2.9 presunie sitemap na `/sitemap/<id>.xml` a root
   `/sitemap.xml` bude 404** — pričom naň ukazuje `robots.txt` aj deploy kontrola. Index
   sa musí napísať ako route handler, nie zapnúť vlajkou.
8. **Nikdy `pnpm build` v `/opt/storefront`** (CLAUDE.md §13.1). Pracuj vo worktree mimo
   neho; build tam je výslovne povolený (§13.7).

---

## 7. Poradie, ktoré odporúčam

A3 dáva SKU ako prvé. **Dal by som pred neho P0 košíka** — je to jediná vec, ktorá dnes
môže poškodiť zákazníka, a je malá.

1. **§3 — late-commit reconciliation.** Malé, izolované, žiadna závislosť.
2. **§1 — `displayCode`** na `variant.name`, po potvrdení pokrytia. Plus **odstrániť `mpn`**.
3. Odovzdať B dva kontrakty v presnom commite: `AddToCartResult` a `displayCode` helper.
4. **§4 — drawer → `/{market}/cart`**, zdieľaná položka, množstvo.
5. **§2 — galéria**: `sizes`, oddelené zdroje, lazy, `q` test. Bez sľubov o rozlíšení.
6. **§5 — zvyšné SEO**: lokalizovaný URL reťazec, sitemap index, identity-based hreflang.
7. Release kandidát + browser overenie **v prostredí B** (nie sudo/snap na produkcii).

### Dve veci, ktoré patria do reportu, nie do kódu

- **Deploy tejto vetvy je celý release** — 43 commitov, 141 súborov, +11 525/−649 v `src/`
  oproti bežiacemu artefaktu. Nie hotfix. Rizikové časti sú preverené: withdrawal je
  vypnutý (`WITHDRAWAL_BACKEND_LIVE` nie je „true"), exact-locale je na `sk` inertný,
  A0 overené na zbuildenej aplikácii, a reálny `cdn.maky.store` obrázok cez `/_next/image`
  vracia 200/6331 B (výpadková trieda z CMS pilotu tu nie je). Ale nazvi to tým, čím je.
- **Ak je P0 košíka urgentné pred celým releasom**, úzky hotfix z nasadeného `bdcc925` je
  legitímna alternatíva. Nerob z toho cherry-pick 43 commitov.

---

## 8. Pre CFM — čo od nich reálne treba

1. **Autoritatívne pole pre zákaznícky kód.** `cfm_source_sku` je na všetkých canary
   `null`. Buď ho naplniť, alebo potvrdiť `variant.name` ako deklarovaný zdroj — vrátane
   formátu a pokrytia naprieč kohortou. Nevytvárať tretie pole naslepo.
2. **Originály nad 1000 px.** Dnes je strop 1000×1000 na všetkých 6 médiách referenčného
   produktu. Bez nich je akákoľvek práca na „ostrejšej galérii" bezpredmetná.
3. **ALT per médium a rola obrázka** (`packshot`, `installed`, `detail`, `diagram`,
   `component`). Dnes má 6 médií jeden identický ALT s duplicitou „Cx Black Cx".
   Ilustračné montážne fotky označiť ako ilustračné.
4. **Dostupnosť je na VARIANTE** (`cfm_availability_mode = sale_to_order`), nie na
   produkte. Nevytvárať duplicitný metafield preto, že sa niekto pýta na zlé miesto.

---

_Zostavené 2026-09-05 z kódu na `59c32a1` a z anonymných dotazov na `api.maky.store`.
Rozmery obrázkov sú stiahnuté a prečítané z hlavičiek súborov, nie odvodené z URL._
