# Vlákno A — pokračovanie 01 (2026-09-05)

**Nadväzuje na `A3-SKU-GALERIA-KOSIK-SEO.md` a na dodatok
`handoff-20260905-vlakno-a3-dodatok.md`. Kde si odporujú, platí tento dokument —
je napísaný z overeného buildu, nie z čítania kódu.**

|            |                                                                  |
| ---------- | ---------------------------------------------------------------- |
| Východisko | `claude/sf-a-catalog-l10n-seo @ 2dcec16`                         |
| Výsledok   | 10 commitov, branch-only                                         |
| Produkcia  | `feat/cms-m2 @ e353c70`, artefakt `bdcc925` — **nedotknutá**     |
| Testy      | 1142 → **1175** (75 súborov), tsc 0, lint 0 errors, i18n gate OK |
| Build      | **zelený** vo worktree, overený cez `next start` na porte 3111   |

`PRODUCTION_DEPLOYED=NO` · `CATALOG_WRITES=NO` · `SALEOR_WRITES=NO`

---

## 1. Čo je hotové

### P0 — košík (dve chyby, nie jedna)

`reconcile()` po strate odpovede prečítal košík **raz** a pri nezmenenom množstve
odpovedal `rejected` — „nič sa nepridalo". Po timeoute môže pôvodná mutácia stále
dobiehať, `checkoutLinesAdd` nie je idempotentné (1 → 2 → 3), takže tá veta pozývala
zákazníka kliknúť druhýkrát. Teraz je čítanie **ohraničene opakované** a funkcia
`rejected` vrátiť **nevie** — ostáva pre doložené odmietnutie Saleoru a pre zlyhanie
pred odoslaním.

Dve veci navyše, ktoré dodatok nemenoval a našlo sa až čítaním transportu:

- **Strop musel byť hodinový, nie počet pokusov.** Read-back je _query_, takže si
  ponecháva retry budget transportu — až ~7 s v jednom čítaní, plus procesová fronta
  s 200 ms podlahou. Tri pokusy by bežali cez dvadsať sekúnd.
- **`decodeURIComponent(variantId)` bežal na dvoch nesprávnych miestach.** `variantId`
  chodí zo skrytého inputu; pri poškodenom escape hodí `URIError`. Raz to spadlo do
  „nepodarilo sa vytvoriť checkout", raz priamo do `reconcile` — teda požiadavka, ktorá
  nikdy nevznikla, sa hlásila ako možno letiaca.

### Revalidácia košíka — nikdy nefungovala

`revalidatePath("/cart")` v štyroch akciách nezodpovedá žiadnej reálnej route: košík je
`/sk/cart`, čo proxy prepisuje na `/sk-eur/cart`. Pridanie, odobranie aj zmena množstva
nechávali stránku košíka aj odznak v hlavičke na cache.

Je to druhá polovica P0: `unconfirmed` hovorí „skontrolujte košík" — a tá stránka
odpovedala z cache.

### Košík bol nedosiahnuteľný

Ikona v hlavičke otvára drawer, drawer ponúkal iba pokladňu a `/products`. Do
`/{market}/cart` neviedol odkaz odnikiaľ. Pribudol **„Zobraziť celý košík"**;
„Pokračovať v nákupe" už iba zatvorí drawer namiesto odchodu na `/products`.

### SKU — zákazníkovi sa ukazoval interný identifikátor

PDP aj karta v listingu tlačili `variant.sku` pod popiskom „SKU:", teda aj
`CFMP-B-NOR-57acce…`. Karta ho navyše **`.toUpperCase()`-ovala**, čo mení 34 zo 417
reálnych kódov na reťazce, ktoré dodávateľ nepoužíva (`g3K9042` → `G3K9042`).

`publicProductCode` berie kód z **deklarovaného** zdroja `variant.name` a zo SKU nikdy.
Skratku „odrež suffix" som zámerne neurobil, a meranie ukazuje prečo je taká lákavá:
naprieč celým verejným katalógom je `name` prefixom `sku` na **417/417** variantoch a
bajtovo zhodné na **414** — chirurgia na reťazci by prešla každým testom a stále by
stála na formáte, ktorý nikto nesľúbil.

Vracia `null` pri čomkoľvek, čo nevyzerá ako kód, a `null` znamená nezobraziť nič.
Podmienka „aspoň jedna číslica" je tá, ktorá bude dôležitá neskôr: `Black` a `XL`
prejdú znakovou sadou, a klietky a poťahy takéto názvy variantov prinesú.

**Košík, drawer a objednávky cez helper zámerne NEIDÚ.** Tie zobrazujú `variant.name`
ako _označenie variantu_, čo je pre ne správne — pri farebnom variante je „Black"
odpoveď. Nikdy neunikali; unikali len tie dva popisky „SKU:".

### JSON-LD — `mpn`

Každé PDP posielalo `mpn` z tej istej hodnoty ako `sku`. `sku` je identifikátor
predajcu a smie byť čokoľvek; `mpn` je tvrdenie o **výrobnom čísle dielu výrobcu** a
tým to nie je v žiadnom čítaní — aj krátky prefix je štyri komponentové kódy Nordrive
spojené dokopy. Odstránené, `sku` ostáva.

### Obrázky

- **AVIF sa servíruje.** Overené na skutočnom builde, nie z dokumentácie:

  | `Accept`    | dostane      | bajtov |
  | ----------- | ------------ | ------ |
  | `avif,webp` | `image/avif` | 10 613 |
  | `webp`      | `image/webp` | 15 738 |
  | `image/*`   | `image/jpeg` | 27 511 |

  **−32,6 %** oproti WebP. **Staré prehliadače dostanú JPEG samé od seba** — netreba
  pre ne nič nastavovať, a PNG sa nastaviť ani nedá.

  Pozor na pascu, do ktorej som spadol prvý: pri rovnakej nominálnej kvalite je AVIF
  o 12 % **väčší**. Next kóduje AVIF na `quality − 20`, a až to z toho robí zisk —
  preto `qualities` ostáva na defaultnom `[75]`.

- **Galéria si pýtala menší obrázok, než išla vykresliť.** `sizes` sa lámalo na 768 px,
  ale mriežka PDP prechádza na dva stĺpce až na 1024 px. Medzi 769 a 1023 px galéria
  kreslila ~852 CSS px a žiadala ~450. To je **under-fetch**, teda viditeľne mäkký
  obrázok — a je to tá polovica hlásenia „fotky vyzerajú mäkko", ktorú frontend vie
  opraviť. Stĺpec je 596 px, nie 640: mriežka je 1.1fr : 1fr.

- **Lightbox nezväčšoval nad zdroj.** To tvrdenie v podkladoch neplatí — Next posiela
  `withoutEnlargement`, takže w=1080 aj w=3840 vracajú tie isté 1000×1000 bajty. Stálo
  to samostatnú cache entry a samostatné kódovanie na kandidáta, nie prenos.

- `aspect-[4/3]` som **nechal**. Nestojí bajty; je to dizajnové rozhodnutie.

### i18n

`checkout.summary.vatIncluded` pristál iba v en-US a sk-SK — desať trhov videlo pod
lokalizovaným zhrnutím anglickú vetu. Doplnené štandardnou fakturačnou formuláciou
(`z toho DPH`, `davon MwSt.`, `dont TVA`, `ebből áfa`, `di cui IVA`, `w tym VAT`,
`din care TVA`, `IVA incluido`).

**Premisa v podkladoch je nepresná:** chýbajúci kľúč **nezlyháva ticho na key-path**.
`src/i18n/request.ts` robí hĺbkový merge en-US pod každý locale, takže sa vykreslí
angličtina — a kontrola parity číta _súbory_, aby medzera zostala viditeľná. Je to
zámer, nie chyba.

### hreflang

Hodnota sa brala z `htmlLang`, ktorý je holý jazyk pre všetkých 12 trhov, so
zoznamom troch výnimiek. Nemecko tak dostávalo generické `de`, Rakúsko `de-AT` — dva
samostatné obchody na dvoch kanáloch anotované asymetricky. Teraz `CHANNEL_MAP[market].locale`.
**Latentné:** pri `MAKY_LIVE_MARKETS=sk` sa hreflang neemituje vôbec.

---

## 2. Čo som zámerne NEUROBIL

- **Sitemap index — netreba ho, a rozbil by deploy.** Sitemap má dnes 444 URL v jednom
  plochom súbore, teda **osminu** limitu 50 000. Navyše: `generateSitemaps()` v Next
  16.2.9 presunie sitemapy na `/sitemap/<id>.xml`, root `/sitemap.xml` sa stratí aj
  z generovaných `METADATA_ROUTE_PATHS`, a deploy gate počíta `{ns}loc` — čo by po
  zmene rátalo `<sitemap><loc>` proti prahu `MIN_SITEMAP_URLS=400` a spôsobilo `die`
  v `gate_routing`, teda **zlyhaný deploy s rollbackom**. Zisk nula, riziko výpadok.

- **Zdieľaný komponent položky košíka + množstvo na `/sk/cart`.** Je to nová
  funkcionalita, nie oprava, a nesie viditeľné zmeny na oboch plochách: drawer a
  stránka si dnes **odporujú vo faktoch** (drawer ukazuje preškrtnutú cenu, stránka
  kategóriu). Navyše by sa prvýkrát zobrazili atribúty variantu — blok, ktorý nikdy
  nebežal, lebo query aliasuje `selectionAttributes`, nie `attributes`. Bez prehliadača
  to nemám ako odklikať.

- **en-CA (212 chýbajúcich kľúčov).** Je to stav zdedený z produkcie a `request.ts`
  dokumentuje prečo sa necháva viditeľný: angličtina skopírovaná do katalógu je falošný
  preklad, ktorý skryje nezrevidovaný locale. `cart.viewCart` som tam pridal — v
  anglickom locale je „View cart" skutočný preklad, nie výplň.

---

## 3. Otvorené, s presnou otázkou

1. **`next.config.js` je podľa CLAUDE.md §10 deployment configuration.** AVIF si
   výslovne žiadal, takže to beriem ako schválené — ale je to samostatný commit
   (`be2ad38`), aby sa dal revertovať sám.
2. **`cdn.maky.store` neposiela `Cache-Control` vôbec.** Next preto padá na
   `minimumCacheTTL` = 4 h a **každý obrázok sa prekóduje každé 4 hodiny** — pri AVIF
   1,5×–4× drahšie než WebP, na štvorjadre. Otázka na CFM/infra: **je hash v názve
   thumbnailu (`_d366d91e_`) odvodený od obsahu?** Ak áno, TTL sa dá bezpečne zdvihnúť
   a náklad zaplatíme raz. Neodhadoval som to.
3. **Originály nad 1000×1000 a tesnejší orez.** Bez nich je „ostrejšia galéria"
   bezpredmetná — frontend detail nedorobí.
4. **Browser PASS z tohto stroja nevyrobím** (aarch64, Chrome for Testing nemá build).
   Overil som `next build` + `next start` + HTTP; to nie je browser test a nevydávam
   ho zaň.

---

## 4. Prostredie — dve pasce navyše k dodatku

1. **`src/gql/` je gitignorované a generované.** V novom worktree bez neho padne
   17 test súborov. `NEXT_PUBLIC_SALEOR_API_URL=… pnpm generate:all` najprv.
2. **Build potrebuje viac než tú jednu premennú.** Bez `NEXT_PUBLIC_DEFAULT_CHANNEL`
   vráti `generateStaticParams` prázdno a cacheComponents build **zhodí**
   (`EmptyGenerateStaticParamsError` na `/[channel]/cart`) — vyzerá to ako chyba kódu
   a nie je. Funkčná sada:

   ```
   NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/ \
   NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur \
   NEXT_PUBLIC_STOREFRONT_URL=https://maky.store \
   MAKY_LIVE_MARKETS=sk pnpm build
   ```

---

## 5. Stav release

- **`SK_RELEASE_CANDIDATE` — pripravený.** Build zelený, 1175 testov, brány zelené,
  PDP/PLP/cart overené cez `next start`. Chýba prehliadač (bod 3.4).
- **`MULTIMARKET_SEO_READY` — nie.** Chýba lokalizovaný URL reťazec a zdieľaná
  exact-locale projekcia. **Nič z toho neblokuje SK:** pri jednom živom trhu je
  hreflang prázdny a exact-locale inertné.
- **Deploy tejto vetvy je celý release, nie hotfix** — teraz 53 commitov oproti
  bežiacemu artefaktu. Ak je P0 košíka urgentný sám o sebe, úzky hotfix z `bdcc925`
  ostáva legitímnou alternatívou.
