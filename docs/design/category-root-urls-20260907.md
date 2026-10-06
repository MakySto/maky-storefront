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
  slug bez dopytu nahor nepozná, preto ho nepresmeruje (presmerovala by na root, kde by bol 404). Tak to bolo aj
  pred touto zmenou; lokalizovaný koreň dostane kategória, keď dostane riadok v `LOCALIZED_CATEGORIES`.
- **`.rsc` na starej adrese.** Rozhoduje sa na surovej ceste ako doteraz; zostarnutá karta prehliadača s odkazom
  `/sk/categories/x` dostane stránku cez rewrite, nový odkaz už ide na root.

### Overenie

Testy: proxy (každý slug zo zoznamu 308 na root, query, neznáma kategória ostáva, produkt sa nezamení za kategóriu,
Nordrive vo všetkých 12 trhoch), `categoryUrlFor`, sitemapa, `classifyRoute`, čítač zoznamu pre `check:nav`.
Živé overenie po nasadení: `pnpm check:nav` a postup nasadenia v `/mnt/project-files/storefront-4-5/`.

---

## Dodatok 2026-10-06 (2): nová kategória dostane root URL sama

Marek (cez koordinátora) 6. 10.: storefront si má kategórie načítať zo Saleoru namiesto ručného zoznamu v kóde, aby
nová kategória dostala `/{trh}/{slug}` bez zmeny kódu a bez nasadenia. Technické riešenie bolo na nás.

### Čo sa zvolilo

Zoznam v kóde (`STOREFRONT_CATEGORIES` + `OTHER_CATEGORY_SLUGS`, spolu `CATEGORY_SLUGS`) ostáva, ale je to
**základ** (angl. floor), nie celá množina. Bežiaci server k nemu pridáva kategórie, ktoré drží Saleor
(`src/lib/live-categories.ts`), a `isCategorySlug()` odpovedá „základ ∪ načítané“. Dôvody, prečo množina a nie dotaz:

- **Dotaz na každú adresu nie.** Koreň zdieľa približne 9 600 produktových slugov na trh a proxy beží pred každou
  stránkou. Pýtať sa Saleoru „je tento slug kategória?“ pri každej adrese, ktorú nevie zaradiť, by dalo požiadavku na
  cestu najnavštevovanejšej trasy webu. Jeden dotaz na všetky kategórie v pamäti a obnovovaný na pozadí odpovie na to
  isté cenou vyhľadania v množine, a rozhodnutie na okraji ostáva synchrónne ako doteraz.
- **Zoznam generovaný pri zostavení nie.** Stále by potreboval nasadenie pre každú kategóriu (to je asi tri a pol minúty
  výpadku).
- **Základ ostáva, lebo musí existovať vždy.** Pri studenom štarte aj pri výpadku Saleoru odpovedá základ, takže 30
  adries, ktoré dnes fungujú, nikdy neprestane smerovať.

### Ako to funguje

| kedy                                         | čo sa deje                                                                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| štart procesu (`instrumentation.ts`)         | načíta zoznam; štart na to čaká najviac 2,5 s, potom ide ďalej a načítanie dobehne na pozadí. Riadok v logu: `[live-categories] floor=30 live=N refused=K loaded=yes`                                        |
| každý požiadavok na adresu trhu (`proxy.ts`) | iba skontroluje, či je množina staršia ako minúta, a ak áno, spustí obnovu na pozadí. **Nikdy na ňu nečaká**; požiadavok dostane odpoveď z toho, čo je známe                                                 |
| udalosť kategórie na `/api/revalidate`       | obnoví zoznam hneď (najviac 2 s čakania) a **skôr, než sa čokoľvek expiruje**, aby sa cache, ktoré sa po expirácii znovu naplnia, naplnili už so správnou adresou. Telo odpovede (kontrakt SYNC-2) sa nemení |
| zostavenie sitemapy                          | pred zostavením zdroja trhu sa zoznam dorovná, ak je starší ako minúta                                                                                                                                       |

Kategória sa prijme (admission), iba ak: je to obyčajný slug z malých písmen, nie je to názov skutočnej cesty
(`/products`, `/poradna`, …), trhu, košíka ani lokalizovaného segmentu inej kategórie, a **žiaden produkt v žiadnom
z 12 kanálov nemá ten istý slug**. Posledné je kontrola, ktorú dnes robí `pnpm check:nav` ručne; robí sa raz, keď sa
kategória prvýkrát objaví (jedna požiadavka s 12 aliasmi `product(slug:, channel:)`). Odmietnutá kategória ostáva na
`/{trh}/categories/{slug}` (funguje), v logu je jedno varovanie `NOT routed at the root: <dôvod>` a pri každom ďalšom
načítaní sa kontroluje znova, takže v deň, keď sa produkt premenuje, presunie sa na root sama.

### Čo sa nemení

Rozlíšenie kategória/produkt na okraji, kategória vyhráva pri zhode slugu, 308 zo starých adries `/{trh}/categories/{slug}`
(aj s query reťazcom), `check:nav`, lokalizované segmenty kategórií (tabuľka `LOCALIZED_CATEGORIES` ostáva v kóde, pri
novej kategórii v zahraničí platí základný slug ako doteraz), vnútorná cesta `categories/[slug]` a obsah odpovede
`/api/revalidate`.

### Poruchové stavy

| stav                                                 | následok                                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Saleor nedostupný pri štarte alebo neskôr            | ostáva základ a to, čo sa už načítalo; opakovanie po 15 s, 30 s, … najviac 5 min; v logu jeden riadok na sériu zlyhaní    |
| odpoveď s `errors`, nesprávny tvar, čiastočný zoznam | berie sa ako zlyhanie; čiastočný zoznam nikdy nič neodoberie                                                              |
| kategória zmazaná v Saleore                          | úplný zoznam ju vyradí; základ sa nikdy neodoberá                                                                         |
| viac ako 10 nových kategórií naraz                   | prijíma sa 10 na načítanie, zvyšok pri ďalšom (rozpočet, nie chyba)                                                       |
| nová kategória medzi dvoma obnovami                  | najviac minútu (alebo do udalosti kategórie) ostane na `/categories/…`, ktoré funguje a po naučení presmeruje 308 na root |

### Známe medze

- **Kolíziu skúša iba prvé videnie.** Produkt, ktorý dostane slug už prijatej kategórie neskôr, nájde `check:nav`
  (rovnako ako pri základe); kategória by ho zatienila.
- **Navigácia pečená pri zostavení.** `NavLinks` je `"use cache"` s profilom `navigation` (hodinový); pri zostavení sa
  zoznam nenačítava (`register()` pri `next build` nič nevolá von), takže kategória mimo základu v menu Saleoru by
  v predpečenom výstupe niesla `/categories/…`, ktoré 308 vedie na root, kým sa záznam neobnoví. Ak to niekomu
  prekáža, stačí slug dopísať do `OTHER_CATEGORY_SLUGS` pri najbližšej zmene kódu; URL sa tým nemení.
- **Jeden proces.** Stav je v pamäti procesu (`globalThis`), ako pri `route-existence.ts`. Dnes beží jeden proces
  `maky-storefront`; pri viacerých by každý mal vlastnú množinu.
- **Pevný zoznam vyhradených slov v CFM.** CFM drží pre prideľovanie slugov produktov pevných 68 slov (30 slugov
  kategórií, 18 lokalizovaných koreňov, trasy storefrontu; údaj CFM zo 6. 10.). Kategóriu mimo tých 30, ktorú storefront
  naučí zo Saleoru, ten zoznam nepozná, a keďže kategória pri zhode vyhráva, produkt, ktorému sa taký slug pridelí
  neskôr, by za ňou zmizol. Prosba pre CFM (pri prideľovaní rezervovať aj všetky slugy kategórií, ktoré Saleor v tej
  chvíli drží) je v bloku, ktorý Marek vkladá do vlákna CFM. Kým ju CFM nerealizuje, kolíziu nájde
  `pnpm check:nav --saleor-only --all-channels`.

### Overenie

V cloude: testy modulu proti falošnému Saleoru (nová kategória v každom trhu, kolízia s produktom, výpadok, čiastočný
zoznam, backoff, jedno načítanie pre súbežných volajúcich, udalosť počas načítania), proxy (nová kategória: odpoveď z
toho, čo je známe, potom rewrite aj 308, vozidlové stránky, cudzí trh, kolízia, Saleor nedostupný, Saleor, ktorý
neodpovedá), `/api/revalidate` (zoznam sa načíta pred prvou expiráciou, telo odpovede nezmenené), sitemapa, štart
servera a `check:nav` proti falošnému Saleoru a webu v piatich scenároch. Celá sada so skutočnými vygenerovanými
GraphQL typmi: 3 865 testov prešlo, 38 preskočených zámerne, 0 padlo (špička vydania `d1740621` má s typmi 3 812,
rozdiel je presne 53 nových testov), `tsc` a `eslint` bez chýb. `next build --experimental-build-mode=compile`
(Turbopack) prešiel; v klientskych chunkoch nie je kód načítania a v serverových je modul vo viacerých kópiách, čo je
dôvod, prečo je stav na `globalThis`. **Neoverené z cloudu:** skutočný Saleor, plné zostavenie a `next start` (najmä to,
že proxy a route handlery zdieľajú `globalThis` ako pri `route-existence.ts`; ak by ho nezdieľali, proxy sa naučí
kategórie z prvej požiadavky a stránky zo štartu a z udalostí kategórie) a pohľad v prehliadači.

Na serveri po nasadení: v logu `[live-categories] floor=30 live=0 refused=0 loaded=yes` (CFM čítalo Saleor 6. 10. o
9:48 UTC a drží presne tých 30 známych kategórií; `live` sú kategórie nad základom); `pnpm check:nav` (kategórie nad
základ vypíše a skontroluje od konca po koniec); v HTML domovskej stránky nemá byť odkaz `/sk/categories/…`
(`curl -s https://maky.store/sk | grep -o 'href="/sk/categories/[^"]*"'`). Skúška nového správania: vytvoriť testovaciu
kategóriu v Saleore (po Marekovom súhlase) a do minúty musí `/sk/<slug>` odpovedať ako kategória a
`/sk/categories/<slug>` presmerovať 308.
