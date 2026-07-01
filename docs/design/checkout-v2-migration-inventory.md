# Checkout v2 — pre-migračný inventár (Track B, krok 0)

**Dátum:** 2026-07-01 · **Režim:** read-only analýza (žiadne zmeny kódu)
**Branch:** `feat/legal-content-pages` · **HEAD:** `b482515` (clean tree)
**upstream/main:** `24053f2` (saleor/storefront) · **Fork point (merge-base):** `be64a69` (2026-03-15, next 16.1.2)
**Upstream migrácia:** `2026-06-checkout-v2` · pinned foundation commit `8c415655`
**Metóda:** MAKY customizácie = `git diff be64a69..worktree`; upstream v2 drift = `be64a69..upstream/main`.
Merge-base funguje aj na shallow histórii (be64a69 je overený ancestor HEAD), takže klasifikácia
nie je len „existencia v upstream/main", ale plné trojcestné porovnanie. Pozn.: repo je shallow —
`git log` atribuuje všetko staršie grafту `be64a69`; keďže be64a69 je čistý upstream commit,
všetko v ňom je upstream-origin kód.

---

## Exec summary

1. **MAKY customizácie v `src/checkout` = 2 súbory, +4/−2 riadky** — jediná zmena je `marketHref()`
   fix „Continue shopping" linku v oboch confirmation views. Nič iné.
2. Klasifikácia 86 tracked súborov: **84 UPSTREAM-UNCHANGED · 2 MAKY-MODIFIED · 0 MAKY-NEW**;
   7 súborov upstream v2 medzitým zmazal (87. „súbor" je gitignorovaný codegen output).
3. Všetky položky exclusion zoznamu (saleor10, free-shipping badge, Tax (VAT), 0→„Free", demo
   confirmation) sú **zdedený upstream demo kód z fork pointu**, nie MAKY práca.
4. ⚠️ **v2 sám stále obsahuje** free-shipping badge (~394–396), „30-day returns" (~386–388) aj
   0→„Free" (345–346) — adopciou nezmiznú, treba ich **aktívne odstrániť**; jedine saleor10 v2
   rieši zadarmo (skutočné voucher server actions).
5. Skutočná práca nie je replay, ale **foundation**: BFF auth prereq úplne chýba (žiadny
   `/api/auth/login`, `resolveSessionUser`, `session-bridge`) — všetkých 5 detect NEEDS checks
   horí, všetkých 6 already-applied markerov zlyháva.
6. Najväčšia štrukturálna kolízia: **MAKY `src/proxy.ts` market routing `/[channel]`** vs v2
   `(storefront)/[locale]/[channel]` route groups + middleware + session-bridge.
7. **TW 3.4 (upstream) vs TW 4.2 (local):** shadcn bridge v `brand.css:230–256` musí prežiť
   (27 checkout súborov na ňom maľuje) + class-migračný pass + §11 vizuálna verifikácia.
8. v2 checkout je **next-intl bez `sk` locale** (má len de/en/fi/fr/nb/pl) → sk katalóg treba
   autorovať; seed = nepoužívaný 19-kľúčový `checkout` namespace v `sk-SK.json` (vrátane
   „Objednať s povinnosťou platby").
9. Vedľajšie nálezy: set-password route nastavuje **mŕtve cookies** (nikto ich nečíta) a leakuje
   raw token v JSON; `hasCookies` gate je vždy true (market cookie); 2 stale `.bak` súbory na
   disku (untracked/ignored — git ich netrackuje, overené v samostatnej cleanup session).
10. **Odhad replay+adopčnej práce: S×12 · M×4 · L×2** (register nižšie); poradie v §8.

---

## 1. Klasifikácia súborov `src/checkout`

| Kategória | Počet | Z toho zmazané v upstream/main |
|---|---|---|
| UPSTREAM-UNCHANGED (identické s fork pointom) | 84 | 6 |
| MAKY-MODIFIED | 2 | 1 |
| MAKY-NEW | 0 | 0 |
| **Spolu tracked** | **86** | **7** |

- Celkový MAKY diff v `src/checkout`: `git diff be64a69 --shortstat` = **2 files, +4/−2**.
- 87. súbor z pôvodného zadania = `src/checkout/graphql/generated/index.ts` — gitignorovaný
  codegen output, nie zdroj.
- **2 MAKY-MODIFIED súbory** (obidva ten istý one-liner: import `marketHref` z
  `@/lib/channel-map` + náhrada hardcoded linku):
  - `src/checkout/views/order-confirmation/order-confirmation.tsx:10,123` — `href={marketHref(channel || "sk")}`
  - `src/checkout/views/saleor-checkout/confirmation-step.tsx:8,116` — `href={marketHref(channel)}`
- **7 súborov zmazaných v upstream v2:** `components/express-checkout/{express-checkout,index}.tsx`,
  `components/payment/payment-method-selector.tsx`, `hooks/use-safe-mutation.ts`,
  `ui-kit/icons/{apple-pay,google-pay}-icon.tsx`, `views/saleor-checkout/confirmation-step.tsx`
  (posledný je jediný modify/delete konflikt — MAKY zmena v súbore, ktorý v2 zmazal).
- Upstream v2 tvar: `src/checkout` má pri tipe **195 súborov** (lib/ 68, components/ 39, views/ 34,
  ui-kit/ 20, hooks/ 15, providers/ 7, graphql/ 6) + nové entrypointy `checkout-app.tsx`,
  `order-confirmation-app.tsx`; `src/app/(checkout)/` má 7 súborov; `src/session-bridge/` 7 súborov.

## 2. Register MAKY customizácií (skutočný replay register)

Toto je **celý** zoznam toho, čo je reálne MAKY a treba preniesť:

| # | Súbor:riadky | Popis | Verdikt | Odhad |
|---|---|---|---|---|
| R1 | `order-confirmation.tsx:10,123` + `confirmation-step.tsx:8,116` (+ závislosť `src/lib/channel-map.ts`) | „Continue shopping" cez `marketHref()` (channel slug `sk-eur` → market path `/sk`) | **REWORK-S** — v2 zmazal confirmation-step a Link nahradil `navigateToStorefrontHome(channel, storefrontLocale)`; mapping treba re-aplikovať v tom helperi / v2 order-confirmation | S |
| R2 | `src/styles/brand.css:230–256` | shadcn→semantic token bridge (`--color-primary: var(--cta)` …) — 27 checkout súborov používa shadcn vokabulár, ktorý pod lokálnym TW4 maľuje len vďaka bridgu; v2 checkout (TW 3.4) používa ten istý vokabulár | **REPLAY-M** — bridge zachovať a rozšíriť o nové shadcn mená, ktoré v2 prinesie | M |
| R3 | `src/i18n/messages/sk-SK.json:103,126–159` | MAKY SK slovník: `cart` namespace (Medzisúčet/Doprava/DPH/Celkom, „Prejsť k pokladni"), `product.secureCheckout`; + **nepoužívaný** 19-kľúčový `checkout` namespace so zákonným „Objednať s povinnosťou platby" | **REPLAY-S** (slovník ako referenčný glosár) + **REWORK-M** (autorovať v2 `checkout` next-intl katalóg pre sk — v2 nemá sk locale; + 12 locales parity) | S + M |

Nič iné MAKY v checkoute neexistuje — order-summary, payment-step, shipping-step, root.tsx,
mobile-sticky-action, všetky 4 `.graphql` súbory, `codegen.ts` aj `index.css` sú byte-identické
s fork pointom.

## 3. Replay-EXCLUSION zoznam (povinný — do v2 sa NESMÚ preniesť)

Všetky položky sú origin **UPSTREAM-BASE** (zdedené demo), riadky overené k HEAD `b482515`.
Kľúčový stĺpec: či to v2 rieši sám, alebo treba aktívny zásah.

| # | Miesto (local) | Čo | Status v upstream v2 | Akcia pri adopcii |
|---|---|---|---|---|
| E1 | `order-summary.tsx:370–377` | „Free shipping" trust badge (§6/§9 zákaz) | ⚠️ **v2 ho stále má** (~394–396) | aktívne zmazať | 
| E2 | `order-summary.tsx:362–369` | „30-day returns" badge (EN, blanket claim; realita 14 dní hosť / 30 reg.) | ⚠️ v2 ho stále má (~386–388) | zmazať / REWORK podľa §9 + policy | 
| E3 | `order-summary.tsx:322–323` (+ fallback `:72 \|\| 0`) | `shipping===0 → "Free"` — fabrikuje „Free" pred výberom metódy | ⚠️ v2 drží rovnaký pattern (`tCommon('free')`, 345–346) | nahradiť neutrálnym „cena po výbere dopravy"; ďalšie 0→Free cesty: `money.ts:34–36` (feed Method row), `shipping-step.tsx:131–132,180` (tam pravdivé — reálna Saleor sadzba) |
| E4 | `order-summary.tsx:326–331,344` | „Tax (VAT)" blok + „Including VAT" | v2 to vlastní ako i18n kľúče `taxVat`/`includingVat` | SK znenie („vrátane DPH", neplatiteľ → konečné ceny) rozhodnúť na úrovni v2 katalógu |
| E5 | `order-summary.tsx:140–145,308` | Fake promo `saleor10` (client-side, TODO, nič nevolá) | ✅ **v2 rieši zadarmo** — reálne `applyCheckoutPromoCode`/`removeCheckoutPromoCode` server actions | len overiť, nič neportovať |
| E6 | `confirmation-step.tsx:33–51` | Demo confirmation: `DEMO-` číslo objednávky (Math.random), vymyslené doručenie +7 dní, „Demo Mode" banner | ✅ v2 celý súbor zmazal | nič neportovať |
| E7 | `order-confirmation.tsx:34–36,113–114` | Fabrikovaný „Estimated delivery" (+7 dní) — neoveriteľný FedEx prísľub | súbor v2 existuje ďalej — **pri adopcii overiť** a claim odstrániť | aktívne overiť/zmazať |
| E8 | `express-checkout.tsx:16–70` (render 3× v `information-step.tsx:394/414/434`) | „Currently decorative" Apple/Google Pay tlačidlá — nefunkčné | ✅ v2 má reálny `stripe-express-checkout.tsx` | nič neportovať |
| E9 | `payment-step.tsx:20,124–126,238–311,358–382` + `payment-method-selector.tsx:8–248` | Dummy gateway `mirumee.payments.dummy` + mock card form (polia sa nikam neposielajú) | ✅ v2 = INTEGRATED_GATEWAYS registry; pozor: v2 dummy má **iné id** `saleor.io.dummy-payment-app` → treba nainštalovať payment **appky** v Saleore, nejde len o UI swap | nič neportovať |

**Superseded-by-v2, bez akcie** (fork-point kód, ktorý v2 nahrádza vlastným — neportovať, žiadna
práca): order-summary štruktúra + dual adapters (`:47–110,116–350`), discount row (`:332–337`),
`shipping-step.tsx` (celý), `checkout-summary-context.tsx:57–94`, `mobile-sticky-action.tsx`,
`root.tsx` urql/auth wiring, `use-user.ts`, `contact/*` formuláre, `information-step.tsx` guest
e-mail flow, `index.css`, všetky `.graphql` + `codegen.ts`, mŕtve react-intl stub locales.

## 4. Copy / i18n stav

- V `src/checkout` je **nula next-intl** a **nula SK stringov** — SK zákazník dnes vidí checkout
  po anglicky; formátovanie peňazí/dátumov je pripnuté na default locale.
- v2 mechanizmus: next-intl (`providers/checkout-intl.tsx`), `load-messages.ts` seká bundle
  `checkout`+`account` namespaces, ~20 súborov `useTranslations`; kľúče summary/VAT už definované
  v upstream `messages/en.json` (`subtotal`:462, `taxVat`:464, `includingVat`:467).
- v2 shipuje **len de/en/fi/fr/nb/pl** → reálna copy práca = autorovať `sk` checkout katalóg
  (seed z MAKY `sk-SK.json` checkout/cart namespaces) + 13-locale parity (§11).
- „Secure checkout"/„30-day returns" intent (ak má ostať) patrí do v2
  `components/payment/payment-trust-signals.tsx` cez i18n — podmienené policy rozhodnutím (§10 otázok).

## 5. Auth touchpoints mimo checkoutu (čo zasiahne BFF foundation)

Prereq `2026-06-account-ppr-auth` (BFF: `/api/auth/login` + `resolveSessionUser` +
`session-auth-state`) je **nesplnený**. Blast radius je malý a enumerovateľný:

| Oblasť | Súbor | Impact |
|---|---|---|
| Choke point server auth | `src/lib/graphql.ts:227–242` (dyn. import `getServerAuthClient` → `fetchWithAuth`) | **rework** — prepnutie na session-bridge token source premigruje všetkých 12 non-checkout callerov (account pages/actions, cart actions, PDP add-to-cart, user-menu, lib/checkout) bez ich úprav |
| Client auth provider | `src/lib/auth/auth-provider.tsx` (auth-sdk + urql, non-HttpOnly cookies) | **replace** — mounty len 2 (`app/checkout/layout.tsx:13`, `login/page.tsx:75`), konzumenti len 2 (`login-mode.tsx`, `src/checkout/root.tsx`) |
| Server auth client | `src/lib/auth/server.ts` | **replace** — nahradí session-bridge; pozn.: ticho zahadzuje cookie writes v RSC render (lossy refresh) |
| Login UI | `src/ui/components/auth/login-mode.tsx:44` (`useSaleorAuthContext().signIn`) | **replace** — primárny konzument nového `/api/auth/login` |
| API routes | `register` (keep), `reset-password` (keep), `set-password` (**rework** — viď landmine) | |
| hasCookies gate ×3 | `login/page.tsx:55`, `account/layout.tsx:22`, `user-menu-container.tsx:10` | **replace** za `resolveSessionUser` — gate je fakticky vždy true (proxy.ts market cookie) |
| React.cache precedens | `account/get-current-user.ts` | presne tvar, ktorý `resolveSessionUser` zovšeobecní |
| Logout | `src/app/actions.ts:6–9` | rework na BFF session cookies |
| Account pages/actions, account-context | — | **keep** — už server-fetch pattern, zdedia rewire graphql.ts |
| Checkout handoff | `app/checkout/layout.tsx` + `src/checkout/root.tsx` (2 stacked urql provideri nad jedným SDK klientom) | **replace** — presne to, čo v2 session-bridge ruší |

**Landminy:** (a) `set-password/route.ts:78–96` nastavuje HttpOnly `token`/`refreshToken`,
ktoré **nikto nečíta** (session žije v auth-sdk cookies) → používateľ po resete NIE je reálne
prihlásený hoci UI tvrdí opak; navyše route **vracia raw token v JSON**. Opraviť ako prvý interný
konzument BFF login kontraktu. (b) Sign-in z `/account` beží bez AuthProvider wrappera
(default context) — podozrivá cesta, otestovať pred/po migrácii. (c) `checkoutId-{channel}`
cookie (`src/lib/checkout.ts`) nie je auth, ale session-bridge s ňou musí koexistovať; attach/merge
checkoutu pri logine dnes neexistuje.

## 6. Upstream cieľ (sumár) + detect výsledky

**MIGRATION.md (adopt-then-replay, marker `2026-06-checkout-v2`/`8c415655`):** prereq = BFF auth
+ transaction-API payment appky (Adyen sa neportuje). Kroky: (1) `(checkout)` route group +
`src/session-bridge/` (buildCheckoutPath, náhrada hardcoded `/checkout?checkout=` — u nás
`cart/checkout-link.tsx:15`); (2) storefront handoff + revalidateStorefrontChrome; (3) RSC entry
(page.tsx + checkout-session-loader + React.cache); (4) client data layer (CheckoutDataProvider,
server actions; zmazať urql provider + `src/_reference`; codegen len types/documents); (5) order
confirmation split na `/checkout/complete?order=` (`window.location.replace`, nikdy router.replace);
(6) shallow `?step=` history push; (7) payment registry (integrated-gateways.ts,
finalize-checkout-order, stripe-checkout-completion-host prežíva unmount kroku); (8) session
management (`SessionAuthState` guest/authenticated/unavailable — `me===null` ≠ odhlásený,
resolveSessionUser, loginWithBff); (9) replay fork customizácií na extension pointoch.
Vizuálny rebrand krokov = out of scope (fork classNames sa držia).

**Gateways kontrakt:** `INTEGRATED_GATEWAYS` = priority-ordered registry
`{type, submitMode, findGateway, isEnabled, matchesGateway}`; `resolvePaymentProvider()` vyberie
prvý enabled match z `availablePaymentGateways`. Stripe: id **`saleor.app.payment.stripe`**,
submitMode `client`; env `NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS` + `ENABLE_STRIPE_PAYMENTS` (server
mirror) + `NEXT_PUBLIC_ENABLE_STRIPE_EXPRESS_CHECKOUT`; publishable keys zo Saleor
`paymentGatewayInitialize`, nie z env; transactionInitialize musí niesť
`paymentGateway.data.paymentIntent.paymentMethod` (nikdy „unknown"). Dummy dev app:
`saleor.io.dummy-payment-app` + `ALLOW_DUMMY_PAYMENT` + server-action guard. Spoločné primitívy
(updateCheckoutBilling pred charge, live total validation, finalizeCheckoutOrder) sa nesmú
reimplementovať per-gateway. Anti-patterny: žiadny mock card-form fallback, žiadna generická PSP
abstrakcia.

**detect.md — spustené (všetky snippety overené ako read-only):**

| Check | Výsledok |
|---|---|
| NEEDS: urql/useCheckoutQuery v checkout runtime | 🔴 4 hity (root.tsx:10, use-safe-mutation.ts:2, use-checkout.ts:4,16) → migrácia NUTNÁ |
| NEEDS: `app/checkout` bez `(checkout)` route group | 🔴 potvrdené |
| NEEDS: chýba `src/session-bridge` | 🔴 potvrdené |
| NEEDS: confirmation vnútri /checkout (žiadny `/checkout/complete`) | 🔴 potvrdené |
| NEEDS: `src/_reference` existuje | 🟠 zmazať v kroku 4 (žiadne MAKY customizácie na ňom nevisia) |
| APPLIED markery A–E (session-loader, search-params, complete route, actions.ts, CheckoutDataProvider) | 🔴 všetkých 5 fail |
| APPLIED marker F (žiadny useCheckoutQuery) | ⚠️ nominálne PASS, ale je to **bug v upstream snippete** (`grep -q` + pipe → pipeline vždy 0); reálne NOT applied (viď NEEDS #1). Kandidát na upstream report. |

`verify.md` (nespúšťané — post-migračné): `tsc --noEmit` + `pnpm test src/checkout` + 8-bodový
manuálny checklist + voliteľný multi-channel build.

## 7. Friction sken

| Friction | Téma | Zistenie |
|---|---|---|
| 🔴 HIGH | Routing kolízia | MAKY `src/proxy.ts` (post-fork, commit `98127a0`; fork point nemal middleware) — geo/cookie market detection, friendly `/{sk}` → `sk-eur` rewrite, single-segment `[channel]` strom — vs v2 `src/middleware.ts` + `(storefront)/[locale]/[channel]` + `(checkout)` groups + session-bridge (`NEXT_PUBLIC_CHECKOUT_URL`: 0 lokálnych výskytov). Najväčšie architektonické rozhodnutie adopcie. |
| 🔴 HIGH | urql v checkoute | celý checkout = legacy browser-urql architektúra (barel `graphql/index.ts:9` → 27 konzumentov); v2 to explicitne nepodporuje → subsystem replacement, nie file-by-file port |
| 🔴 HIGH | Dependencies | TW **4.2.2 vs 3.4.19** (najväčší delta — class re-verifikácia + bridge); `@stripe/*` len upstream (doplniť); next 16.1.2→16.2.9; next-intl 4.8.3→4.13.0; react ^19.1.2→^19.2.7; engines local `>=20 <21` vs upstream `24.x` — **server už beží node v24.15.0** (local engines pole je už dnes v rozpore s runtime; pri alignmente zosúladiť, žiadny server upgrade netreba) |
| 🟢 LOW | Codegen | MAKY codegen nezmenil; v2 config je čistý drop-in (split `operations.ts` server-safe + `index.ts` client hooks, `withHooks:false`/`documentMode` zmeny; skripty v package.json byte-identické) |
| 🟢 LOW | next.config | takmer identické (cacheComponents:true oba); upstream navyše: `cacheLife` profily (`paperCacheLifeProfiles`), `allowedDevOrigins`, `images.formats:["image/webp"]`; jediná MAKY zmena = explicitná cesta v next-intl plugine |

## 8. Navrhované poradie adopcie/replay

0. ✅ Tento inventár.
1. **Dep alignment** (next 16.2.9, react 19.2.7, next-intl 4.13, engines 24.x, `@stripe/*`) —
   build výlučne v worktree/klone, nikdy v živom `/opt/storefront` (§13).
2. **BFF auth foundation** — `/api/auth/login`, `resolveSessionUser`, `session-auth-state`;
   rewire `graphql.ts:229–230`; nahradiť AuthProvider mounty + 3× hasCookies; fix set-password
   dead-cookie bloku; logout na BFF cookies.
3. **Routing/session-bridge rozhodnutie + implementácia** (otázka O1 nižšie) — adaptovať
   session-bridge na MAKY market scheme; nahradiť hardcoded handoff `cart/checkout-link.tsx:15`.
4. **Adopcia v2 checkout stromu wholesale** (kroky 1–8 MIGRATION.md): route groups, RSC entry,
   server actions, confirmation split, `?step=` shallow, payment registry, session management;
   zmazať urql z checkoutu + `src/_reference`; v2 codegen.
5. **Replay MAKY (register §2):** marketHref v `navigateToStorefrontHome`/order-confirmation;
   rozšíriť brand.css bridge; TW3→TW4 class pass + §11 vizuálna verifikácia (build nepotvrdzuje
   tokeny!).
6. **Truthfulness pass na v2 (exclusion §3):** aktívne zmazať E1/E2/E7, neutralizovať E3,
   rozhodnúť E4 SK znenie; E5/E6/E8/E9 len overiť.
7. **sk checkout i18n katalóg** (+ 13-locale parity podľa §11 CLAUDE.md).
8. **Stripe zapnutie:** Track A app (2.6.9, `saleor.app.payment.stripe`) → env flagy → test
   matica (3DS/decline/cancel/closed-browser/duplicate/price-change) — podľa revidovaného
   Stripe specu (otázka O2).

## 9. Súčet odhadov

| Veľkosť | Počet | Položky |
|---|---|---|
| **S** | 12 | E1–E9 exclusion zásahy (9) + marketHref rework + SK glosár replay + next.config/codegen alignment |
| **M** | 4 | brand.css bridge extend · sk checkout katalóg · TW3→4 pass + vizuálna verifikácia · dep alignment |
| **L** | 2 | BFF auth foundation · routing/session-bridge zjednotenie |

Replay MAKY customizácií je triviálny (S); ťažisko = 2×L foundation + adopcia samotná.

## 10. Otvorené otázky pre Mareka

- **O1 (routing, L-rozhodnutie):** zachovať MAKY friendly market URLs `/{sk}` (adaptovať v2
  session-bridge + middleware na single-segment scheme) — odporúčam — alebo prejsť na v2
  `/{locale}/{channel}` (menej úprav v2 kódu, ale mení verejné URL + SEO)?
- **O2 (Stripe spec):** committed `feat-stripe-checkout-spec.md` je písaný na legacy checkout
  (ručný Payment Element, bez INTEGRATED_GATEWAYS) — potvrdiť revíziu na v2 cestu (hosting časť
  specu ostáva platná).
- **O3 (trust badges):** má checkout komunikovať „Secure checkout" + vrátenie (14 dní hosť /
  30 dní registrovaný)? Ak áno, presné SK znenie → v2 `payment-trust-signals` cez i18n.
- **O4 (E7):** čím nahradiť „Estimated delivery" na confirmation — vypustiť úplne, alebo neskôr
  reálny FedEx odhad?
- **O5 (i18n scope):** v2 checkout locales = sk + en interim pre ostatných 12 (parity invariant
  drží), plný preklad neskôr — OK?
- **O6 (cleanup) — VYRIEŠENÉ 2026-07-01:** `src/app/layout.tsx.bak` +
  `layout.tsx.pre-gtm-20260529-072922.bak` NIE sú committed (pôvodný nález bol nepresný) — sú to
  untracked/ignored súbory len na disku; git cleanup prebehol už v `389a040` (`*.bak` ignore).
  Overené: oba sú stale kópie historických verzií `layout.tsx`, plne obnoviteľné z git histórie.
  Jediné zostávajúce rozhodnutie: zmazať ich z disku obyčajným `rm` (bez commitu), alebo nechať —
  sú neškodné.
- **O7 (bug oprava pred migráciou?):** set-password dead-cookie + token-leak (§5 landmine a) —
  opraviť v rámci BFF auth (odporúčam) alebo ako hotfix skôr?
