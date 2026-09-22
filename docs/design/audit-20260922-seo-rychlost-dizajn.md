# Audit maky.store — SEO, rýchlosť, dizajn (22. 9. 2026)

Audit živej produkcie `5e43c45` / `_HrnFALLdjn9mDMRr48zm` za Cloudflare. Iba čítanie:
žiadny zápis do Saleoru, žiadny deploy. Každý nález nižšie je overený naživo (headless
Chromium cez CDP, `curl`, nginx log, read-only Saleor GraphQL) alebo priamo v kóde; kde
overený nie je, je to napísané.

Nadväzuje na `HANDOFF-20260922-M-cloudflare-and-next.md` §5.

---

## 1. Čo návštevník videl (a prečo web pôsobil „chudobne“)

Dojem nerobili farby. Nefungovali základné prvky:

| Nález                                               | Dôkaz                                                                                                                              | Stav                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Mobilné menu prázdne na 12 trhoch                   | menu vkladalo `HeaderPrimaryNav` s `hidden lg:flex` do sheetu, ktorý existuje len pod `lg`; v DOM `nav` + 5 odkazov `display:none` | opravené `3a52e64`                                 |
| „Všetky kategórie“ nerobilo nič                     | `<button>` bez handlera od `467d9ef` / `2f796ad` (21. 3.)                                                                          | opravené `3a52e64`                                 |
| Footer bez kategórií                                | na mobile z PDP žiadna cesta do inej kategórie okrem drobkov a vyhľadávania                                                        | opravené `3a52e64`                                 |
| Homepage: 0 produktov, 0 fotiek                     | kolekcia `featured-products` v Saleore nikdy neexistovala (0 kolekcií)                                                             | čaká na kolekciu (§5)                              |
| Newsletter je atrapa                                | `type="button"`, bez handlera, bez `<form>`                                                                                        | **vlastník: ponechať**, backend príde              |
| Srdiečko → 404                                      | `/xx/wishlist` neexistuje, prefetch na každej stránke (183× 404 v nginx 22. 9.)                                                    | **vlastník: ponechať**; prefetch vypnutý `4787cde` |
| Geist sa sťahoval, nepoužil                         | `--font-sans: "Geist"`, @font-face je `GeistSans`; `document.fonts` = unloaded; text v systémovom fonte                            | opravené `59465e7`                                 |
| 404 pod trhom anglicky                              | `x-maky-gate: product:absent` → rewrite `/_not-found` → holá anglická stránka bez `lang`, hlavičky, vyhľadávania                   | otvorené (proxy = §10)                             |
| Mobil: lišta vozidla po slovách                     | `<p class="min-w-0 flex-1">` sa pri 360 px stlačil na ~100 px                                                                      | opravené `4787cde`                                 |
| Mobil: 3. riadok názvu presvitá                     | `min-h-[2.75rem]` > 2 riadky `line-clamp-2`                                                                                        | opravené `4787cde`                                 |
| „Domov“ na fotke nečitateľné                        | base `a { color: var(--text-link) }` prebil `text-white/70`                                                                        | opravené `4787cde`                                 |
| PDP „Popis“ dvakrát                                 | skoková karta aj pri jedinej sekcii                                                                                                | opravené `4787cde`                                 |
| Footer „s. r. o..“                                  | `legalName` končí bodkou                                                                                                           | opravené `4787cde`                                 |
| Placeholder sľuboval ťažné zariadenia               | 12 jazykov; kategória má 0 produktov (CLAUDE.md §1/§6)                                                                             | opravené `4787cde`                                 |
| Stránky vozidiel v SK `147.00 EUR`                  | zámerne ponechané v `offer-list.tsx`, čakalo na vlastníka                                                                          | **vlastník: €**, `feat/seo-base-v1`                |
| Kategória „Nosiče bicyklov“ začína dielmi za 4,30 € | koreň bez podkategórií, predvolené poradie                                                                                         | balík 6                                            |
| React #419 občas (4 z 24 načítaní, /sk aj /de)      | príčina **nezistená**; v logu súčasne `useContext must be inside a Provider` (`useSaleorAuthContext`, 117×)                        | otvorené                                           |

## 2. SEO

Východisko je zdravé: 205 náhodných URL zo sitemapy aj 122 cieľov drobkov = 200, vlastný
canonical, indexovateľné; hreflang recipročný (7 klastrov × 144 párov); route gate vracia
skutočnú 404; na 88 cudzojazyčných stránkach 0 slovenských zvyškov.

Diery (väčšina v `feat/seo-base-v1`):

- **Žiadne `Organization` / `WebSite`** na 12 homepage. Google (merchant listing doc,
  2026-09-08) odporúča dopravu aj vrátenie uviesť **raz na úrovni Organization**
  (`hasShippingService`, `hasMerchantReturnPolicy`), nie na každej ponuke.
- **Placeholder GIF ako obrázok produktu:** 108 zo 414 ne-nosičových SK produktov, 80 má
  iba ten (zoznam: `data/placeholder-images-sk-20260922.tsv`). Ide aj do JSON-LD a
  `og:image`. Storefront ho filtruje (`feat/seo-base-v1`), dáta opraví CFM.
- **Interné vyhľadávanie indexovateľné**, titulok „Search products“ na všetkých trhoch.
- **Robots meta sa nevypisuje nikde** — `(main)/layout.tsx:60` nastavuje `robots:
undefined`, čo v Next metadata merge prepíše koreňové `max-image-preview:large`.
- **Titulky kategórií** „Autochladničky \| Autochladničky“, popis = názov (22/22).
- **`brand` chýba** všetkým 9 157 nosičom Nordrive (CFM: `cfm:attribute:manufacturer`).
- SK titulky PDP bez značky (15/24 vzoriek) — šablóna v CFM.
- Pre bežný prehliadač sú v SK PDP `<title>`/canonical v `<body>` (streaming metadata;
  Googlebot ich má v `<head>`). Týka sa AI crawlerov a Seznamu; riešenie
  `htmlLimitedBots` v `next.config.js` = §10.
- Strana 2+ výpisu má canonical na stranu 1 (kurzorové URL) — §10 (dotaz).
- `llms.txt` tvrdil, že predávame len na Slovensku — opravené `ceb8b3b`.

## 3. Rýchlosť

Lighthouse 13.4.1, mobil (Lantern), medián z 5 behov: homepage 81 (57–58, keď skolabuje
skeleton, CLS 0,81), kategória 81, PDP 79–80; desktop 96–99. TBT 339 → ~65 ms od júla,
simulované LCP 3,7 → 5,4 s.

- **Crypto polyfill v klientovi:** chunk 430 KB (~126 KB na drôte, `secp256k1`, `pbkdf2`),
  lebo dve `"use client"` komponenty brali konštantu z `garage/cookie` → `signature` →
  `crypto`. Pribudol 5.–8. 9. Opravené `927f184`; `signature.ts` je `server-only`.
- **Večerný Saleor si robíme sami (hypotéza, nie dôkaz):** PDP = 11 súbežných ťažkých
  dotazov na hreflang (`product-counterparts.ts:38`, 22 pri produkte len v SK) + `CurrentUser`
  bez cache pri akejkoľvek cookie; Next 16 in-memory „use cache“ **zmaže záznam po 60 s**
  bez stale-while-revalidate (`cache-handlers/default.js:49`). ClaudeBot 22. 9. = 61 %
  requestov (~150–180 PDP/min). V tichej minúte Saleor 73–92 ms/dotaz, večer 0,26–0,33 s.
  **Test:** `Crawl-delay` pre ClaudeBota (`ceb8b3b`) + CPU Saleoru cez SSM + nové meranie.
  Pozor: crawleri si `robots.txt` cachujú, efekt môže prísť až o hodiny.
- `/_next/image?w=3840`: ~31,6 tis. požiadaviek 22. 9., z toho ~28,5 tis. Amazonbot +
  ClaudeBot. `deviceSizes` bez 3840 = §10 (deployment config).
- Prefetch: zoznam značiek na PLP ~300 requestov na zobrazenie — vypnuté `b4a22d4`.
- Hero kategórie = LCP, bol surový `<img>` s nízkou prioritou — `next/image` +
  `fetchPriority="high"` v `b4a22d4`.
- Cez Cloudflare ide `/_next/static` pre Chrome ako gzip, nie brotli (~−18 % JS by ušetrilo).
- Thule PDP nie je pomalé samo o sebe (teplé 0,023 s); pomalé je, keď je studené — 25
  dotazov, lebo produkt je len v `sk-eur` a hreflang sa pýta 11 trhov dvakrát.

## 4. Rozhodnutia vlastníka (22. 9. 2026)

1. Srdiečko **ponechať** — wishlist príde.
2. Newsletter **ponechať** — backend príde.
3. Geist **zapnúť**.
4. Produkty na homepage **zo Saleor kolekcie** (§5).
5. Vrátenie pre Google **14 dní**; doručenie **Slovenská pošta a FedEx**.
6. `robots.txt`: ClaudeBot `Crawl-delay: 10`; Amazonbot `Disallow`; Semrush a Ahrefs
   obmedziť (Crawl-delay), nie zakázať.
7. Ceny na stránkach vozidiel v SK so znakom **€**.
8. **Nový feed** pre Heureku a Pricemaniu (§6).
9. Celkový dizajn frontendu vylepšiť (štýl, rozloženie) — nie radikálne, z aktuálneho
   dizajnu. Návrh smeru ide na schválenie pred plošným nasadením (CLAUDE.md §3).

## 5. Kolekcia pre homepage — zadanie pre Saleor (Marek / CFM)

Kód ju už číta (`[channel]/(main)/page.tsx`, `getFeaturedProducts`), stačí ju vytvoriť:

- slug **`featured-products`**, názov napr. „Odporúčané produkty“;
- publikovaná v **12 kanáloch** (`sk-eur`, `cz-czk`, `de-eur`, `at-eur`, `pl-pln`,
  `hu-huf`, `it-eur`, `fr-eur`, `es-eur`, `ro-ron`, `us-usd`, `ca-cad`);
- **preklad pre 11 jazykov so všetkými štyrmi poliami** — `name`, `description`,
  `seoTitle`, `seoDescription`. Bez nich ju exact-locale na cudzom trhu zahodí
  (`exact-locale.ts:223-239`) a sekcia sa tam skryje;
- 8–12 produktov v poradí, v akom sa majú zobraziť (zoradenie `COLLECTION`, max 12);
- produkty dostupné na všetkých trhoch, kde ich chceme ukázať — Thule je dnes len v
  `sk-eur`, takže na ostatných trhoch z kolekcie vypadne; vozidlovo-špecifické zostavy
  Nordrive na homepage nemajú zmysel bez vybraného auta.

## 6. Feed pre Heureku a Pricemaniu — zadanie pre CFM

Obe služby **stále sťahujú starý WooCommerce feed** (`Heurekabot-Feed/1.0`,
`FeederPricemania`): `/wp-content/uploads/woo-feed/heureka.sk/xml/feed-pre-heurekusk.xml`
→ 404 (17× 22. 9., 122× v starších logoch). Návrh:

- CFM generuje **Heureka XML** (Pricemania ho prijíma) pre `sk-eur` ako statický súbor na
  `cdn.maky.store` (S3/CloudFront) — nie cez Next: odpoveď nad 2 MB Next necachuje;
- cena s DPH, URL = živé PDP, obrázok = skutočný obrázok (nie placeholder §2), dodacia
  lehota, bez tvrdení o doprave zadarmo;
- novú URL feedu zapísať v administrácii Heureky aj Pricemanie; storefront navyše
  presmeruje starú adresu 301 na nový súbor (zmena presmerovaní = produkčná zmena, pôjde
  s GO). Či roboty presmerovanie nasledujú, **nie je overené** — ukáže to nginx log.

## 7. Mimo storefrontu

| Úloha                                                                            | Kto         |
| -------------------------------------------------------------------------------- | ----------- |
| Odstrániť placeholder médiá (108 produktov, zoznam v `data/`) a doplniť skutočné | CFM         |
| `brand` pre 9 157 Nordrive; značka v SK titulkoch PDP; popisy kategórií          | CFM         |
| Kolekcia `featured-products` (§5)                                                | Marek / CFM |
| Doprava a vrátenie v Search Console (má prednosť pred markupom, bez deployu)     | Marek       |
| CPU Saleoru cez SSM počas crawlu (test hypotézy §3)                              | Marek       |
| Heureka/Pricemania feed (§6)                                                     | CFM         |

## 8. Pasce z tohto auditu

- **`grep` na font nestačí.** Skontrolovať treba vykreslený font:
  `CSS.getPlatformFontsForNode` cez CDP. `isCustomFont:false` = web font sa nepoužil.
- **`hidden lg:flex` v komponente, ktorý sa renderuje aj v mobilnom kontexte**, prejde
  každým testom aj buildom. Pomohol len pohľad do otvoreného menu pri 360 px.
- **`export { X } from "./y"` nevytvorí lokálnu väzbu** — keď ju modul používa aj sám,
  treba import + export.
- `/sk/search?q=` vracia „Stránka nenájdená“ — parameter je `query`. Nehlásiť ako chybu.
- Počty botov: `grep -o | sort | uniq -c` počíta výskyty, nie riadky (UA ClaudeBota
  obsahuje „claudebot“ dvakrát). Počítať po riadkoch (`awk` s jedným zaradením na riadok).
- `next/image` v Next 16.2: `priority` neznamená `fetchPriority="high"` a `loading="eager"`
  tiež generuje preload (pozri `plp/product-grid.tsx`).
