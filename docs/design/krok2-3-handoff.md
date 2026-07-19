# Krok 2 + Krok 3 — handoff pre nové vlákno (písané 2026-07-19)

> Samostatný kontext pre čerstvé CC vlákno. Prečítaj CELÝ tento doc + `track-b-master-plan.md` §0
> + memory `project-stripe-checkout-v2-migration.md` (sekcia 2026-07-19). Kroky vykonávaj bez
> čakania na schválenie; zastav len pri credential/dashboard/live-money akciách.

## 0. Stav (ground truth k 2026-07-19)

- **Branch `track-b/checkout-v2-payment @ 8b4b680`** (pushnuté; over `git ls-remote`). Obsahuje:
  B.4.4 payment registry → B.4.5 session mgmt → B.6 truthfulness → B.7 SK checkout → B.8 Stripe
  Elements (test mode) → cart-drawer i18n (13 locales) → **krok 1** (immediate shipping save,
  pay-button pod fakturáciou, fake ECE preč, newsletter checkbox preč, `localizeCountryName`
  cez `Intl.DisplayNames("sk")`, inert stepper na confirmation, dedup „(nepovinné)").
- **Staging: `https://staging.maky.store`** — nginx `/etc/nginx/conf.d/storefront-staging.conf`
  (vlastný LE cert, X-Robots-Tag noindex) → proxy na `127.0.0.1:3037` = `next start` z worktree
  `/tmp/claude-1000/-opt-storefront/91d80f5a-…/scratchpad/wt-b43` (ak worktree zmizol po reboote:
  nový worktree z tipu, `pnpm install --frozen-lockfile`, do `.env` pridať OBA flagy
  `NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS=true` + `ENABLE_STRIPE_PAYMENTS=true` (build-time!),
  `rm -rf .next && pnpm run build`, `next start -p 3037`). ⚠️ `.env` vo worktree má flagy
  duplicitne (2×) — funkčne OK, pri príležitosti zdedupovať.
- **Prod maky.store NEDOTKNUTÝ** — `a2db881`, PM2 `maky-storefront` (:3000). Platia §10/§13
  CLAUDE.md (nikdy nebuildovať v /opt/storefront za behu PM2; :3032 = cudzí proces).
- **Overené E2E (staging, test mode):** objednávky č. 1–8 (guest; 4242 success ×6, decline,
  Marekov manuálny 3DS = č. 7). Refresh confirmation = 0 nových transakcií. Saleor:
  FULLY_CHARGED/isPaid. **NEOVERENÉ: logged-in checkout, Klarna redirect.**
- Stripe kontrakt (live-probed): gateway `saleor.app.payment.stripe`, pk_test cez
  `paymentGatewayInitialize`, `transactionInitialize(data.paymentIntent.paymentMethod)` →
  `stripeClientSecret`; všetko na public ceste (checkout-id-is-credential).

## 1. Krok 2 — locale plumbing + i18n manifest (vedomé prekročenie static-sk)

Static-sk (variant C zjednodušenie) sa VEDOME nahrádza centrálnou market konfiguráciou.
`proxy.ts`/routing/markety sa NEMENIA — mení sa len to, ako checkout odvodzuje jazyk/menu.

1. **Centrálny market config** (rozšír `src/lib/channel-map.ts` alebo nový modul):
   channel slug → storefront locale → Saleor `LanguageCodeEnum` → Stripe Elements locale →
   currency. Jediný zdroj pravdy pre všetkých 13 trhov.
2. **Checkout jazyk:** pri checkoutCreate nastav `languageCode` z configu; pri existujúcom
   checkoute/zmene marketu `checkoutLanguageCodeUpdate` (nová mutácia v checkout.graphql +
   `pnpm generate:checkout`). Checkout RSC provider číta locale z `checkout.languageCode`;
   confirmation z `order.language/channel`. Stripe Elements dostane explicitný podporovaný
   locale z configu (dnes hardcoded `"sk"` v `stripe-payment.tsx` buildElementsOptions).
   Static-sk závislé súbory (9): `src/lib/checkout-locale.ts` + `checkout-app.tsx`,
   `checkout-session-loader.tsx`, `lib/actions.ts`, `lib/server/fetch-checkout.ts`,
   `lib/server/fetch-order.ts`, `app/checkout/complete/page.tsx`,
   `components/payment/stripe/stripe-payment.tsx`, `stripe-payment-form.tsx`.
3. **Export všetkých customer-facing textov** (checkout je dnes hardcoded SK — B.7):
   cart drawer, Information/Shipping/Payment, summaries/errors/loading, confirmation route,
   payment/gateway message mapy (`use-checkout-gateway-messages.ts`,
   `use-checkout-payment-messages.ts`), `lib/actions.ts` *_MESSAGE konštanty,
   `lib/payment/*` user-facing konštanty (checkout-payment-completion, format-checkout-
   complete-error, providers/dummy+stripe), SMTP order-confirmation e-mail (maky-apps repo).
   Stabilné semantic keys + ICU placeholdery/plurály. Preklady NEVYMÝŠĽAŤ — výstup je
   **canonical manifest**: `docs/i18n/commerce-source-en.json` (EN source of truth) +
   `docs/i18n/commerce-placeholders.json` (placeholder registry). Finálne preklady dodá
   Marek/ChatGPT z manifestu.
4. **Newsletter checkbox VRÁTIŤ ZAPOJENÝ** (Marek ho chce): checkout metadata
   (`checkoutMetadataUpdate` mutácia + regen; vzor upstream `updateCheckoutMarketingConsent`
   v `app/(checkout)/actions.ts` — MAKY nemá metadata mutáciu, treba pridať).

## 2. Krok 3 — SMTP e-mail + preklady + finálna acceptance

- **SMTP app = repo `maky-apps`, iný box/proces (`maky-smtp-app` PM2, NIKDY nereštartovať
  bez postupu).** Jedna zdieľaná štruktúra e-mailu (nie 13 kópií HTML); locale resolver
  `order.channel.slug` + `order.languageCodeEnum`; žiadne „Slovakia EUR"; skryť „Default"
  variant; locale-aware currency formatting; summary subtotal+shipping=total; daň AŽ POD
  totalom ako „Z toho DPH"; subject/preheader/HTML/plain z katalógu.
- **Testy:** exact key parity všetkých locale súborov; placeholder parity; build fail pri
  chýbajúcom kľúči; email render snapshot per locale; test „shipping selection okamžite
  aktualizuje total"; sweep na hardcoded customer-facing EN stringy.
- **Finálna matica na stagingu:** guest + **logged-in** (účet marekkysucky@gmail.com vznikol
  pri obj. č. 5; logged-in cesta: contact section → sign-in → customer-attach → saved
  addresses), Klarna redirect (return cez existujúci handler `use-stripe-return-completion` —
  params `payment_intent`+`redirect_status`; otestovať zvlášť!), 3DS, decline, refresh-resume.
- ⚠️ **3DS/Klarna NEautomatizovať headless** — Stripe Radar hádže invisible hCaptcha na
  datacenter/headless (CAPTCHA sa NIKDY neobchádza). Manuálne v reálnom browseri.

## 3. Marekove dashboard úlohy (mimo repo — pripomenúť mu)

1. Stripe → Settings → Payment methods: zapnúť card, Link, **Klarna**, Apple Pay, Google Pay;
   vypnúť Bancontact/MB WAY/Satispay. (Klarna: SK merchant + EUR OK; redirect metóda.)
2. Stripe → Payment method domains: registrovať `staging.maky.store` AJ `maky.store`
   (Apple Pay bez toho nefunguje; Apple Pay sa ukáže len v Safari, Google Pay v Chrome
   s uloženou kartou — v Edge sa wallety nemusia zobraziť VÔBEC, to je korektné správanie
   Stripe ECE, nie bug).
3. Stripe upozornenie „Multiple capabilities paused — a required task is past due" — vybaviť
   (blokuje LIVE, sandbox beží; spracovanie trvá dni).
4. Zrušiť/ignorovať test objednávky č. 1–8 v Saleore pred ostrým reportingom.

## 4. Prostredie — gotchas (nezopakuj chyby)

- Shell `cd` sa medzi príkazmi resetuje na /opt/storefront → vždy explicitný `cd $WT`.
- `pkill -f "<pattern>"` zabije SÁM SEBA, ak pattern je v jeho vlastnom cmdline → kill cez
  PID z `ss -tlnp` alebo bracket-trick `[.]`.
- `kill $(cat pidfile)` po `(nohup pnpm exec next start &)` zabije len pnpm wrapper —
  next-server prežije; kill podľa `ss -tlnp | grep 3037`.
- Playwright headless: `scratchpad/headless/` (playwright + arm64 chromium; sys deps už
  nainštalované). E2E skript `smoke-stripe.mjs` (BASE/CARD/TAG env).
- Prekladové workflow agenty a git hooky (lint-staged/prettier) reformátujú súbory — commituj
  cez `git add` konkrétnych ciest.
- localhost.run/serveo tunely už NETREBA (staging vhost existuje).

## 5. Definícia hotového (release candidate)

Zelený push `track-b/checkout-v2-payment` + manifest committed + staging rebuild + Marekov
manuálny acceptance celej matice na stagingu. Live kľúče/produkčný deploy = samostatné
rozhodnutie Mareka (§13 postup, §20a withdrawal gate).
