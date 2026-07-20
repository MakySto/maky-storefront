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
