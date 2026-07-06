# Spec B — Checkout v2 + Stripe cez INTEGRATED_GATEWAYS — implementačný spec — v1

**Status:** design intent (written spec = design source per `CLAUDE.md §2`). **Dátum:** 2026-07-06.
**Branch (docs):** `spec/checkout-v2-stripe-b` (off `feat/legal-content-pages @ 0261e4d`).
**Nahrádza:** `docs/design/feat-stripe-checkout-spec.md` (SUPERSEDED 2026-07-06 — bespoke Payment
Element v legacy checkoute). **Toto je nový hlavný Stripe spec pre Checkout v2.**
**Companions (čítať, NEMIEŠAŤ):** `o1-routing-inventory.md` · `checkout-v2-migration-inventory.md` ·
`feat-stripe-app-infra-spec.md` (Track A DoD) · `feat-withdrawal-function-spec.md` (Branch B, §20a —
paralelný legal-critical track).
**Guarded scope:** `CLAUDE.md §10` (checkout/payment/cart/i18n/routing) — explicit approval pred
implementáciou; §11 (i18n parity); §13 (live-safe build/deploy).

> Tento dokument je **plán**, nie kód. Žiadna implementácia, build, install ani deploy nevzniká jeho
> napísaním. Implementácia je samostatná sekvencia (nižšie §4), každý krok s vlastným §10 schválením.

---

## 1. Exec summary

1. **Track A infra je HOTOVÁ** (`feat-stripe-app-infra-spec.md` DoD): self-hosted
   `saleor-app-payment-stripe@2.6.9`, app installed (`QXBwOjY=`), config `test-sk-eur → sk-eur`,
   `markAsPaidStrategy=TRANSACTION_FLOW`, webhook Active, smoke OK (`availablePaymentGateways` +
   `stripePublishableKey`). Backend vie prijať platbu; chýba už len storefront cesta.
2. **Legacy Stripe spec je SUPERSEDED.** Bespoke Payment Element v starom `/checkout` sa NEimplementuje;
   žiadny mock card form, žiadny dummy fallback pre zákazníka. Smer = **Checkout v2 + upstream
   INTEGRATED_GATEWAYS registry**, Stripe cez Saleor Stripe App / Transactions API.
3. **O1 routing = VARIANT C** (rozhodnuté 2026-07-06): verejné friendly market URL ostávajú
   (`/sk` `/cz` `/at` `/de` `/gb` …). NEprechádzame na upstream verejný tvar `/{locale}/{channel}`.
   Interné Saleor slugs (`sk-eur`, `cz-czk`, `gb-gbp` …) ostávajú interné; v2 session-bridge sa
   **adaptuje** na MAKY market mapu (`CHANNEL_MAP`, 13 trhov).
4. **Route segmenty `products/categories/collections` ostávajú anglické** počas Track B. Lokalizácia
   (`products→produkty`, `Produkte`, `produits` …) je **samostatná neskoršia SEO/URL etapa, mimo scope**.
5. **Žiadne reálne objednávky**, kým nie je (a) Stripe live path hotová a overená a (b) §20a withdrawal
   funkcia live (Branch B, legal blocker). Tvrdý guard — obe podmienky musia platiť súčasne.
6. **Auto-complete checkouts when fully paid = OFF** pre launch (Track A default). Test matica (§11)
   overí scenáre zavretého browsera / oneskoreného webhooku a **až podľa výsledku** sa rozhodne o
   neskoršom zapnutí. Launch = explicitný `checkoutComplete` / finalize flow podľa v2.
7. **DPH copy = prechodový stav (konzervatívne).** Marek je dnes neplatiteľ DPH → checkout NESMIE
   písať „vrátane DPH" ani vyčísľovať DPH ako samostatnú položku; neutrálne „Celková cena" /
   „Konečná cena". Po registrácii za platiteľa DPH (Marek žiada čoskoro) sa copy prepne na DPH-aware
   režim — navrhnúť tak, aby prepínač bol na jednom mieste.
8. **Downsize infra sa NErieši teraz** (len tracked later task, `maky-apps m9g.large → t4g.medium`).

---

## 2. Architecture decision record (ADR) — O1 = Variant C

**Rozhodnutie:** Zachovať MAKY friendly market URL model. Verejný URL povrch sa nemení.

```text
Verejný model   = friendly market prefix  /{market}     (/sk /cz /at /de /gb …)
Interný model   = market → { locale, country, currency, saleorSlug }   (CHANNEL_MAP, 13 trhov)
Upstream tvar   = /{locale}/{channel}   → NEpoužiť ako verejný URL povrch
Adaptácia       = Checkout v2 / session-bridge sa prispôsobí MAKY market scheme (nie naopak)
```

**Kontext (z `o1-routing-inventory.md`):** `/sk` nie je len channel — je to **market tuple**
`(channel + locale + currency + country)` z `CHANNEL_MAP` (`src/lib/channel-map.ts`, 13 trhov, 27
importerov). Locale sa odvodzuje z channel paramu (`getLocaleFromChannel`), `[locale]` segment
neexistuje (0 výskytov). Request-interceptor je `src/proxy.ts` (Next 16 proxy file-konvencia): `/`
→307→ `/{market}`, `/sk-eur/*` →301→ `/sk/*` (query-preserving), `/sk/*` →rewrite→ `/sk-eur/*`.

**Prečo C (nie A `/{locale}/{channel}`, nie B custom):**

- **Lepšie zákaznícke URL.** `/sk/products/…` je čistejšie a kratšie než `/sk-SK/sk-eur/products/…`.
- **Menej SEO rizika.** C = **0 zmien verejných URL**; A = mení 100 % povrchu (143 sitemap entries,
  8 legal URL, všetky PDP/katalóg/účet) + 3 trvalé 301 mapy navždy.
- **Stabilné legal + e-mail URL.** 8 legal stránok `/sk/*` (referencované zo Stripe aktivácie a VOP,
  účinnosť 30. 6. 2026) a e-mailové linky v obehu `/sk-eur/*` (Saleor transactional) fungujú ďalej bez
  novej redirect vrstvy.
- **Saleor channel slugs ostávajú interné** — nevystavujeme `sk-eur`/`gb-gbp` ako verejný povrch.
- **Delta rozsah.** C = tenká vrstva ~3 súbory (market mapa už existuje) + 0 revízií 45 link súborov;
  trvalý upstream drift ~3 súbory (mapa + rewrite + path-builder override) — lokalizovaný, prijateľný.
- **Session-bridge sa adaptuje.** v2 `src/session-bridge/` + `buildCheckoutPath` sa napíšu proti MAKY
  market scheme (single-segment `/{market}`), nie proti upstream `[locale]/[channel]` skupinám.

**Dôsledok pre implementáciu:** najväčšia štrukturálna kolízia (z migračného inventára §7) =
MAKY `src/proxy.ts` single-segment `[channel]` strom vs v2 `(storefront)/[locale]/[channel]` +
middleware + session-bridge. Variant C ju rieši **evolúciou `proxy.ts`** a adaptáciou session-bridge,
nie prijatím upstream route skupín.

---

## 3. Scope

### In scope
- **BFF auth foundation** (`/api/auth/login`, `resolveSessionUser`, `session-auth-state`; rewire
  `graphql.ts` choke pointu; náhrada AuthProvider mountov + 3× `hasCookies`).
- **Session-bridge adaptácia** na MAKY market scheme (variant C).
- **Checkout v2 wholesale adopcia** (route groups, RSC entry, server actions, confirmation split,
  `?step=` shallow history, payment registry, session management).
- **INTEGRATED_GATEWAYS payment registry** + Stripe enablement cez Track A appku.
- **SK checkout i18n katalóg** (autorovať; v2 nemá `sk` locale) + 13-locale §11 parita.
- **Truthfulness cleanup** checkout copy (E1–E9, DPH prechodový stav, order button, trust badges).
- **Stripe test matica** (§11).
- **Zachovanie `/sk` `/cz` `/at` `/de` `/gb` …** (variant C, 0 zmien verejných URL).

### Out of scope
- **Downsizing infra** (`maky-apps` m9g.large → t4g.medium) — tracked later.
- **Lokalizácia route segmentov** `products/categories/collections` — samostatná SEO/URL etapa.
- **Live keys / production deploy** — až po green test matici (§ prvá live objednávka).
- **Refunds / cancel UI** v storefronte (rieši sa v Saleor Dashboarde).
- **Subscriptions · saved cards / off-session · marketplace / lokálne CEE metódy mimo Stripe Payment
  Element · multi-currency mimo EUR.**
- **Veľký redesign checkoutu** (fork classNames sa držia; vizuálny rebrand mimo).
- **§20a withdrawal (Branch B)** — paralelný legal-critical track, NEmiešať (viď §5 a companion spec).

---

## 4. Foundation / poradie implementácie

> Poradie, NIE povel na spustenie. Každý krok = vlastná vetva, vlastné §10 schválenie, build len v
> scratch worktree/klone (§13). Zdroj: `checkout-v2-migration-inventory.md §8`.

```text
0. SEO/e-mail hygiene branch      — SAMOSTATNE, PRED Track B (alebo paralelne, nemiešať do implementácie)
1. Dependency alignment           — next 16.2.9, react 19.2.7, next-intl 4.13, engines 24.x, @stripe/*
2. BFF auth foundation            — /api/auth/login, resolveSessionUser, session-auth-state
3. Routing/session-bridge (C)     — market prefix, browse-locale ekvivalent, buildCheckoutPath
4. Checkout v2 wholesale adopcia  — MIGRATION.md kroky 1–8
5. Replay MAKY customizácií       — marketHref (register §2), brand.css bridge, TW3→TW4 pass
6. Truthfulness cleanup copy      — exclusion E1–E9 (§8)
7. SK checkout i18n + §11 parita  — autorovať sk katalóg, 13 locale
8. Stripe enablement              — INTEGRATED_GATEWAYS + env flagy, publishable key zo Saleora
9. Full test matica               — §11
10. Live keys + malý live smoke   — AŽ po green testoch
```

**Detail k prereq-om:**

- **Krok 0** je spoločný pre A aj C a rieši 4 predexistujúce bugy + konsoliduje 3 zachránené vetvy
  (viď §5). Nezávislý od Stripe.
- **Krok 1 (dep alignment):** TW **4.2.2 vs 3.4.19** (najväčší delta — class re-verifikácia + bridge),
  `@stripe/*` len upstream (doplniť `@stripe/stripe-js` + `@stripe/react-stripe-js`), next 16.1.2→16.2.9,
  next-intl 4.8.3→4.13.0, react ^19.1.2→^19.2.7. Engines local `>=20 <21` vs upstream `24.x` — **server
  už beží node v24.15.0**, takže zosúladiť pole, žiadny server upgrade netreba. Build výlučne v
  worktree/klone (§13).
- **Krok 2 (BFF auth):** `cacheComponents:true` už je nastavené → prereq splnený. **TU sa opraví
  set-password token leak** ako tracked must-fix (viď `known-issues.md` / §5) — `set-password/route.ts`
  nastavuje mŕtve cookies (nikto ich nečíta) a **vracia raw token v JSON response**. Rework choke pointu
  `graphql.ts` premigruje všetkých 12 non-checkout callerov bez ich úprav.
- **Krok 3 (routing/session-bridge, C):** adaptácia na single-segment `/{market}`; náhrada hardcoded
  handoff `cart/checkout-link.tsx:15`.
- **Krok 5 (replay):** MAKY diff v `src/checkout` = **len 2 súbory, +4/−2** (jediná zmena =
  `marketHref()` fix „Continue shopping" v oboch confirmation views). Replay je triviálny (S); ťažisko
  = 2×L foundation (BFF auth + routing) + adopcia samotná.

---

## 5. SEO/e-mail/URL hygiene branch (KROK 0 — samostatne)

Tieto bugy sú **spoločné pre variant A aj C** (`o1-routing-inventory.md §5–6`) a treba ich riešiť
**jedným malým branchom `fix/seo-email-url-hygiene` PRED Track B implementáciou** — nie ako súčasť
Stripe práce.

**4 O1 bugy (externý URL povrch):**

1. **Stale sitemap:** `src/app/sitemap.ts` = 11 STATIC_PATHS × 13 trhov = 143 URL, z toho **104 mŕtvych**
   (8 anglických paths `/contact` `/faq` `/shipping` `/returns` `/about` `/terms` `/privacy` `/claims`
   nemá route na disku; reálne legal stránky sú SK slugy). Regenerovať len z reálnych publikovaných ciest.
2. **Product canonical + JSON-LD na `/sk-eur/*`:** `products/[slug]/page.tsx:69,143` stavia
   `url: '/${params.channel}/products/…'` → canonical `https://maky.store/sk-eur/products/…` = URL, z
   ktorej proxy 301-uje preč. Prepnúť na friendly `/sk/*` cez `marketHref()` / `REVERSE_MAP`.
3. **3 e-mail `redirectUrl` na `/sk-eur/*`:** `sign-up-form.tsx:60` (register), `login-mode.tsx:88`
   (reset hesla), `delete-account-section.tsx:20` / `account/actions.ts:162` (delete account) —
   emitujú `…/sk-eur/…`. Prepnúť na `/sk/*`. (Dnes fungujú len vďaka 301 vetve proxy.)
4. **Homepage canonical na každej stránke:** `(main)/layout.tsx buildAlternatesMetadata` s `path=""` →
   canonical = homepage trhu pre KAŽDÚ stránku. Opraviť tak, aby homepage-canonical bol len na homepage.

**Konsolidácia 3 zachránených `claude/*` vetiev** (commitnuté + pushnuté na origin 2026-07-06):

| Vetva | Obsah | Súbory |
|---|---|---|
| `claude/nifty-sammet-75105c` | 5 href fixov (`"…${}…"` → `` `…${}…` ``) | cart-drawer, variant-selection-section, search-results |
| `claude/blissful-curran-1493f9` | noindex na null-lookup detail routách | products/categories/collections/pages `[slug]` |
| `claude/nostalgic-heyrovsky-7e4d0a` | branding removal + metadata cleanup | 7 súborov (layout, metadata.ts, checkout title, …) |

> ⚠️ **Merge konflikt `pages/[slug]/page.tsx`:** menia ho **obe** vetvy — `blissful` (noindex, ponecháva
> „Saleor Storefront example") vs `nostalgic` (odstraňuje branding + zapája `buildPageMetadata` +
> canonical). Hygiene branch ich musí **vecne spojiť do jednej verzie**, nie mechanicky vybrať jednu:
> noindex pre chýbajúcu CMS stránku **+** odstránenie Saleor brandingu **+** `buildPageMetadata` **+**
> canonical cleanup. Poznámka: `nostalgic` metadata refaktor (`title.absolute`, `buildPageMetadata`)
> už **čiastočne rieši homepage-canonical bug (#4)** — pri konsolidácii zjednotiť s bodom 4 vyššie.

Implementácia hygiene branchu = mimo tohto specu (vlastná sekvencia + validácia + §13-safe deploy).

---

## 6. Stripe payment architektúra (Checkout v2 + INTEGRATED_GATEWAYS)

**Model:** Checkout v2 používa priority-ordered **`INTEGRATED_GATEWAYS`** registry
`{type, submitMode, findGateway, isEnabled, matchesGateway}`; `resolvePaymentProvider()` vyberie prvý
enabled match z `Checkout.availablePaymentGateways`. Stripe gateway = **Saleor Stripe App / Transactions
API** (Track A). **Žiadny mock card form, žiadny dummy fallback pre zákazníka, žiadna generická PSP
abstrakcia, žiadny bespoke legacy Payment Element mimo v2 flow.**

**Overené z Track A (`feat-stripe-app-infra-spec.md`) + migračného inventára §6:**

```text
gateway id      = saleor.app.payment.stripe        (submitMode: client)
publishable key = zo Saleora (paymentGatewayInitialize), NIE z env
env flagy       = NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS + ENABLE_STRIPE_PAYMENTS (server mirror)
                  + NEXT_PUBLIC_ENABLE_STRIPE_EXPRESS_CHECKOUT
config          = test-sk-eur → sk-eur channel, markAsPaidStrategy=TRANSACTION_FLOW, webhook Active
dummy dev app   = saleor.io.dummy-payment-app + ALLOW_DUMMY_PAYMENT (len dev, nikdy zákazník)
amounts         = EUR minor units (centy); správna decimal→cents konverzia (žiadny hardcoded USD)
```

**Kanonický flow (target):**

```text
paymentGatewayInitialize      → data.stripePublishableKey  (+ enabled methods)
  → transactionInitialize      → data.paymentIntent.stripeClientSecret  (NESTED path)
                                 (paymentGateway.data.paymentIntent.paymentMethod, nikdy "unknown")
  → mount <Elements> + <PaymentElement>
  → elements.submit()
  → stripe.confirmPayment({ elements, clientSecret, confirmParams:{ return_url } })   (3DS v Elements)
  → [return_url] transactionProcess   ← POVINNÝ force-sync pred checkoutComplete
  → checkoutComplete                  ← vytvorí Order (idempotentné)
```

**Overiť v implementácii (nepredpokladať — migračný inventár + legacy spec varujú o nekonzistencii
naprieč verziami appky):**

- **Skutočný gateway id** z manifestu nainštalovanej appky (`saleor.app.payment.stripe` vs
  `app.saleor.stripe`) — potvrdiť proti `2.6.9`.
- **Presné názvy `data` polí** z `transactionInitialize` — docs ukazujú `data.paymentIntent.client_secret`
  + `data.publishableKey` **vs** `data.stripeClientSecret`. Overiť reálny tvar z nainštalovanej appky a
  **otypovať storefront kód naň** (tento spec cieli `data.paymentIntent.stripeClientSecret`, ale kód sa
  riadi realitou appky).
- `availablePaymentGateways` shape, `paymentGatewayInitialize` podľa upstream v2, `checkoutComplete`
  finalize flow.
- **Idempotency / duplicate-protection:** `idempotencyKey` do `transactionInitialize` (unikátny per
  `idempotencyKey`+gateway) — žiadny double-charge pri retry / double-click.
- **3DS / redirect return flow:** `return_url` summary route číta transaction/checkout status; on success
  `checkoutComplete`, on failure clear recoverable error.

**Zdieľané primitívy (NEreimplementovať per-gateway):** `updateCheckoutBilling` pred charge, live total
validation, `finalizeCheckoutOrder`. Confirmation split → `/checkout/complete?order=`
(`window.location.replace`, nikdy `router.replace`); `stripe-checkout-completion-host` prežíva unmount
kroku.

---

## 7. Capture mode + platobné metódy

```text
Capture           = CHARGE (immediate capture) pre launch     ← sedí s sk-eur channel settingom
                    (nie AUTHORIZATION; žiadna auth-expiry ops réžia; štandard SK e-shopov)
Platobné metódy   = karty + Apple Pay + Google Pay v launch scope (Payment Element wallets)
Apple Pay         = doménová verifikácia je SÚČASŤ scope (setup krok)
Fallback          = ak by Apple/Google Pay blokovali card launch → idú ako fast-follow,
                    ale spec ich plánuje (nevypúšťať z dizajnu)
```

Lokálne non-card CEE metódy = deferred (cross-border wave, out of scope).

---

## 8. Checkout copy — truthfulness cleanup + DPH prechodový stav

**Truthfulness checklist (potvrdené Marekom; zdroj exclusion `checkout-v2-migration-inventory.md §3`).
v2 tieto demo prvky STÁLE obsahuje — adopciou nezmiznú, treba ich aktívne odstrániť/neutralizovať:**

- [ ] **Free-shipping claim PREČ** — `order-summary.tsx` trust badge (v2 ~394–396). MAKY nemá free
      shipping (§6/§9 CLAUDE.md).
- [ ] **„30-day returns" PREČ / právne zosúladiť** — (v2 ~386–388). Zákonné = **14 dní odstúpenie**;
      30 dní možno neskôr **len pre registrovaných**, kým to nie je právne + produktovo uzavreté →
      **nekomunikovať**.
- [ ] **`shipping === 0 → "Free"` PREČ** — (v2 `tCommon('free')` ~345–346). Pred výberom dopravy NESMIE
      byť „Free" → neutrálne „cena po výbere dopravy". (Pozor: `shipping-step.tsx` reálne Saleor sadzby
      sú pravdivé — tie ostávajú.)
- [ ] **Demo `saleor10` promo PREČ** — v2 to rieši sám (reálne `applyCheckoutPromoCode` server actions),
      len overiť, nič neportovať.
- [ ] **Dummy card form PREČ** — v2 = INTEGRATED_GATEWAYS registry; žiadny mock form.
- [ ] **DPH copy = prechodový stav** (viď nižšie).
- [ ] **Order button = presné znenie „Objednať s povinnosťou platby"** (EÚ Consumer Rights; NIE
      „Dokončiť" / „Pokračovať"). Seed už existuje v `sk-SK.json` `checkout` namespace.
- [ ] **Estimated delivery v confirmation = VYPUSTIŤ** pre launch (E7) — žiadny hardcoded odhad (+7 dní),
      kým nie je reálny carrier estimate.

**Trust badges — áno, minimalistické a pravdivé** (pri platobnej sekcii):

```text
🔒 „Platba zabezpečená cez Stripe"        (pri platobnej sekcii)
   „Bezpečná platba kartou"
   odkaz „Právo na odstúpenie od zmluvy"  → /sk/odstupenie-od-zmluvy
```

ŽIADNE neoverené garancie, žiadne „SSL secured", žiadne free-shipping claims. Implementovať cez v2
`components/payment/payment-trust-signals.tsx` + i18n.

**DPH prechodový stav (dôležité, konzervatívne):**

```text
STAV DNES (neplatiteľ DPH):
  - checkout NESMIE písať „vrátane DPH" ani vyčísľovať DPH ako samostatnú položku
  - použiť NEUTRÁLNE znenie: „Celková cena" / „Konečná cena" / „Spolu"
  - E4 (Tax(VAT)/Including VAT bloky): dnes tax=0 → blok sa nerenderuje, ale hardcoded stringy odstrániť

PO REGISTRÁCII za platiteľa DPH (Marek žiada čoskoro):
  - copy sa prepne na „vrátane DPH" + DPH vyčíslenie
  - fakturačný režim = režim platiteľa

DIZAJN: prechod medzi stavmi musí byť triviálny — jedno miesto na zmenu (flag / i18n kľúč),
        nie rozsypané literály. Over u účtovníka pri registrácii.
```

---

## 9. SK i18n

- **v2 checkout nemá `sk` katalóg** — shipuje len de/en/fi/fr/nb/pl. SK zákazník dnes vidí checkout po
  anglicky (v `src/checkout` je 0 next-intl a 0 SK stringov).
- **Treba autorovať slovenský checkout katalóg** (`sk` next-intl namespaces `checkout`+`account`).
  Seed = nepoužívaný 19-kľúčový `checkout` namespace v `sk-SK.json` (vrátane „Objednať s povinnosťou
  platby") + `cart` namespace glosár (Medzisúčet/Doprava/Celkom …).
- **Tón:** profesionálne vykanie, čistý e-shop tón, žiadne prehnané marketingové formulácie. CC navrhne
  kompletný draft, **Marek schváli/upraví**.
- **Ostatné locale držia §11 paritu** — všetkých 13 message súborov štrukturálne identických
  (missing 0 / extra 0). Interim = sk + en pre ostatných 12; plný preklad neskôr (parity invariant drží
  vždy). next-intl NIE je type-augmented → chýbajúce kľúče padajú **ticho za behu**, nie na builde →
  spustiť parity skript (CLAUDE.md §11) pri každej zmene copy.
- **Route segmenty `products/categories/collections` NElokalizovať** v Track B (samostatná SEO etapa).

---

## 10. Test matica

Minimálne pokryť (spustiť s `sk_test`/`pk_test`, nikdy live kartou v teste):

```text
Platba:
  - success card
  - declined card
  - 3DS required
  - insufficient funds
  - cancel / return from Stripe
  - Apple Pay / Google Pay (wallet flow)

Odolnosť / edge:
  - browser closed after confirmPayment      → webhook musí dokončiť transaction
  - webhook delayed / retry
  - duplicate submit / double-click
  - idempotency retry (žiadny double-charge)
  - price/tax/shipping total changed before payment
  - checkout expired / already completed
  - payment app unavailable

Účet / session:
  - guest checkout
  - logged-in checkout
  - account creation / password reset path
  - email redirectUrl correctness  (→ /sk/*, nie /sk-eur/*)

Routing / dáta:
  - /sk market URL preservation (variant C, 0 zmien)
  - order creation in Saleor
  - transaction events in Saleor

Guard:
  - NO real orders until live smoke green
  - auto-complete OFF overiť: closed-browser + delayed-webhook scenáre determinujú neskoršie zapnutie
```

---

## 11. Validation strategy (budúca — NIČ nespúšťať teraz)

Budúca implementácia každého kroku bude vyžadovať (nič z toho nie je súčasť tohto docs tasku):

- lint (0 errors)
- typecheck (`tsc --noEmit`)
- build **v scratch worktree/klone** (nikdy v živom `/opt/storefront`, §13)
- runtime test na **spare porte** (napr. `next start -p 3032`)
- test card matica (§10)
- Saleor transaction/order verification (transaction events + Order created)
- webhook verification (incl. browser-closed case)
- visual sanity checkoutu (`next build` NEcertifikuje token correctness — TW v4 ticho neemituje pravidlo
  pre undefined `--color-*`; vizuálne overiť že komponenty maľujú, §4.2/§12 CLAUDE.md)
- i18n 13-locale §11 parity check pri každej zmene copy
- **no production touch per §13** — build/deploy len cez `pm2 stop → rm -rf .next → build → verify na
  spare porte → pm2 start → verify :3000 + https://maky.store/sk`

---

## Prvá live objednávka (post-green, referenčne)

Po green test matici (nie skôr): live kľúče (`sk_live`/`pk_live`) do **novej immutable config** v Stripe
Appke → premapovať na `sk-eur` channel → **starú test config zmazať** → Marek osobne kúpi najlacnejší
reálny produkt vlastnou kartou → overí platbu v Stripe + objednávku v Saleore + confirmation e-mail +
stav transakcie → refund. **Žiadna test karta v live móde. Secrets len v app config / SSM — nikdy v
repe, docs ani chate.**

---

## Paralelný track: §20a withdrawal (Branch B) — NEMIEŠAŤ

`feat-withdrawal-function-spec.md` je **samostatný legal-critical track** (Act 310/2025 §20a, účinnosť
19. 6. 2026): funkčná online odstúpi-od-zmluvy funkcia pre hostí (číslo objednávky + e-mail, bez loginu),
auto-acknowledgement e-mail s dátumom + časom. **Nie je Stripe blocker**, ale **musí byť live pred
reálnym predajom** — rovnaký gate ako Stripe. Reálna implementácia = vlastná sekvencia, poriadne, nie
narýchlo popri checkoute. **Tvrdá veta:** reálne objednávky nesmú ísť live, kým nie je hotový aj §20a track.

---

## 12. Open questions for Marek

> Uzavreté rozhodnutia (capture=CHARGE · metódy karty+Apple/Google Pay · auto-complete OFF · order button
> „Objednať s povinnosťou platby" · trust badges áno + znenie vyššie · estimated delivery vypustiť · DPH
> prechodový stav · SK copy CC drafts → Marek schvaľuje · O1=C · route segmenty anglické) sa **NEotvárajú**.
> Otvorené ostáva len:

1. **Trust badge umiestnenie:** presná pozícia v checkout layoute — pri „Objednať" tlačidle, v
   order-summary, alebo pri platobnej sekcii? (Znenie je schválené, len umiestnenie doladiť.)
2. **SK checkout copy tón:** CC pripraví kompletný draft katalógu — potvrdiť/doladiť tón a konkrétne
   formulácie pri review.
3. **Saleor channels — realita:** ktoré z 13 `CHANNEL_MAP` slugov reálne existujú v Saleori (neoverené
   voči API)? Determinuje rozsah multi-market test matice (launch = len `sk-eur`, ostatné neskôr?).
4. **SEO/e-mail hygiene ako prvý branch:** potvrdiť, že `fix/seo-email-url-hygiene` (KROK 0) ide PRED
   Track B implementáciou (odporúčam — je nezávislý a odblokuje čistý externý povrch pred GSC/Stripe live).
