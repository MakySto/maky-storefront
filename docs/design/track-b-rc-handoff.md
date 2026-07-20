# Track B — release-candidate stav + translation source freeze (2026-07-20)

> Git-tracked handoff. Nadväzuje na `krok2-3-handoff.md` (stav k 2026-07-19). Žiadne
> credentials — heslá a tokeny sa odovzdávajú výhradne mimo repa.

## 1. Referenčné SHA / build

| Artefakt                       | Hodnota                                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storefront branch              | `track-b/checkout-v2-payment`                                                                                                                      |
| Storefront základ tohto freeze | `d8c47b3` (feat(i18n): checkout money formatting follows the market locale)                                                                        |
| Translation source freeze      | commity nad `d8c47b3` na tej istej vetve (pozri `git log`)                                                                                         |
| SMTP repo                      | `maky-apps`, branch `maky-i18n-order-email`                                                                                                        |
| SMTP základ                    | `82467a57` (feat(smtp): locale-aware order e-mails) + freeze commity nad ním                                                                       |
| SMTP remote                    | `makysto` = `git@github.com:MakySto/maky-apps.git` — vetva JE pushnutá; pushuj tam, `origin` ostáva upstream `saleor/apps`                         |
| Staging                        | `https://staging.maky.store` → :3037, build z `d8c47b3`, BUILD_ID `q1r3bY8yAGERXJ-DNQ6S2` (worktree `wt-b43`; po zapracovaní freeze treba rebuild) |
| Prod                           | `maky.store` NEDOTKNUTÝ — `a2db881`, PM2 `maky-storefront` (:3000)                                                                                 |

## 2. Čo obsahuje translation source freeze (tento commit set)

Storefront:

- **Runtime closure:** `docs/i18n/commerce-source-en.json` pokrýva všetkých 354 kľúčov
  (234 storefront + 120 email; 345 production / 5 staging-only / 4 dormant). Každý
  storefront kľúč nesie `callSites`/`usageCount`/`runtimeStatus`; automatická brána
  `pnpm run i18n:check` (runtime closure, zdroje == katalóg, placeholder registry,
  ICU plurály per-locale, hardcoded-exceptions ledger, locale-matrix drift + live
  channels pri zadaných env `SALEOR_API_URL`+`SALEOR_APP_TOKEN`).
- **Právny order CTA:** `checkout.placeOrder` v manifeste ako `legallySensitive`
  (EN source „Place order with obligation to pay“; ostatné locales už niesli správne
  právne znenie). `dummyTestMode`, `notFullyPaid` a `interruptedAfterAuthorize` už
  necitujú label tlačidla — hovoria „tlačidlom nižšie“.
- **Customer-safe payment chyby:** žiadne inštrukcie o Saleor Dashboarde/webhookoch/
  Stripe kľúčoch ani raw gateway ID v zákazníckych textoch; technický detail ide do
  console/server logu. SK-only fallback mapa v payment lib nahradená EN-source mapou
  test-synchronizovanou s katalógom; guard sentinely sú nejazykové error kódy.
- **Placeholder opravy:** `checkout.steps.progress` = `{current}`/`{stepCount}`;
  `{confirmationEmail}` oddelený od `{email}`; registry je per-key
  (`commerce-placeholders.json`, generovaný z manifestu).
- **Ďalšie zdrojové opravy:** confirmation e-mail notice rozdelený (with-address +
  generic, pravdivý budúci čas, žiadne „sent“); `selectField` gramaticky neutrálny;
  `noMethodsForCountry` grammar-safe + `...Generic` variant; hu-HU `cart.items`
  doplnená `one` vetva; mŕtve dekoratívne wallet tlačidlá zmazané (kód aj katalógy);
  13 mŕtvych legacy kľúčov odstránených zo všetkých 13 katalógov; lokalizovaný
  `document.title` checkoutu (`checkout.meta.title`) po hydratácii; `common.close`
  v sheet plochách.

SMTP (`maky-apps`):

- **15 event families plne katalogizovaných** (EN+SK; subject, preheader, title,
  intro, outro/CTA per event) — per-event preheadery (koniec „order confirmed“
  leaku do refund/cancel/… e-mailov), event-aware enricher, subjects všetkých 15
  eventov `{{i18n.subject}}`.
- **Locale resolver** číta camelCase aj snake_case payloady (`order.channel_slug`,
  top-level `channel_slug` pre account eventy, `channel` string pre gift card).
- **Finančný súhrn:** `email.order.taxIncluded` = „Of which VAT“/„Z toho DPH“ POD
  totalom, renderuje sa len pri tax > 0 (Saleor TaxedMoney, nikdy sa nepripočítava);
  - `email.order.notTaxDocument` (receipt e-maily); `email.order.invoiceSeparate`
    existuje ako dormant (nerenderuje sa, kým fakturačný workflow nie je živý).
- **Seller footer** vo všetkých zákazníckych e-mailoch zo structured configu
  (`apps/smtp/src/modules/smtp/seller-config.ts` — hodnoty sa neprekladajú, labely
  IČO/DIČ/IČ DPH sú v katalógu). „Powered by Saleor Commerce“ odstránené.
- **Fulfillment** rozlišuje fyzickú vs digitálnu objednávku (`isShippingRequired`);
  refunded e-mail má poznámku, že súhrn zobrazuje pôvodnú objednávku.
- Testy: 256/256 (render coverage všetkých 15 rodín, tax>0/tax=0, digital/physical,
  snake_case locale, gift card, seller footer, žiadny „Powered by“, žiadny
  invoiceSeparate).

## 3. Persisted SMTP config (live) — stav + reset po deployi

- Backup: `/home/ubuntu/maky-backups/smtp-app-metadata-20260720-110811.json`
  (raw privateMetadata) + `/home/ubuntu/maky-backups/smtp-config-decrypted-20260720.json`
  (dešifrovaný SmtpConfig, chmod 600, MIMO git — obsahuje SMTP credentials).
- Live stav (2026-07-20): 1 konfigurácia „MAKY.STORE Transactional“ (active). Aktívne
  eventy: 13 z 15 — všetko okrem `ACCOUNT_SET_CUSTOMER_PASSWORD` a `GIFT_CARD_SENT`.
- ⚠️ **Duplicitný receipt je reálny:** `ORDER_CREATED` aj `ORDER_CONFIRMED` sú aktívne
  súčasne (a `ORDER_FULLY_PAID` tiež). Kanonické potvrdenie = **ORDER_CONFIRMED**
  (jediný plne lokalizovaný receipt; ORDER_CREATED má po freeze odlišné
  „prijali sme / čaká na potvrdenie“ znenie a NEMÁ byť aktívny).
- **Po SMTP deployi spusti** (stored config prepisuje code defaults pri odosielaní —
  samotný deploy e-maily NEZMENÍ):
  ```bash
  cd /opt/saleor-smtp-app/apps/smtp
  pnpm tsx --env-file-if-exists=.env ./scripts/reset-event-defaults.ts                # dry-run
  pnpm tsx --env-file-if-exists=.env ./scripts/reset-event-defaults.ts --apply --deactivate-order-created
  pm2 restart maky-smtp-app   # podľa bezpečného postupu; zhodí in-memory cache configu
  ```
  Skript si pred zápisom urobí vlastný timestamped backup a je idempotentný.

## 4. Otvorené acceptance položky (pred GO-LIVE)

1. **Manuálne v reálnom prehliadači (Radar hCaptcha blokuje headless):** 3DS
   click-through; Apple Pay (Safari + Wallet), Google Pay (Chrome + uložená karta),
   Link, Klarna sandbox redirect (success + cancel/failure; ak neprejde alebo sa pre
   SK neponúka → pre launch vypnúť, neblokovať ňou karty/wallety).
2. **Logged-in checkout** celý flow (účet marekkysucky@gmail.com je aktívny).
3. **SEPA acceptance na ČERSTVOM checkoute** (nová platobná session): nesmie sa
   ukázať v Payment Elemente ani ECE; hard refresh ju nevráti. Zdroj pravdy = Stripe
   konfigurácia (žiadny frontend blacklist).
4. **Payment Method Domains** `staging.maky.store` + `maky.store`: potvrdiť enabled
   v TEST **aj LIVE** mode (`livemode` flag per doména).
5. **13-locale bundle** od Mareka/ChatGPT z tohto freeze → aplikácia, strict parity,
   ICU/plural/placeholder gates, email snapshoty per locale (CLAUDE.md §11 parity
   invariant je do aplikácie bundle vedome porušený — 11 súborov čaká na preklady).
6. **Real-order render** `/checkout/complete` bol overený na teste; po bundle over
   aspoň jeden ďalší EU locale end-to-end.
7. **Doručiteľnosť:** testovací order-confirmation na Gmail + Outlook/Hotmail adresu,
   skontrolovať SPF/DKIM/DMARC v headeroch a doručenie do inboxu (nie spam);
   výsledok vrátane From/Return-Path domény zapísať do release reportu.
8. **Faktúry:** `INVOICE_SENT` je aktívny, ale nič negeneruje faktúry;
   `email.order.invoiceSeparate` ostáva dormant, kým sa nerozhodne fakturačný
   workflow (mimo CC scope — rozhodnutie Marek/účtovníctvo).

## 5. Účtovanie testovacích objednávok (produkčný Saleor!)

Staging aj prod zdieľajú backend `api.maky.store`. Objednávky **č. 1–8** sú staging
testy z 2026-07-19 (guest; 4242 ×6, decline, manuálny 3DS = č. 7) — ruší ich Marek
(spolu s 1–13 staršími testami podľa vlastnej evidencie). Tento freeze žiadne nové
objednávky nevytvoril. Každá ďalšia acceptance objednávka sa MUSÍ zapísať do release
reportu s číslom a krokom, v ktorom vznikla.

## 6. Deploy/rollback zásady (pre ďalšie kroky)

- **Rollback = swap, nie rebuild:** pred produkčným deployom
  `cp -a /opt/storefront/.next /opt/storefront/.next.rollback-a2db881`; rollback je
  prehodenie adresára + `pm2 restart` (sekundy). To isté pre SMTP app pred nasadením
  nových šablón (zachovať bežiaci build dir + config backup z §3).
- Storefront build NIKDY v `/opt/storefront` za behu PM2 (CLAUDE.md §13); build vo
  worktree, verify na spare porte, potom swap.
- **Rotácia hesiel pred produkciou:** staging Basic Auth aj heslo test účtu boli
  v chatoch — pred GO-LIVE obe vygenerovať nanovo; nové hodnoty NEPATRIA do repa ani
  do reportov (odovzdať samostatne).

## 7. Content STOP kontrakt

Po tomto freeze sa čaká na schválený 13-locale bundle (Marek/ChatGPT) vyrobený z:
`docs/i18n/commerce-source-en.json` + `docs/i18n/commerce-placeholders.json` +
`docs/i18n/commerce-locales.json`. Žiadne strojové preklady, žiadne EN kópie ako
„preklad“. Po dodaní bundle sa pokračuje bez nového plánovania: aplikácia → strict
parity → SMTP deploy + reset event defaults (§3) → staging acceptance → finálny
release-candidate report.

## 8. Stav k 2. behu (2026-07-20 popoludní)

- **Lifecycle aplikovaný:** Saleor `automaticallyConfirmAllNewOrders=false` (cez API);
  ORDER_CREATED = prijatie (jediný e-mail s daňovou/faktúrovou poznámkou), manuálny
  ORDER_CONFIRMED = spracúvame, FULLY_PAID OFF (matica v
  `apps/smtp/scripts/order-lifecycle.json`, aplikuje sa reset skriptom pri SMTP deployi);
  confirmation stránka „Objednávku sme prijali"; sk-SK `placeOrder` LOCKED (§4/8 z. 102/2014).
- **en-GB/gb-gbp odstránené** zo storefrontu, SMTP resolvera, matice aj gates (12 locales).
- **Deliverability PASS (Gmail):** test ORDER_CREATED doručený do INBOXU;
  From `info@maky.store`, odoslané z `pm-bounces.maky.store` (SPF align), DKIM podpis
  `maky.store`, TLS. DMARC zatiaľ `p=none` (odporúčanie: quarantine po launchi).
  Outlook adresa nebola k dispozícii — doplniť pri acceptance.
- **SEPA:** čerstvý TEST-mode PaymentIntent ju ponúka (`card, sepa_debit, klarna, link`),
  LIVE mode ju má podľa Mareka vypnutú — akceptované, riešenie výhradne v Stripe
  konfigurácii (žiadny frontend blacklist). Pri live canary over, že sa nezobrazuje.
- **Ancestry + právne stránky:** `a2db881` je predkom RC; `odstupenie-od-zmluvy` obsahuje
  vzorový §20a formulár. Prod rollback snapshot: `/opt/storefront/.next.rollback-a2db881`.
- **Pre-freeze runtime audit** (ChatGPT, 2026-07-20 ráno) committnutý ako
  `docs/i18n/commerce-copy-closure-audit.md` — drží B.6 truthfulness zoznam a medzeru
  samostatného auth/reset flowu (~67 EN literálov; vedome mimo Commerce Batch 1,
  vlastný `auth.*` manifest = budúca dávka).
- **BLOKER: prekladový bundle `maky-commerce-i18n-bundle.zip` stále nie je na VPS** —
  po dodaní: aplikácia 9 locales + overrides → 1 validačný beh → SMTP deploy + reset
  `--lifecycle` → staging rebuild → GO-LIVE report.

## 9. GO-LIVE runbook (opravený, 2026-07-20 večer — platná verzia)

RC = tag `sk-launch-rc1` (storefront `6e0e4e7`, SMTP `d756df58` — SMTP UŽ nasadený).
Rollback záloha storefrontu: **`/opt/.next.rollback-a2db881`** (mimo /opt/storefront,
prežije git clean; obnovuje sa `cp -a`, nikdy `mv`). `/opt/storefront` je na vetve
`feat/legal-content-pages` — rollback checkout VŽDY detached SHA, nie vetva.

### Pred-deploy kontroly (spustiť a zapísať do reportu)

```bash
git -C /opt/storefront worktree list && git -C /opt/storefront worktree prune
df -h /opt /tmp /home
test -d /opt/.next.rollback-a2db881 || { echo "ZALOHA CHYBA"; exit 1; }
```

### Deploy sekvencia (po „GO LIVE")

```bash
# 1. STAGING STRIPE-OFF (KROK, nie poznámka): vo worktree wt-b43 .env vypnúť
#    NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS aj ENABLE_STRIPE_PAYMENTS, rebuild, restart :3037
#    — staging nesmie po live prepnutí vedieť spraviť reálnu platbu.
# 2. Stripe LIVE switch (Marek, dashboard/Saleor Stripe app config pre sk-eur).
# 3. Live payment-set probe (čerstvý checkout → PaymentIntent payment_method_types,
#    livemode:true) — aktívny set do reportu; SEPA sa v LIVE nesmie objaviť.
#    (Test mode SEPA gate ZRUŠENÝ — v teste ostáva zámerne zapnutá.)
# 4. Prod .env: PRED buildom doplniť NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS=true
#    a ENABLE_STRIPE_PAYMENTS=true (NEXT_PUBLIC_* sa inlinuje pri kompilácii!).
test -d /opt/.next.rollback-a2db881 || { echo "ZALOHA CHYBA"; exit 1; }
pm2 stop maky-storefront
cd /opt/storefront
git fetch origin && git checkout -f --detach sk-launch-rc1
pnpm install --frozen-lockfile && pnpm run generate:all
rm -rf .next && pnpm run build
pnpm exec next start -p 3032   # verify: štýly + CSS 200, potom proces zabiť
pm2 start maky-storefront      # verify :3000 aj https://maky.store/sk
```

### Rollback (sekundy, swap)

```bash
test -d /opt/.next.rollback-a2db881 || { echo "ZALOHA CHYBA"; exit 1; }
pm2 stop maky-storefront
cd /opt/storefront
git checkout -f --detach a2db881
rm -rf .next && cp -a /opt/.next.rollback-a2db881 .next
pm2 start maky-storefront
```

SMTP rollback: `pm2 stop maky-smtp-app` → `git -C /opt/saleor-smtp-app checkout -f
maky-postmark-tls12` → `rm -rf apps/smtp/.next && cp -a apps/smtp/.next.rollback-040f947d
apps/smtp/.next` → `pm2 start maky-smtp-app`; config backupy:
`apps/smtp/smtp-config-backup-2026-07-20T14-05-44-243Z.json` + `/home/ubuntu/maky-backups/`.

### Druhý release po SK launchi

Bundle `/home/ubuntu/maky-commerce-i18n-bundle.zip` (overený: zip OK, 9×234 storefront +
9×120 email kľúčov, lifecycle config zhodný s aplikovaným; jediný rozdiel GIFT_CARD_SENT
enabled+onlyWhenUsed vs. náš OFF — zapnúť pri prvom použití gift kariet) sa aplikuje ako
samostatný release: merge 9 locales + overrides (sk-SK placeOrder NEMENIŤ — §4/8 z. 102/2014)
→ i18n gates → build → staging → deploy.

### Deliverability

Gmail PASS (inbox, SPF align pm-bounces.maky.store, DKIM maky.store, TLS);
Outlook test odoslaný na marekkysucky@hotmail.com (250 queued) — over inbox + hlavičky.

## 10. Release 2 — wallet defaults + i18n content (2026-07-20 noc)

**Stav: STAGING NASADENÝ, čaká na Marekovu vizuálnu kontrolu a výslovný pokyn
na produkčný deploy. Prod (:3000) beží ďalej nezmenený na `sk-launch-rc1 @ 6e0e4e7`
/ BUILD_ID `qjrYM0S4qBaauXHa0qE0T`, SMTP `d756df58`.**

### Scope — 2 zmeny, 1 release

1. **Express Checkout wallet defaulty** (`4b2b90d`): odstránený
   `paymentMethods: { applePay: "always", googlePay: "always" }` override —
   Stripe defaulty (`auto`): Safari ukáže Apple Pay, Chrome Google Pay, Edge
   ani jedno; Link ostáva `auto`. Overené: `"always"` už nie je v klientskych
   chunkoch buildu.
2. **Translation bundle `2026-07-20.2`** (integrita: 28/28 sha256 OK):
   9 storefront + 9 e-mail katalógov, en/sk overrides, en-GB/gb-gbp bol už
   odstránený skôr (0 referencií). SK ostáva jediný launch-ready market
   (`launchStatus` ostatných = `pending`).

### SHAs / vetvy (obe pushnuté)

- **storefront** `track-b/i18n-content-release` (z 6e0e4e7):
  `4b2b90d` wallet fix → `fb4d991` bundle apply → `1b32695` e-mail manifest
  lockstep → `2d6a99e` docs (§9 cherry-pick z 3dcd24f) → report commit (tip).
- **SMTP** `maky-i18n-content-release` (z d756df58):
  `6c17aa7e` katalógy + en/sk → `0318ce91` lint/vitest scope hygiene.
- **staging**: BUILD_ID `8MkJa4EM-6ITyCS01e1Js`, Stripe-OFF
  (`NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS=false` + `ENABLE_STRIPE_PAYMENTS=false`
  zapečené v builde), beží z `/home/ubuntu/wt-release` na :3037.
  Reštart po výpadku: `cd /home/ubuntu/wt-release && nohup pnpm exec next start
-p 3037 > staging-3037.log 2>&1 &` (nie je pod PM2!).

### ⚠️ AWS kernel reboot 21:57

Server sa počas release reštartol (kernel 1017→1019-aws). PM2 oba prod procesy
vzkriesil (BUILD_ID nezmenené), ale `/tmp` worktrees (wt-b43, pôvodný wt-release)
zanikli — preto staging odteraz beží z perzistentného `/home/ubuntu/wt-release`.
Release commity boli v git object DB, nič sa nestratilo.

### sk-SK storefront overrides — presný diff (ŽIVÝ TRH)

| kľúč                                           | doteraz (prod)                                          | po release                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `cart.shippingNextStepNote`                    | „Cena dopravy sa vypočíta v ďalšom kroku"               | „Doprava sa vypočíta v pokladni."                                                                                         |
| `checkout.confirmation.emailNoticeWithAddress` | „Potvrdenie objednávky pošleme na {confirmationEmail}." | „Potvrdenie o prijatí objednávky pošleme na {confirmationEmail}."                                                         |
| `checkout.confirmation.emailNoticeGeneric`     | „Potvrdenie objednávky pošleme na váš e-mail."          | „Potvrdenie o prijatí objednávky vám pošleme e-mailom."                                                                   |
| `checkout.confirmation.emailLabel`             | „Potvrdzujúci e-mail"                                   | „Potvrdenie o prijatí objednávky"                                                                                         |
| `checkout.confirmation.confirmedTitle`         | „Objednávku sme prijali"                                | bez zmeny (dd3aee1 už aplikoval)                                                                                          |
| `checkout.placeOrder`                          | **„Objednať s povinnosťou platby"**                     | **PRESKOČENÉ — bez zmeny** (bundle chcel „Objednať a zaplatiť"; kľúč je zákonne locknutý, §4 ods. 8 z. č. 102/2014 Z. z.) |

en-US zdroj analogicky (receipt wording + `placeOrder` → „Order and pay",
čo je pre EN prípustné) s lockstep updatom 5 manifest sources.

### SMTP sk.json — 8 zmien (approved bundle refinements)

`orderCreated.preheader`, `orderConfirmed.preheader` (presnejšie „skontrolovali
a začali spracúvať"), `orderFullyPaid.outro`, `orderRefunded.subject/preheader/
intro` („Spracovali sme vrátenie platby za…"), **`orderRefunded.outro` — vypúšťa
pevný sľub „5 – 10 pracovných dní", nahrádza „Čas pripísania peňazí závisí od
poskytovateľa platby."** (presne podľa požiadavky), `orderFulfilled.preheader`
(„odovzdali dopravcovi"). Subjecty/šablóny sú v stored configu i18n-driven
(dokázané objednávkami č. 14/15 v SK) — reset-event-defaults NIE JE potrebný,
katalógové zmeny tečú per-send.

### SMTP en.json + 9 katalógov

en: 60 hodnôt (schválený en-email zdroj s manual-review lifecycle). Katalógy:
`cs, es, fr, hu, it, pl, ro` (bare id, prefix-match pokryje regionálne varianty)

- `de-DE`, `de-AT` (plné id, regionálne identity). Registrované v
  `enrich-order-payload.ts`; resolver bez zmeny. Kľúčová parita 120/120 ×9,
  placeholder tokeny ⊆ en zdroja (overené skriptom). Poznámka: bundle pridáva
  `{newEmail}` do 2 account-change preheaderov (en + 9 locales; sk override ho
  nemá — sk preheader token nepoužíva, žiadne literálne `{}` riziko).

### Validačný beh (jeden, kompletný)

| check                                    | výsledok                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| bundle sha256 integrita                  | 28/28 OK                                                                                                              |
| JSON parse + exact key parity            | 9×425/425 storefront (missing 0/extra 0), 9×120/120 email                                                             |
| placeholder parity                       | 0 nezhôd (135 kontrol ×9 locales storefront; email subset-check OK)                                                   |
| ICU plurál                               | cs/ro +few, pl +few+many, fr +many — CLDR správne; gate per-locale PASS                                               |
| no-English-fallback                      | 9 locales po merge 0 chýbajúcich commerce kľúčov (en-CA zámerne dedí en-US — 211 kľúčov cez runtime merge, nie súbor) |
| i18n gates (`i18n:check` + SMTP_APP_DIR) | closure OK (354), matrix OK (12)                                                                                      |
| storefront tsc / eslint / vitest         | 0 chýb / 0 chýb (4 pre-existujúce warningy) / 194/194                                                                 |
| SMTP tsc / eslint / vitest               | PASS / PASS 0 chýb / 256/256 (28 súborov), snapshoty aktualizované na schválené znenie                                |
| production build (staging artefakt)      | OK, BUILD_ID `8MkJa4EM-6ITyCS01e1Js`                                                                                  |
| e-mail snapshoty + HTML preview          | `email-previews/index.html` vygenerované (15 rodín)                                                                   |
| staging smoke                            | /sk /cz /hu /de 200, CSS 200, BUILD_ID servovaný, nginx 401 auth wall OK, prod :3000 nedotknutý                       |

Hygiene fix popri validácii (`0318ce91`): eslint OOM-padal na 546 MB
`.next.rollback-*` snapshote a vitest zbieral skompilované `*.test.js` z
`.next*` — obe tooling-scope opravy, žiadna zmena logiky.

### Produkčný deploy (VYKONAŤ AŽ PO POKYNE)

Storefront (per §9 postup):

```bash
test -d /opt/.next.rollback-a2db881 || echo ABORT
git fetch origin
pm2 stop maky-storefront
cp -a .next /opt/.next.rollback-6e0e4e7          # nový rollback bod (RC1)
git checkout -f --detach <release-tip-SHA>        # = origin/track-b/i18n-content-release
pnpm install --frozen-lockfile && pnpm run generate:all
# .env NEMENIŤ (prod flagy Stripe ON ostávajú)
rm -rf .next && pnpm run build
pnpm exec next start -p 3032   # smoke: styled + CSS 200, potom kill
pm2 start maky-storefront      # verify :3000 + https://maky.store/sk
```

SMTP:

```bash
cd /opt/saleor-smtp-app && pm2 stop maky-smtp-app
cp -a apps/smtp/.next apps/smtp/.next.rollback-d756df58
# vetva maky-i18n-content-release je už checknutá
pnpm --filter saleor-app-smtp build && pm2 start maky-smtp-app
```

Rollback: storefront `git checkout -f --detach 6e0e4e7` + `cp -a
/opt/.next.rollback-6e0e4e7 .next` + `pm2 start`; SMTP analogicky
`d756df58` + `.next.rollback-d756df58`. Snapshot `a2db881` ostáva ako
posledná pred-RC1 poistka.

### Klarna

Ostáva ZAPNUTÁ (Stripe App konfigurácia sa týmto release nemení). Pri Marekovej
reálnej Klarna objednávke sledovať: PM2 logy oboch appiek, Saleor order
(Fully paid + Unconfirmed, 1 transakcia), presne 1 ORDER_CREATED e-mail,
návrat z redirect flow na confirmation stránku.
