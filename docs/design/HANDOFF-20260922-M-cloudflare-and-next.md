# HANDOFF — storefront M, 22. 9. 2026

Vlákno, ktoré nasadilo Cloudflare pred `maky.store` a odstránilo dve brzdy, o ktorých
nikto nevedel. Tento dokument je samostatný: nové vlákno nepotrebuje čítať nič pred ním.

---

## 1. Kde je produkcia

```
artefakt      5e43c45   BUILD_ID _HrnFALLdjn9mDMRr48zm    nasadené 22. 9. 15:09 UTC
živý strom    cf8790b   (o commit ďalej — je to len kontrolný skript mimo buildu)
vetva         claude/m-worktree-cfm-checkpoint-eba859, pushnutá
testy         2 363 zelených, lint 0 chýb
```

Rozdiel medzi artefaktom a stromom je zámerný: `cf8790b` opravuje
`scripts/checks/market-language.mjs`, ktorý beží z cronu a nie je súčasťou buildu.

**Pred `maky.store` je odteraz Cloudflare a origin je zamknutý.**

```
maky.store, www, smtp-app      Proxied
cdn.maky.store                 DNS only → CloudFront → S3 eu-central-1   (NEPROXOVAŤ)
api.maky.store, stripe-app     DNS only
cms.maky.store                 Proxied (bolo tak už predtým)

security groups na i-055e78d2d862175ed:
  sg-07ae5c5cd44582cdc  maky-nextjs               len SSH
  sg-0dfa38d57bf379eb3  maky-web-cloudflare       80/443 z prefix listu pl-05d7b2ae56b2f21e8
  sg-0476ff6b75cd51e67  maky-web-service-callers  443 z 3.77.6.21/32 (Saleor → smtp-app)
  sg-0696cee5dd06eea76  maky-web-public           ODPOJENÁ — pripojiť späť = návrat
```

Priamy prístup na `63.181.129.103` vracia `000` na 80 aj 443.

---

## 2. Čo sa v tomto vlákne zmenilo

### 2.1 Saleor fronta — najväčší nález

`src/lib/graphql.ts` držal **každý** Saleor dotaz minimálne 200 ms
(`await Promise.all([fn(), sleep(200)])`) a púšťal naraz tri. Saleor je náš vlastný
stroj a ráno odpovedal za 35 ms.

```
statická routa (/robots.txt)     1 ms wall,  1 ms CPU
dynamická routa                207 ms wall, 35 ms CPU   →  172 ms server NIČ NEROBIL
súbežnosť                      presne ceil(N/3) × 200 ms
```

Opravené najprv v `.env`, potom natrvalo v kóde (default `12 / 0`, commit `49784bd`).

```
/sk                   204 ms → 22 ms
sitemap shard         202 ms → 3 ms
24 súbežných          1,99 s → 0,26 s
studená PDP p50       0,73 s → 0,35 s
```

Spätne to vysvetľuje aj ranný nález z predchádzajúceho vlákna: 11 sekvenčných hreflang
lookupov × 200 ms = 2,2 s, čo bol skoro celý vtedajší 2,69 s studený render.

⚠️ **Boot log to odteraz hlási:** `[saleor-queue] max_concurrent=12 min_delay_ms=0`.
Ak tam niekedy bude `min_delay_ms>0`, vypíše sa aj varovanie s vypočítaným stropom.

### 2.2 Deploy, ktorý povie, čo zlyhalo

`exit 75` hovoril „see above". `check_market_state` počítal `[market-state]` riadky
v posuvnom okne `pm2 logs --lines 1000` pred a po štarte a žiadal rast počtu — lenže
okno uteká od staršieho riadku zhruba takou rýchlosťou, akou ho gate zapĺňa `[cms]`
riadkami, takže počet vyšiel rovnaký a brána hlásila „no NEW line" na úplne zdravom
deployi. Teraz sa číta bajtový offset do PM2 logu odobratý tesne pred `pm2 start`
(commit `90d784d`), a posledný riadok behu vypíše `POST_DEPLOY_FAILED:` s menami.

**Fungovalo to hneď v ten istý deň** — ďalší deploy skončil 75 a na poslednom riadku
bolo `- market language` aj so stack traceom.

### 2.3 Tabuľky, ktoré sa indexujú hodnotou z requestu

`CHANNEL_MAP["__proto__"]` vracalo `Object.prototype` (truthy). Nič nebolo zneužiteľné,
lebo každý volajúci mal za vyhľadaním druhú kontrolu — ale bola to náhoda hlboká na
jeden refaktor. Päť tabuliek má teraz `null` prototyp (`src/lib/request-keyed.ts`,
commit `5e43c45`), 36 asercií, po vrátení zmeny ich padne 30.

### 2.4 Cloudflare

Nastavené v tomto vlákne, netreba znovu:

```
SSL Full (strict)                  HSTS 12 mesiacov (Cloudflare prepisuje nginx)
Email Obfuscation OFF              Automatic HTTPS Rewrites OFF
Always Online OFF                  Browser Cache TTL: Respect Existing Headers
Bot Fight Mode OFF                 AI Labyrinth OFF
AI bot policies: Search/Agent/Training všetko Allow      ← NEMENIŤ, blokovanie Training
Bot Preference Sync OFF                                     zablokuje aj Googlebot
custom rule "skip checks for our own callers":
  hostnames maky.store/www/smtp-app AND (ip.src 3.125.67.156, 3.77.6.21 OR /api/revalidate)
  Skip: custom rules, rate limiting, managed rules, Browser Integrity Check
```

nginx dostal `set_real_ip_from` pre 22 rozsahov Cloudflare a log formát `cf`:

```
$remote_addr via=$realip_remote_addr … cf_ray=… cf_country=…
```

`via=` je odteraz odpoveď na otázku „obchádza niekto Cloudflare".
`scripts/ops/cloudflare-ranges.sh` hlási drift rozsahov (commit `d7595cf`).

### 2.5 Upratané

- `staging.maky.store` zmazaný. Bol **mŕtvy** — nginx ho proxyoval na port 3037, kde nič
  nebežalo; tých 401 bola basic auth odpovedajúca skôr, než sa vôbec skúsil upstream.
  Archív: `/opt/storefront-artifacts/staging-removed-20260922T143441Z`.
- `smtp-app.maky.store` dostal `X-Robots-Tag: noindex, nofollow, noarchive` a vlastný
  `robots.txt` (servuje nginx, nie appka).
- Certifikát `smtp-app` prepnutý z `authenticator = nginx` (HTTP-01) na `dns-cloudflare`.
  **Bez toho by po zámku prestal obnovovať** a zistili by sme to o 85 dní.
  `maky.store` používal DNS-01 už predtým. Obidva overené `--dry-run` v zamknutom stave.

---

## 3. Pasce, ktoré stáli čas — nešliapnuť na ne znova

**Meranie**

- ⚠️ **TTFB je pri PPR nezmyselná metrika.** Meria len flush predrenderovaného shellu.
  „Teplá stránka 2,8 ms" bola nepravda; návštevník čakal 204 ms. Merať `time_total`.
- ⚠️ Konštantných ~200 ms na každej dynamickej route a krivka súbežnosti
  `ceil(N/3) × 200 ms` je podpis vlastnej fronty, nie siete. Statická routa
  (`/robots.txt`) zostane na 1 ms — to je to A/B, ktoré to izoluje.
- ⚠️ `grep … | wc -l` na jednoriadkovom HTML vráti 1 bez ohľadu na počet zhôd.
  Dvakrát to v tomto vlákne vyzeralo ako regresia. Použiť `grep -o … | wc -l`.
- ⚠️ `curl -I` posiela HEAD. `/api/manifest` vracia na HEAD 405 a na GET 200 — nie je to
  chyba.

**Cloudflare**

- ⚠️ **Browser Integrity Check blokuje `Python-urllib/3.12`** (Cloudflare error 1010).
  To je user-agent CFM readbacku. `curl`, `python-requests` ani `Saleor/3.23` blokované
  nie sú. Skip pravidlo kryje CFM cez IP, ale **koncovo to overené nie je** a zlyhalo by
  ticho. Odporúčanie: BIC vypnúť.
- ⚠️ Blokovanie kategórie **Training** v AI bot policies zablokuje aj Googlebot
  (zmena Cloudflare z 15. 9.). Politika botov patrí do `robots.txt`, nie sem.
- ⚠️ `Bot Preference Sync` by predradil pred náš `robots.txt` nastavenia z Cloudflare.
  Musí zostať OFF.
- ⚠️ `/_next/image` sa na hrane **necachuje**, lebo cesta nemá príponu. To je dnes
  správne a bezpečné: odpoveď nesie `vary: Accept` a Cloudflare `Vary` mimo
  `Accept-Encoding` nerešpektuje, takže zapnutie cache bez dôkazu by mohlo poslať AVIF
  prehliadaču, ktorý ho nevie.
- ⚠️ Cloudflare Free utne odpoveď nad 100 s (chyba 524). Dnes je najpomalšia vec
  `/sitemaps/fr-products-1.xml` — 11,7 s studená, 0,5 s teplá. Rezerva je veľká, ale
  každá nová dlhá operácia to musí rešpektovať.

**Ostatné**

- ⚠️ `scripts/checks/market-language.mjs` číta tabuľky trhov **zo zdrojáku**. Je to
  zámer (prvá verzia mala vlastnú kópiu a španielsky košík v nej bol `cesta` namiesto
  `carrito`), ale znamená to, že zmena tvaru tých tabuliek ju rozbije. Presne to sa
  stalo pri `requestKeyed({...})`.
- ⚠️ Next ticho necachuje odpoveď nad 2 MB. Kúslo to už dvakrát (fitment, sitemap).
- ⚠️ Deploy stojí ~240 s odstávky a **po Cloudflare ju zákazník vidí ako chybovú
  stránku Cloudflare**, nie ako pomalé načítanie.

---

## 4. Otvorené, v poradí naliehavosti

### 4.1 Saleor spomalil 2–4× — NEVYRIEŠENÉ

Rovnaký test, rovnaké dotazy, ten istý deň:

```
                  ráno      večer
 1 súbežný       0,053 s   0,207 s
 6 súbežných     0,087 s   0,223 s
12 súbežných     0,167 s   0,456 s
24 súbežných     0,319 s   0,603 s
```

Pomalší **aj pri jednom dotaze**, takže to nie je našou súbežnosťou. Prejaví sa to
priamo: `/sk/kontakt` má p50 0,19 s namiesto ranných 0,022 s, pri load 0,38 a statickej
route za 0,8 ms. Vylúčené: naša fronta (boot log 12/0), objem prevádzky (klesol z 619
na ~60 req/min), CMS a CFM (obidva 25 ms).

**Saleor beží na vlastnom stroji `i-0fdca7b9034106a6e` (3.77.6.21), do ktorého toto
vlákno nesiahalo.** Je v SSM online. Toto je dnes najväčší jednotlivý príspevok
k času, ktorý zákazník čaká.

### 4.2 Nulový výpadok pri deployi

240 s chybovej stránky Cloudflare pri každom deployi. Návrh (build bokom → nový port →
health gate → atomický prepnutie nginx upstreamu → vypnúť starý) je pripravený, ale
**neschválený a netestovaný**. `.next/required-server-files.json` obsahuje absolútnu
cestu — to treba dokázať mimo produkcie (CLAUDE.md §13.8).

### 4.3 Menšie, ale hotové na spracovanie

- Postmark: e-mail padá v Gmaile do „Reklamy" kvôli sledovaniu otvorení a
  `track.pstmrk.it` v odkaze na reset hesla. **Appka žiadne `X-PM-Track*` hlavičky
  neposiela** (overené), takže nastavenie streamu v Postmarku zaberie.
- Logo v e-maile je Saleorovo predvolené z jeho S3 bucketu
  (`maky-store-static-936049945896.s3.amazonaws.com/images/saleor-logo-sign.png`) a
  nenačíta sa. Ide zo Saleoru v poli `logo_url`. Riešenie: PNG na `cdn.maky.store`
  a v šablónach smtp-app pevná URL.
- SES záznamy sú na zdvojenom mene `mail.maky.store.maky.store`; `mail.maky.store`
  nemá MX ani TXT a SES DKIM v zóne nie je. Podľa nastavenia „behavior on MX failure"
  to znamená buď zlyhaný DMARC, alebo že SES **neodošle vôbec**.
- Staré `_acme-challenge.maky.store` a `_acme-challenge.old.maky.store` v DNS.
- `robots.txt` pre tréningové a SEO boty (ClaudeBot 38 182 req/deň, Semrush 3 194,
  Ahrefs 1 178, oproti Googlebot 114).
- `images.deviceSizes` bez 3840 — 45 súbežných `w=3840` optimalizácií vyrobilo 22. 9.
  o 04:52 jedenásť chýb 502, bez pádu a bez OOM.
- Po týždni: odobrať výnimku pre Saleor, zmazať `maky-web-public`, SSH na SSM.

### 4.4 Vedome odložené

Fázy B–D pôvodného plánu: statická hlavička, odstránenie `Set-Cookie: maky-market`
z verejných odpovedí, HTML na hrane. Inventúra dynamických zdrojov je hotová:

```
header-nav-row.tsx:23           connection()  →  runtime liveMarkets()
active-vehicle-launcher.tsx:39  connection()  →  garage cookie   (2× v hlavičke)
user-menu-container.tsx:12      cookies()     →  a Saleor dotaz pri KAŽDOM zobrazení
cart-nav-item.tsx:6             cookies()
cart-drawer-wrapper.tsx:10      cookies()     →  celý obsah košíka na každej stránke
proxy.ts                        Set-Cookie: maky-market na KAŽDEJ verejnej odpovedi
```

⚠️ Rozhodnutie vlastníka už padlo: **statická hlavička áno**, pridanie trhu smie
odvtedy vyžadovať deploy. Nesmie však vzniknúť split-brain medzi hlavičkou, proxy,
sitemapou a hreflangom.

**Po oprave fronty je ale hlavný argument pre fázu B iný, než bol.** Teplá stránka
je 22 ms, takže CDN pre HTML už európskemu zákazníkovi veľa nepridá. Fáza B zostáva
správna kvôli cachovateľnosti a kvôli tomu, že zmizne trieda chýb so stavom
návštevníka — nie kvôli rýchlosti.

---

## 5. Zadanie pre nové vlákno

Tri okruhy. **Rýchlosť a SEO sú meranie a audit, homepage je tvorba.**

### 5.1 Rýchlosť

1. Zistiť, prečo Saleor spomalil (4.1). Bez toho je každé ďalšie meranie storefrontu
   meraním Saleoru.
2. Až potom prehodnotiť poradie fáz B–D.

Merať `time_total`, nie TTFB. Studené aj teplé, aspoň 10 vzoriek, SK + DE + US.

### 5.2 SEO audit

Zmerané 22. 9. ako východisko:

```
sitemap            128 128 URL, index 0,63 s, najväčší shard 11,7 s studený
hreflang           13 alternates vrátane x-default, na PDP aj homepage
route gate         ON, 12 trhov, falošný slug = skutočná 404
PDP JSON-LD        Product, Offer, Organization, BreadcrumbList
homepage JSON-LD   ŽIADNE                                    ← diera
og:image           všade generický /opengraph-image.png       ← diera
Search Console     /us aj US PDP indexovateľné, „nekritické upozornenia"
```

Otvorené otázky pre audit:

- **Homepage nemá žiadne JSON-LD.** Chýba `Organization` a `WebSite` (sitelinks
  search box). PDP ho má.
- **`og:image` je na všetkých stránkach ten istý generický obrázok.** PDP by mal
  zdieľať obrázok produktu.
- Search Console hlási pri produkte a zázname obchodníka nekritické upozornenia —
  typicky chýbajúce `shippingDetails` a `hasMerchantReturnPolicy`. Údaje máme
  (dodacie lehoty EÚ 5–10 / US-CA 7–14, 30 dní na vrátenie), len nie sú
  v štruktúrovaných dátach.
- Overiť canonical, `<html lang>`, robots meta a interné prelinkovanie na všetkých
  12 trhoch, nie len na SK.
- `robots.txt` — dnes jedna skupina `*`. Pravidlá pre botov sa rozhodli riešiť tu,
  nie v Cloudflare. ⚠️ Skupina pre konkrétneho bota musí zopakovať všetky `Disallow`
  zo skupiny `*`, inak ich stratí. `Crawl-delay` nikdy do `*` (rešpektuje ho Bing).

### 5.3 Homepage — hlavná práca

**Koreň problému je nájdený a je to jedna veta:**

```
kolekcií v kanáli sk-eur:  0
```

`getFeaturedProducts()` pýta kolekciu so slugom `featured-products`. Tá v Saleore
**nikdy neexistovala**, takže sekcia vráti `null` a skryje sa. Výsledok:

```
/sk   0 produktových kariet
/de   0 produktových kariet
/us   0 produktových kariet
```

Homepage teda dnes nezobrazuje **ani jeden produkt na žiadnom z 12 trhov**, hoci
katalóg má 9 157 produktov × 11 kanálov. Odtiaľ ten „chudobný" dojem.

Dnešná štruktúra (`src/app/[channel]/(main)/page.tsx`):

```
HeroSection        + ActiveVehicleLauncher
CategoryGrid
FeaturedProducts   ← vždy prázdne, sekcia sa skryje
WhyMaky
BrandsStrip
NewsletterCTA
```

Čo nové vlákno má vyriešiť:

1. **Odkiaľ berie homepage produkty.** Kolekcia v Saleore je jedna možnosť, ale
   vyžaduje ručnú správu na 12 kanáloch. Alternatívy: najnovšie z kategórie,
   bestsellery, produkty podľa uloženého vozidla. Rozhodnutie patrí vlastníkovi —
   predložiť možnosti s tým, čo každá stojí na údržbe.
2. **Nové sekcie a bannery.** Rozsah je otvorený a je to hlavná tvorivá časť.
3. **Kompletné prepracovanie vzhľadu.**

⚠️ Záväzné pravidlá z CLAUDE.md, ktoré homepage viažu:

- §6: **žiadne tvrdenia o doprave zadarmo**, nikdy. Žiadne prázdne sekcie
  s anglickými zástupnými textami. Hero hovorí o prínose pre zákazníka, nie
  o interných číslach („13 trhov / 4 dodávatelia" je zakázané).
- §6: na homepage smú byť len značky Thule, Nordrive, Menabo, Yakima, Peruzzo,
  Pro-USER, Spinder, Green Valley, SnowDrive, DAC. **Cruz, HAK-SYSTEM, GALIA, ORIS
  a JAEGER nie** bez výslovného schválenia.
- §1: rozsah je Auto-Moto. Pracovné odevy, obuv, náradie ani marketplace kategórie
  sa neuvádzajú.
- §4.2: shadcn slovník (`bg-primary`, `text-muted-foreground`, …) je
  **nedefinovaný** — Tailwind v4 pre neznámy `--color-*` neemituje nič, takže
  utilita prejde buildom a nič nevykreslí. `next build` token neoveruje.
  **Vizuálne skontrolovať, že dotknuté komponenty naozaj maľujú.**
- §4: jedna primárna akcia na stránku, nákupné CTA nikdy hnedé.
- §11: i18n parita — všetkých 12 súborov správ musí zostať identických
  (missing 0 / extra 0). next-intl nie je typovo augmentovaný, chýbajúci kľúč
  padne ticho až za behu.
- §10: bez schválenia nemeniť Saleor integráciu, GraphQL štruktúru, checkout, košík,
  CFM, kanály/i18n, prostredie ani deployment.
- §13: deploy len cez `./scripts/ops/deploy-production.sh`, nikdy ručne. Produkčné
  príkazy sa píšu priamo, nie cez `bash script`, `setsid` ani `nohup` (§13.1.1).

### 5.4 Ako pracovať

- Produkčné zmeny (deploy, `.env`, revalidácia, redirect mapa, PM2, Cloudflare)
  pripraviť, nahlásiť a spustiť **až po výslovnom GO vlastníka**. Read-only kroky
  a testy bez pýtania.
- **Existenciu PDP nikdy nedokazovať len cez HTTP 200** — soft-404 vracala 200.
  Overiť identitu produktu alebo JSON-LD.
- Nespúšťať všeobecný audit. Ak sa realita líši od tohto dokumentu, najprv to nahlásiť.
- Kontrolu, ktorá nikdy nespadla, falzifikovať, než sa jej uverí.
