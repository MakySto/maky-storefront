# O1 — Routing inventory (MAKY strana + delta voči upstream v2)

**Dátum:** 6. 7. 2026 · **Vetva:** `feat/legal-content-pages` · **Analyzovaný stav kódu:**
`e3b0aab6fc5a6e2abb3a94bf98dd3e8591b136c5` (HEAD vetvy je o 2 docs-only commity ďalej —
`b3b538b`, `95bec9a`, oba `docs(stripe*)`; kód identický)
**Režim:** čisto analytické, READ-ONLY kód (zápis len docs/design). Metóda: 5 paralelných read-only
analytikov (kroky 1–5) + adversariálna verifikácia nosných tvrdení (45 agentov, ~500 tool-calls);
kľúčové čísla nezávisle re-overené druhým behom grep/read. Live sondy = výhradne HTTP GET na
`127.0.0.1:3000`. Dva verifikačné agenty (krok 5) padli na session limite — obe ich tvrdenia
(product canonical `/sk-eur/*`, e-mail `redirectUrl` z `params.channel`) následne overené manuálne
v kóde: **potvrdené**.

## Exec summary

1. MAKY routing = jeden dynamický segment `[channel]` + `src/proxy.ts` (Next 16 proxy file-konvencia,
   100 riadkov): `/` →307→ `/{market}`, `/sk-eur/*` →301→ `/sk/*` (query sa zachováva), `/sk/*`
   →rewrite→ `/sk-eur/*` (URL ostáva `/sk/…`).
2. `/sk` NIE je len channel — je to **market = (channel + locale + currency + country)** tuple
   z `CHANNEL_MAP` (13 trhov); `[locale]` segment neexistuje (0 výskytov).
3. Locale sa odvodzuje z channel paramu (`getLocaleFromChannel` → `setRequestLocale`, 1 call site);
   `x-locale`/`x-market` hlavičky z proxy sú mŕtve plumbing (0 importerov `locale.server.ts`).
4. Linky sú fakticky centralizované: `LinkWithChannel` (16 súborov) + `marketHref()` (12 súborov);
   hardcoded `"/sk"` = 2, oba JSDoc komentáre; spolu 45 link-generujúcich súborov.
5. Legacy checkout beží MIMO stromu na `/checkout?checkout=<id>` (bez channel/locale v URL);
   channel berie z `checkout.channel.slug`, formátovanie má hardcoded `sk-SK`.
6. Externý povrch má 4 predexistujúce bugy **spoločné pre A aj C**: sitemap so 104/143 mŕtvymi URL,
   product canonical + JSON-LD na `/sk-eur/*` (301 zdroj), 3 e-mail `redirectUrl` na `/sk-eur/*`,
   homepage-canonical na každej stránke.
7. Delta: **A** mení 100 % verejných URL (trvalé 301 mapy pre 3 tvary) + re-root 38 route dirs +
   revízia 45 link súborov; **C** = ~3 súbory tenkej vrstvy (market mapa už existuje =
   `channel-map.ts`) + 0 zmien verejných URL.
8. 8 legal stránok `/sk/*` (referencované zo Stripe aktivácie) a e-mail linky `/sk-eur/*` v obehu
   nesmú prestať fungovať — presný zoznam nižšie.

## 1. `src/proxy.ts` + wiring

**Wiring:** `src/proxy.ts` je jediný request-interceptor — Next **16.1.2** proxy file-konvencia
(premenovaný middleware): exportuje `proxy(request)` + `config.matcher` (`proxy.ts:40, 96-100`).
Žiadny `middleware.ts` neexistuje, `next.config.js` nemá `rewrites()`/`redirects()` (len `headers()`),
žiadny kód proxy neimportuje (1 hit = doc komentár). Build artefakt to potvrdzuje:
`functions-config-manifest.json` registruje `/_middleware` s presne tým matcherom; live overené
(`curl -I /` → 307). Matcher vynecháva `api`, `_next/*`, favicony a všetko s bodkou.

**Semantika `/sk/`:** market = **(locale + channel)** tuple, nie samotný channel.
`CHANNEL_MAP` (`src/lib/channel-map.ts:12-26`) definuje **13 trhov**, každý friendly slug nesie
`{saleorSlug, currency, locale, country}` — napr. `sk → {sk-eur, EUR, sk-SK, SK}`,
`cz → {cz-czk, CZK, cs-CZ, CZ}` … `ca → {ca-cad, CAD, en-CA, CA}`. Locale je teda implicitná
v marketе; `DEFAULT_MARKET="sk"`, cookie `maky-market` (1 rok). Mapu importuje **27 súborov**.

**Tri vetvy proxy:**
- `/` → `detectMarket()` (priorita: cookie → `CF-IPCountry` → `Accept-Language` → `sk`) →
  **307** na `/{market}` + set cookie (`proxy.ts:46-57`; live: `location: /sk`).
- Priamy Saleor slug (`/sk-eur/*`) → **301** na `/sk/*`, path + query zachované (`proxy.ts:60-69`).
- Friendly slug (`/sk/*`) → **rewrite** na `/{saleorSlug}/*` (URL ostáva), nastaví response hlavičky
  `x-channel`/`x-locale`/`x-market`/`x-currency` + cookie (`proxy.ts:73-90`). Hlavičky sú dnes
  **mŕtve** — jediný čitateľ `src/config/locale.server.ts` má 0 importerov.

**`notFound()` pre ne-SK trhy:** v `[channel]/layout.tsx` NIE JE žiadny market gate — ľubovoľný
channel param renderuje (neznámy padá na `DEFAULT_LOCALE`). Live: `/cz`, `/de` → **HTTP 200**
s cs-CZ/de-DE locale. Gate má len **8 SK-obsahových stránok**, každá identicky
`if (REVERSE_MAP[channel] !== "sk") notFound();` (napr. `obchodne-podmienky/page.tsx:14-15`).
Pozor: kvôli `cacheComponents`/PPR sa tento notFound servuje ako **streamovaný 404 boundary
v HTTP 200 odpovedi** (soft-404) — overené sondou na obsah (`/cz/obchodne-podmienky` neobsahuje
adresu prevádzkovateľa, `/sk/obchodne-podmienky` áno).

## 2. Route tree

`src/app`: **38 adresárov (vrátane `src/app` samotného; 37 pod ním), 26 pages, 6 route handlerov,
6 layoutov**. Dynamické segmenty: **6** —
`[channel]` (jediný top-level), `account/orders/[number]`, 4× `[slug]` (categories, collections,
products, pages). **`[locale]` segment: 0.** Všetko storefrontové žije v `src/app/[channel]/(main)/`.

**Legal/content stránky (8)** — súbor → verejná URL (cez proxy rewrite `[channel]=sk-eur`):

| Verejná URL | Súbor |
|---|---|
| `/sk/obchodne-podmienky` | `src/app/[channel]/(main)/obchodne-podmienky/page.tsx` |
| `/sk/reklamacie-a-vratenie` | `src/app/[channel]/(main)/reklamacie-a-vratenie/page.tsx` |
| `/sk/odstupenie-od-zmluvy` | `src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx` |
| `/sk/ochrana-osobnych-udajov` | `src/app/[channel]/(main)/ochrana-osobnych-udajov/page.tsx` |
| `/sk/cookies` | `src/app/[channel]/(main)/cookies/page.tsx` |
| `/sk/doprava-a-platba` | `src/app/[channel]/(main)/doprava-a-platba/page.tsx` |
| `/sk/kontakt` | `src/app/[channel]/(main)/kontakt/page.tsx` |
| `/sk/o-nas` | `src/app/[channel]/(main)/o-nas/page.tsx` |

**Legacy checkout:** MIMO `[channel]` stromu — `src/app/checkout/{layout,page,page-wrapper}.tsx`,
page-wrapper robí client-only (`ssr:false`) dynamic import `src/checkout/root.tsx`. Verejná URL:
**`/checkout?checkout=<checkoutId>`** (potvrdenie: `/checkout?order=<orderId>`), **bez** channel/locale
v URL. Do checkoutu linkujú 2 root-absolute call-sites (`cart/checkout-link.tsx:15`,
`cart-drawer.tsx:317`). Channel sa checkout dozvie až z fetchnutého `checkout.channel.slug`
(order-confirmation fallback `NEXT_PUBLIC_DEFAULT_CHANNEL`); formátovanie/lang = statický `sk-SK`
config. `src/_reference/` obsahuje 25 build-excluded súborov (Adyen/StripeV2/Dummy drop-iny).

**API routes (6):** `api/auth/{reset-password,register,set-password}` (proxy na Saleor auth mutácie
s `redirectUrl`), `api/og`, `api/revalidate`, `api/cache-info`. Matcher proxy ich obchádza —
ekvivalent upstream `RESERVED_ROOT_SEGMENTS` je u nás `checkout` + `api` mimo `[channel]` stromu.

## 3. i18n (next-intl)

- **Request-only mód:** `createNextIntlPlugin("./src/i18n/request.ts")`; routing primitívy
  (`defineRouting`/`createNavigation`/next-intl middleware) = **0 hitov**.
- **Odvodenie locale: z URL channel paramu, nie z hlavičky ani cookie.** Reťaz:
  `[channel]/layout.tsx:59` → `getLocaleFromChannel(channel)` (`config/locale.ts:150-156`,
  Saleor slug → `REVERSE_MAP` → market → `CHANNEL_MAP[].locale`, fallback `sk-SK`) →
  `setRequestLocale(locale)` → `i18n/request.ts` `requestLocale` (whitelist `LOCALE_MAP`,
  fallback `DEFAULT_LOCALE="sk-SK"` + fallback messages).
- **13 message súborov** v `src/i18n/messages/` = 1:1 s 13 trhmi (locale⇄channel plne coupled).
  Žiadny `locales` array — množina je implicitne `Object.keys(LOCALE_MAP)` a duplicitne hardcoded
  v `CHANNEL_MAP.locale` poliach (locale pridaná len do `LOCALE_MAP` sa nepropaguje do
  sitemap/hreflang, tie iterujú `CHANNEL_MAP`).
- **25 súborov** používa `useTranslations`/`getTranslations`; **0** call-sites s explicitným
  `{locale}` — všetko ambient. Legal stránky nemajú i18n vôbec (hardcoded slovenské JSX + SK gate).
- Prepnutie locale = prepnutie marketu: `HeaderMarketControls`/`channel-select` robia regex
  path-surgery + `router.push('/{newSlug}…')`; plus geo-detect na `/`.

## 4. Link generovanie

- **Centrálne buildery existujú 2** (upstream `buildStorefrontPath`/`useStorefrontHref`/
  `getStorefrontUrl` = 0 hitov):
  - `LinkWithChannel` (`src/ui/atoms/link-with-channel.tsx`) — klientský JSX wrapper, číta
    `useParams` (Saleor slug) a cez `REVERSE_MAP` emituje friendly URL. **64 výskytov / 16 súborov.**
  - `marketHref(channel, path)` (`channel-map.ts:51-54`) — kontext-agnostická funkcia pre server
    kód, `redirect()`, `router.push` aj computed hrefy. **30 výskytov / 12 súborov.**
- **Hardcoded `/sk` literály:** `"/sk` = **2** (oba JSDoc komentáre v `channel-map.ts:48-49`),
  `` `/sk `` = 0, `'/sk` = 0. Funkčné `/sk` template-literály existujú **2**, oba x-default:
  `lib/seo/hreflang.ts:75` a `sitemap.ts:57`.
- **Získavanie channelu — 5 vzorov:** `useParams` (9 client súborov mimo samotného
  `link-with-channel.tsx` buildera; vracia SALEOR slug kvôli rewrite!), prop-drilling
  `channel: string` (23 ui súborov), `marketHref` konverzia, checkout
  `checkout.channel.slug`/`DefaultChannelSlug`, regex path-surgery (2 market switchery).
- **Únik Saleor slugov do URL:** 5 `<Link>` call-sites stavia href z raw channelu (Saleor slug)
  (`sign-up-form.tsx:107,126`, `login-mode.tsx:121`, `set-password-mode.tsx:181` z `params.channel`;
  `category-grid.tsx:31` z `channel` propu) → emitujú `/sk-eur/…`; ďalšie raw-`params.channel` buildery:
  2× `router.push`, 3× e-mail `redirectUrl` (viď §5), breadcrumb hrefy v katalógových pages.
  Fungujú len vďaka 301 vetve proxy (kanonizácia + redirect hop navyše).
- **Bottom line: 45 unikátnych link-generujúcich súborov** (41 z href/redirect grepov + `sitemap.ts`
  + `lib/seo/hreflang.ts` + 2 switchery; bez `_reference` a testov). Reprodukcia (cwd = repo root):
  ```bash
  { grep -rl 'LinkWithChannel\|marketHref' src --include='*.ts' --include='*.tsx'; \
    grep -rl 'href={`/' src; grep -rl 'href="/' src; \
    grep -rl 'redirect(`/\|router.push(`/\|redirect(marketHref\|router.push(marketHref' src; \
    echo src/app/sitemap.ts; echo src/lib/seo/hreflang.ts; \
    echo src/ui/components/channel-select.tsx; echo src/ui/components/header-market-controls.tsx; } \
    | grep -v '_reference\|\.test\.\|__tests__' | sort -u | wc -l   # → 45
  ```
  (Širší grep bez filtra statických/externých hrefov dáva ~59 kandidátov — číslo 45 platí pre
  storefront-linky po vyfiltrovaní.)
- Vedľajší nález (mimo O1): 3 call-sites majú nefunkčnú interpoláciu `"${...}"` v úvodzovkách
  (`variant-selection-section.tsx:122,149`, `search-results.tsx:48`) — rieši sa už ako samostatný
  task (`task_436fb642`).

## 5. Externe viditeľný URL povrch

**a) sitemap/robots:** `src/app/sitemap.ts` + `robots.ts` existujú, emitujú absolútne
`https://maky.store/{market}{path}` (base = `NEXT_PUBLIC_STOREFRONT_URL`). Sitemap = 11 STATIC_PATHS
× 13 trhov = **143 URL**, z toho **104 mŕtvych** — 8 anglických paths (`/contact`, `/faq`,
`/shipping`, `/returns`, `/about`, `/terms`, `/privacy`, `/claims`) **nemá route na disku**
(reálne legal stránky sú slovenské slugy gated na SK). Produkty/kategórie v sitemap nie sú.
Komentár tvrdí „All 12 markets", pole má 13.

**b) canonical/alternates:** `(main)/layout.tsx` cez `buildAlternatesMetadata(channel)` emituje
korektné friendly canonicaly, ale s `path=""` — **canonical = homepage trhu pre KAŽDÚ stránku**
(product/category/collection/CMS ho nikdy neprepíšu). Product page navyše stavia
`url: '/${params.channel}/products/…'` (`products/[slug]/page.tsx:69`) → canonical
**`https://maky.store/sk-eur/products/…`** = URL, z ktorej proxy 301-uje preč. To isté JSON-LD
offer URL (`:143`). Hreflang x-default → `/sk`.

**c) auth/e-mail linky (5 ručných `redirectUrl` call-sites):**
- `sign-up-form.tsx:60`: `${origin}/${params.channel}/login` → **`https://maky.store/sk-eur/login`**
- `login-mode.tsx:88` (reset hesla): `${origin}/${params.channel}/login` → **`…/sk-eur/login`**
  (Saleor pripája `?email=…&token=…`; set-password flow na `/login`)
- `delete-account-section.tsx:20`: `${origin}/${params.channel}` → **`…/sk-eur`**
- checkout `sign-in-form.tsx:90`: `window.location.href` → **`…/checkout?checkout=<id>`**
- `account/actions.ts:162`: `redirectUrl` z formData (viď delete-account vyššie)

Všetky e-maily v obehu teda nesú **`/sk-eur/*`** tvar a ŽIJÚ z proxy 301 (query-preserving).

**d) next.config redirects/rewrites:** **0/0** — len `headers()` (cache). Žiadny `vercel.json`;
nginx config je mimo repa (neoverené, otvorená otázka).

**e) ostatné absolútne emittery:** JSON-LD offer (viď b), OG image API (`/api/og`, stale hex tokeny
— známy nález z design analýzy), žiadne RSS/feedy.

## 6. Delta sizing — A vs C (a prečo nie B)

**Spoločný základ (bugy nutné opraviť pri A AJ C, ~8-10 súborov):** stale sitemap (104 mŕtvych URL),
product canonical + JSON-LD `/sk-eur/*`, 3 e-mail `redirectUrl` `/sk-eur/*`, homepage-canonical
`path=""` bug, 5 raw-`params.channel` link sites. Tieto čísla NEpatria do rozdielu A vs C.

### A — kanonický `/{locale}/{channel}/…` (adopcia upstream v2 tvaru 1:1)

| Oblasť | Rozsah |
|---|---|
| Verejné URL | **100 % povrchu sa mení** (143 sitemap entries, 8 legal URL, všetky PDP/katalóg/účet) |
| Trvalé redirecty | **3 tvary navždy:** `/sk/*`→nový, `/sk-eur/*`→nový (e-maily v obehu), `/`→nový root |
| Route tree | re-root **38 dirs / 26 pages / 6 layoutov** pod `[locale]/[channel]` (veľká časť v cene adopcie v2 stromu pri checkout-v2 migrácii) |
| Link vrstva | náhrada 2 builderov upstream builderom + revízia **45 súborov** (single-segment prefix assumption) + 2 regex switchery |
| i18n | prepnutie derivácie locale z channel→na `[locale]` segment: ~3 súbory (`[channel]/layout.tsx`, `config/locale.ts`, `i18n/request.ts`); 25 translation súborov bez zmeny (ambient) |
| Proxy | `proxy.ts` zaniká → upstream session-bridge (browse-locale cookie) + nová 301 vrstva |
| Externé závislosti | Stripe aktivácia (legal URL), GSC, e-mail šablóny — všetko treba migrovať/preveriť |
| Upstream drift | **0** — 1:1 s upstream, najlacnejšie budúce rebases |

### C — tenký `/sk` rewrite layer nad nedotknutým v2 stromom

| Oblasť | Rozsah |
|---|---|
| Verejné URL | **0 zmien** (legal, e-maily, indexácia, Stripe podklady nedotknuté) |
| Market mapa | market→(locale,channel) **už existuje** = `channel-map.ts` (13 trhov, 27 importerov) — reuse |
| Middleware | 1 súbor: evolúcia `proxy.ts` (~100 riadkov) na rewrite `/{market}/*` → `/{locale}/{channel}/*` — strom dostane oba params, komponenty v2 fungujú bez úprav |
| Path builder | override upstream `buildStorefrontPath` (+ prípadne `useStorefrontHref`) na emisiu `/{market}/…`: **1-2 súbory** — v2 linky sú centralizované, call-sites sa nedotýkajú |
| i18n | 0 zmien (locale⇄channel coupling ostáva v mape) |
| Redirecty | ostáva existujúca 301 (`/sk-eur/*`→`/sk/*`); nič nové |
| Upstream drift | **trvalá delta ~3 súbory** (mapa + rewrite + builder override) — rebase risk lokalizovaný, ale večný |

### B — full custom routing

Zahodil by upstream v2 maintenance stream (checkout v2 + INTEGRATED_GATEWAYS fixy) presne vo chvíli,
keď celá Stripe cesta stojí na upstream kóde. Najvyšší náklad (45+ link súborov + celý checkout
vlastný) bez pull-path na budúce opravy — ďalej sa neuvažuje.

### Decision matrix (čísla, bez odporúčania — rozhodnutie patrí O1 session)

| Dimenzia | A: `/{locale}/{channel}` | C: `/sk` layer |
|---|---|---|
| Zmenené verejné URL | 100 % (143 sitemap + 8 legal + PDP/katalóg) | 0 |
| Trvalé redirect mapy | 3 tvary navždy | 1 (existujúca) |
| Dotknuté route dirs | 38 | 0 |
| Link-generujúce súbory na revíziu | 45 (+2 switchery) | 0 (len 1-2 builder override súbory) |
| Nové/zmenené routing súbory | proxy out, session-bridge + 301 vrstva in | ~3 (mapa reuse, rewrite, override) |
| i18n súbory | ~3 | 0 |
| E-maily v obehu (`/sk-eur/*`) | nová 301 vetva navždy | fungujú ako dnes |
| Externé podklady (Stripe legal URL, GSC) | migrácia nutná | bez zmeny |
| Upstream drift | 0 | ~3 súbory navždy |
| Spoločné SEO/e-mail fixy | ~8-10 súborov | tie isté ~8-10 |

## URL, KTORÉ NESMÚ PRESTAŤ FUNGOVAŤ

**Legal (8) — referencované zo Stripe aktivácie, footeru a VOP (účinnosť 30. 6. 2026):**
`https://maky.store/sk/obchodne-podmienky` · `/sk/reklamacie-a-vratenie` · `/sk/odstupenie-od-zmluvy`
· `/sk/ochrana-osobnych-udajov` · `/sk/cookies` · `/sk/doprava-a-platba` · `/sk/kontakt` · `/sk/o-nas`

**E-mailové linky v obehu (Saleor transactional — vyžadujú query-preserving redirect):**
`https://maky.store/sk-eur/login?email=…&token=…` (reset/set-password) ·
`https://maky.store/sk-eur/login` (potvrdenie registrácie) · `https://maky.store/sk-eur`
(potvrdenie zmazania účtu) · `https://maky.store/checkout?checkout=<id>` (checkout sign-in návrat)

**Vstupy a katalóg:** `https://maky.store/` (307 → `/sk`) · `https://maky.store/sk` ·
`/sk/products/{slug}` · `/sk/categories/{slug}` · `/sk/collections/{slug}` · `/sk/search` ·
`/sk/login`, `/sk/signup`, `/sk/account/*` · `/checkout?checkout=<id>` a `/checkout?order=<id>`
(aktívne košíky) · ľubovoľné `/sk-eur/*` → 301 → `/sk/*` (legacy tvar v e-mailoch/záložkách)

**API (mimo proxy matchera):** `/api/auth/reset-password` · `/api/auth/register` ·
`/api/auth/set-password` · `/api/og` · `/api/revalidate`

## Otvorené otázky pre Mareka

1. **Soft-404 na legal stránkach:** ne-SK trhy dostávajú HTTP 200 + streamovaný 404 boundary
   (PPR/cacheComponents). Akceptovateľné pre SEO, alebo presunúť gate tak, aby sa status nastavil
   pred commitnutím shellu?
2. **Stale sitemap (104 mŕtvych URL):** fixnúť hneď (pred Stripe aktiváciou / GSC submitom), alebo
   až v rámci O1 výsledku? (GSC kontrolu indexácie robíš ty.)
3. **`/sk-eur/*` únik (product canonical, JSON-LD, 3 e-mail redirectUrl):** opraviť ako samostatný
   mini-fix cez `marketHref()` ešte pred O1 rozhodnutím, alebo spolu s ním?
4. **Multi-market live stav:** `/cz`, `/de`… renderujú 200 bez gate — má to tak ostať do launchu
   ďalších trhov, alebo gate-núť všetko okrem `sk`? Ktoré z 13 channel slugov reálne existujú
   v Saleori (neoverené voči API)?
5. **Homepage-canonical bug** (`path=""` pre všetky stránky) — priorita fixu?
6. **nginx** (`/etc/nginx/conf.d/storefront.conf`, mimo repa): pridáva ďalšie redirecty nad
   proxy.ts? Treba jednorazovo skontrolovať pri O1.
7. **Saleor e-mail šablóny:** potvrdiť presný query tvar (`?email=&token=`) pre reset/delete flow —
   determinuje požiadavku „query-preserving redirect navždy" pri A.
