# Kategórie na root URL (2026-09-07)

Vetva `fix/category-root-urls-v1`, odbočená z nasadeného `f8ffeba`.

> **Stav od 6. 10. 2026:** rozhodnutie v §4 (root URL iba pre 8 katalógových kategórií) už neplatí. Root dostali
> všetky kategórie Saleoru, vybrala sa cesta „set vo zdrojovom kóde“. Pozri **Dodatok 2026-10-06** na konci.

`/sk/categories/stresne-nosice` → **`/sk/stresne-nosice`**, so 308 zo starej adresy.

---

## 1. Prečo to nie je kozmetika

CFM vygenerovalo 1 475 vozidlových stránok s cestami tvaru
`/stresne-nosice/skoda/octavia-combi/nx`. Tie visia na root kategórie. Keby sa root
otvoril až po nich, presúvali by sa tie URL druhýkrát — a druhý presun indexovaných
adries je to, čo sa v SEO nikdy nevyplatí.

## 2. Čo sa zmenilo

| miesto                       | zmena                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `categoryHref()`             | `/categories/{slug}` → `/{slug}` — menu aj mriežka idú za ňou                                                                |
| `categoryUrl(slug)` **nové** | jediná funkcia, ktorá vie, či kategória patrí na root; volajú ju PDP drobček, karta produktu, `nav-links` aj sitemapa        |
| `proxy.ts`                   | **308** `/{market}/categories/{slug}` → `/{market}/{slug}` a **rewrite** `/{market}/{slug}` → interne na `categories/{slug}` |
| `categories/[slug]/page.tsx` | canonical a drobček na novú adresu                                                                                           |
| `sitemap.ts`                 | cez `categoryUrl()`                                                                                                          |
| `route-existence.ts`         | `classifyRoute` pozná root kategórie                                                                                         |

## 3. Prečo je oboje v proxy a nie v route súbore

Pod PPR sa `redirect()` z route súboru vráti ako **200**, lebo škrupina je odoslaná skôr,
než stihne nastaviť status. Toto nie je teória — presne to už raz dokázala migrácia
`/products/{slug}` → `/{slug}` a jej komentár v `proxy.ts` to hovorí nahlas. Rovnaké
obmedzenie drží aj bránu existencie v proxy.

## 4. Delené, nie univerzálne — a to je to podstatné rozhodnutie

**Saleor má 30 kategórií, 21 s produktmi. `src/config/categories.ts` ich menuje 8.**

Root URL dostane len tých 8. Ostatných 22 si ponechá `/categories/{slug}` ako svoju
skutočnú adresu. Dôvod je mechanický: proxy rozhoduje o root menných priestoroch
z **build-time setu**, bez dopytu nahor — inak by musela pri každom requeste na
`/sk/čokoľvek` ísť do Saleoru. Slug, ktorý v tom sete nie je, prepadne na
`[productSlug]` a skončí ako soft-404.

Preto sa **308 spúšťa iba pre katalógový slug.** Keby presmerovávalo všetko,
`/sk/categories/prislusenstvo-k-stresnym-boxom` by odišlo na root, kde nič nie je —
z funkčného výpisu by sa stala 404.

Nie je to len obchádzka. Tých 22 sú prevažne vedierka s príslušenstvom a náhradnými
dielmi (`prislusenstvo-k-stresnym-boxom`, `nahradne-diely-k-nosicom-bicyklov`) plus
značkové duplikáty hlavných výpisov. `/sk/prislusenstvo-k-stresnym-boxom` by si nárokovalo
postavenie prvej úrovne, ktoré tomu obsahu nepatrí. **Každá kategória má aj tak práve
jednu kanonickú adresu** — a to je vlastnosť, na ktorej crawlerovi záleží.

Ak sa raz rozhodne, že root majú dostať všetky, sú na to dve cesty a obe sú väčšia práca
než tento blok:

- **generovaný set** (`pnpm generate:categories` → commitnutý súbor, ako
  `routing.generated.ts`) — jednotný tvar, ale nová kategória v Saleore nemá funkčnú
  adresu až do ďalšieho deployu; `check:nav` by to musel hlásiť nahlas,
- **rozlíšenie za behu** — `[productSlug]` by pri nenájdenom produkte skúsil kategóriu.
  Žiadne zastarávanie, škáluje na čokoľvek, ale zasahuje do najhodnotnejšej routy v
  aplikácii (9 577 stránok, PPR, metadáta, cache) a bránu existencie treba naučiť pýtať
  sa na obe rodiny.

## 5. Dve pasce, ktoré chytili testy a jedna, ktorú chytil Saleor

- **RSC navigácia.** Klient si pýta `/sk/stresne-boxy.rsc` a
  `/sk/stresne-boxy/_segments/<id>.segment.rsc`. Porovnanie surového segmentu s katalógom
  ich minie — `"stresne-boxy.rsc"` nie je slug kategórie — takže by prepadli na produktovú
  routu a **každý preklik do kategórie vnútri aplikácie by sa rozbil, kým prvé načítanie
  stránky by vyzeralo bezchybne.** Rozhoduje sa preto na normalizovanej ceste a prepisuje
  sa pôvodnou.
- **`classifyRoute` by 404-ovala všetky kategórie.** Root je odteraz spoločný s produktovými
  slugmi; bez úpravy by sa brána existencie pýtala `product(slug: "stresne-nosice")`,
  dostala pravdivé „neexistuje" a 404-la každú kategóriu — v deň, keď sa brána zapne.
  Dnes je vypnutá, čo je presne dôvod, prečo by sa to našlo neskoro.
- **21 vs 8.** Prvá verzia posielala do sitemapy root URL pre všetkých 21 zásobených
  kategórií, kým proxy prepisovala 8. Testy prešli — mockujú Saleor fixtúrami. Našlo sa to
  až otázkou na živý Saleor. To je ten istý dôvod, pre ktorý existujú `check:published`
  a `check:nav`.

## 6. Overenie

Brány: lint 0 · tsc 0 · i18n 0 · **1 240 testov** · build 0.

`pnpm check:nav` sa po tejto zmene pýta tri veci, ktoré vie zodpovedať len živý systém:
či canonical menuje novú adresu, či stará ešte 308-uje, a — to nevidí nič iné — či
**nejaký PRODUKT nedostal slug kategórie**. Root je spoločný menný priestor s 9 577
produktovými slugmi, proxy kolíziu rieši v prospech kategórie a produkt by ticho prišiel
o svoju kanonickú adresu. Dnes kolízia neexistuje; to je stav, nie záruka.

---

## Dodatok 2026-10-06: root URL pre všetkých 30 kategórií

Marek (cez CFM) 6. 10.: `/sk/categories/nosice-bicyklov-na-tazne-zariadenie` má byť
`/sk/nosice-bicyklov-na-tazne-zariadenie`, rovnako ako vozidlové stránky
`/sk/stresne-nosice/mazda/cx-60/kh`. Smerovanie je storefrontu, takže návrh aj nasadenie patria sem.

### Čo sa zvolilo z dvoch ciest v §4

**Commitnutý zoznam, nie rozlíšenie za behu.** `src/config/categories.ts` nesie `STOREFRONT_CATEGORIES` (8
katalógových) a nový `OTHER_CATEGORY_SLUGS` (22 ďalších vrátane `default-category`). Dokopy je to presne
tých 30 kategórií, ktoré Saleor drží, a `CATEGORY_SLUGS` z nich skladá množinu, podľa ktorej proxy
rozlišuje kategóriu od produktu. Dôvody:

- `[productSlug]` ostáva nedotknutý (9 577 stránok, PPR, cache, metadáta) a brána existencie sa nemusí učiť pýtať na
  dve rodiny naraz;
- rozhodnutie o `/{trh}/{slug}` stále padá v proxy bez dopytu nahor, synchrónne;
- kategórie vznikajú zriedka (CFM má zamknutú taxonómiu) a nová kategória nespadne: kým jej slug nie je v zozname,
  zostáva na `/{trh}/categories/{slug}`, čo funguje, a `pnpm check:nav` ju vypíše.

Cena: nová kategória v Saleore sa dostane na root až so zmenou zdrojového kódu a nasadením.

### Čo sa zmenilo

| miesto                  | zmena                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories.ts`         | `OTHER_CATEGORY_SLUGS`; `CATEGORY_SLUGS` je zjednotenie. `categoryUrl()` a `categoryUrlFor()` vracajú root pre všetky, `/categories/{slug}` iba pre slug, ktorý build nepozná |
| `proxy.ts`              | 308 `/{trh}/categories/{slug}` → `/{trh}/{segment}` pre každú kategóriu v množine, jeden skok, query sa zachová. Rewrite na `categories/[slug]` sa nemení                     |
| `category-routes.ts`    | zmizol `placement: "listing"`: Nordrive polica (`nordrive-stresne-nosice`) má root URL ako ostatné, v cudzom trhu `nordrive-<lokalizovaný koreň>`                             |
| `category-aliases.ts`   | zmizla `listingCategoryAliasTarget`, nemá čo robiť                                                                                                                            |
| `nav-links.mjs`         | kontroluje všetkých 30: root odpovedá, canonical, 308 zo starej adresy, žiadny produkt s rovnakým slugom, a porovnáva zoznam v kóde so Saleorom                               |
| `published-content.mjs` | berie do `NON_PRODUCT` všetkých 30 slugov, nielen osem                                                                                                                        |

Nemení sa: interná cesta `app/[channel]/(main)/categories/[slug]`, `/api/revalidate` (revaliduje interné cesty
`/{kanál}/categories/…` a značky `category:{kanál}:{locale}:{slug}`, verejná adresa je iba rewrite), sitemapa
(volá `categoryUrlFor`, preto sama ide na root; „21 vs 8“ z §5 tým zaniká, obe strany čítajú jednu množinu),
canonical, hreflang, drobčeky a karty produktov (všetko cez `categoryUrlFor`).

### Kolízie

- **Kategória vs. produkt:** v koreni vyhráva kategória, ak slug je v množine. Slugy kategórií sú krátke
  slovenské názvy; produktové slugy nesú značku, model a kód. Zhodu zo Saleoru overí `pnpm check:nav`
  (`product(slug:)` pre každý slug kategórie), v zahraničí treba rezerváciu slugov kategórií pre `new_slug`
  na strane CFM.
- **Vozidlové stránky `/{trh}/{sortiment}/{značka}/{model}/{generácia}`:** `{sortiment}` JE slug kategórie, rovnaký
  menný priestor. Cesta pod slugom kategórie ide do `categories/[slug]/[...vehicle]`; kategória bez vozidlového
  stromu odpovie „nenájdené“ presne ako doteraz pod `/categories/`. Značka a model sú až druhá úroveň, takže s
  kategóriou v koreni nekolidujú.
- **Cesty trhu (`MARKET_ROOT_SEGMENTS`):** `categories.test.ts` zlyhá, ak niektorý slug kategórie je zároveň cestou.

### Čo ostáva mimo

- **Zahraničné preložené slugy.** Kategóriu, ktorú CFM preložil a tabuľka v `category-routes.ts` ju nemá, odkazuje
  navigácia kategórií dnes pod `/{trh}/categories/{preložený slug}` (napr. `/de/categories/fahrradtraeger`). Proxy ten
  slug bez dopytu nahor nepozná, preto ho nepresmeruje (presmerovala by na root, kde by bol 404). Zahraničné trhy
  sú v náhľade (`noindex`); lokalizovaný koreň dostane kategória, keď dostane riadok v `LOCALIZED_CATEGORIES`.
- **`.rsc` na starej adrese.** Rozhoduje sa na surovej ceste ako doteraz; zostarnutá karta prehliadača s odkazom
  `/sk/categories/x` dostane stránku cez rewrite, nový odkaz už ide na root.

### Overenie

Testy: proxy (každý slug zo zoznamu 308 na root, query, neznáma kategória ostáva, produkt sa nezamení za kategóriu,
Nordrive vo všetkých 12 trhoch), `categoryUrlFor`, sitemapa, `classifyRoute`, čítač zoznamu pre `check:nav`.
Živé overenie po nasadení: `pnpm check:nav` a postup nasadenia v `/mnt/project-files/storefront-4-5/`.
