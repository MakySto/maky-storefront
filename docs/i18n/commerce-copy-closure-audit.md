# Commerce copy runtime closure audit

Audit date: 2026-07-20
Result: **not ready to send the complete commerce manifest to translation**

## Executive verdict

The current commerce source is internally consistent, but it is not runtime-closed.

- The source manifest contains 231 keys: 214 storefront keys and 17 email keys.
- 230 manifest keys have a static callsite; one key has no callsite.
- Five of the 230 callsite-used keys are in dormant or superseded checkout UI.
- Runtime checkout/cart code uses 22 locale keys that are absent from the source manifest.
- The most important missing key is checkout.placeOrder. Its Slovak value is the legally sensitive order-with-payment-obligation wording.
- Cart drawer and cart page are translated at runtime, but 14 of their active keys are outside the manifest.
- Only ORDER_CONFIRMED and its shared order-summary labels are catalogized in the SMTP app. The other 14 transactional event families still use hardcoded English defaults.
- The standalone login, sign-up and reset-link flow is not under an auth manifest; it contains approximately 67 distinct user-facing static literals.
- Existing EN/SK catalogs have key parity with their respective manifest subsets, and the placeholder registry is syntactically complete. Two placeholder names are nevertheless semantically overloaded.

Safe conclusion: do not send all 231 current keys as Batch 1. The 184 keys classified stable_now are safe source candidates, but the closure gaps and source rewrites below should be resolved before freezing the actual translation package.

## Audited revisions and boundaries

The checked-out workspace was feat/legal-content-pages at a2db881, while the supplied handoff identifies Track B. To avoid switching or mutating the worktree, this audit read the target git objects directly:

| Scope                      | Audited revision                                                        |
| -------------------------- | ----------------------------------------------------------------------- |
| Storefront Track B         | track-b/checkout-v2-payment at d8c47b312e6c4d9dc9c83701942fb536ffaab7f5 |
| Commerce manifest baseline | f63e5d6                                                                 |
| Cart localization baseline | 5832e15                                                                 |
| SMTP i18n branch           | maky-i18n-order-email at 82467a57                                       |

Audit scope:

- checkout information, address, shipping, payment and confirmation;
- cart drawer and full cart page;
- checkout authentication/reset sub-flow and standalone login/sign-up/reset pages linked by email;
- storefront EN/SK locale catalogs;
- commerce-source-en.json, commerce-placeholders.json and commerce-locales.json;
- all SMTP transactional event types and default templates.

This was a static, read-only source audit. It did not:

- call a live Saleor API, Stripe API, SMTP provider or production database;
- verify persisted SMTP templates stored in event settings;
- exercise runtime branches in a browser;
- deploy, run PM2, build under /opt, or use live credentials;
- create translations for the remaining locales.

The only repository change produced by this task is this report.

## Method

The audit resolved literal translation calls, mapped dynamic key tables and server-action translator keys, then compared the resulting runtime set with the source manifest, EN/SK catalogs and placeholder registry. Hardcoded JSX/TS strings, metadata, aria labels, fallback strings, backend/provider error pass-through and SMTP template text were inventoried separately.

“Used” below means a static callsite exists. “Active” excludes five clearly dormant/superseded UI keys. Static analysis cannot prove every exceptional branch was executed.

## Count summary

The rows use different universes and must not be added together.

| Metric                                            |    Count | Meaning                                                                  |
| ------------------------------------------------- | -------: | ------------------------------------------------------------------------ |
| Manifest keys                                     |      231 | 214 storefront + 17 email                                                |
| Manifest keys with a callsite                     |      230 | 213 storefront + all 17 email keys                                       |
| Manifest keys with no callsite                    |        1 | checkout.common.loading                                                  |
| Dormant/superseded callsite keys                  |        5 | Four legacy Express Checkout labels and one demo confirmation banner     |
| Active/reachable manifest keys                    |      225 | 230 minus the five dormant keys                                          |
| Runtime locale keys missing from manifest         |       22 | 14 cart + 7 address labels + checkout.placeOrder                         |
| Locale-only scoped keys not used at runtime       |       13 | Existing EN/SK values, but no scoped callsite                            |
| Explicit hardcoded checkout/cart customer strings |       12 | Loader, metadata, TEST marker, nine SK payment fallbacks                 |
| Standalone auth/reset hardcoded literals          | about 67 | Distinct user-facing static literals after excluding technical constants |
| SMTP hardcoded visible English literals           |       69 | Default copy across 14 event families plus shared fragments              |
| Existing manifest keys deferred to B.6            |        6 | Truthfulness/configuration verification                                  |
| Existing manifest keys deferred to B.7            |        1 | i18n wiring/normalization                                                |
| Existing manifest keys deferred to B.8            |        5 | Stripe/legacy payment UI                                                 |
| Existing manifest keys needing rewrite            |       19 | Includes one email label                                                 |
| Existing manifest keys needing email review       |       16 | Remaining current email keys                                             |
| Existing manifest keys stable now                 |      184 | Safe source candidates, subject to final package closure                 |

## Stability status definitions

| Status                     | Meaning                                                        |
| -------------------------- | -------------------------------------------------------------- |
| stable_now                 | Source meaning is clear enough to translate now.               |
| rewrite_before_translation | Rewrite or split the EN/SK source first.                       |
| deferred_B6_truthfulness   | Wording depends on verified business/configuration truth.      |
| deferred_B7_i18n           | Runtime i18n wiring or error normalization is not closed.      |
| deferred_B8_stripe         | Stripe-owned, legacy or superseded payment UI; settle in B.8.  |
| email_review_needed        | Current email key belongs to a still-incomplete email catalog. |
| missing_from_manifest      | Runtime or proposed source key is not in the manifest yet.     |

## A. Manifest keys present and used

There are 230 manifest keys with a static callsite. The per-key appendix records each status.

- 213 are storefront callsite keys.
- 17 are email catalog keys.
- Five are technically called only by dormant/superseded components and are not counted as active: checkout.payment.expressCheckout, checkout.payment.payWithApplePay, checkout.payment.payWithGooglePay, checkout.payment.orContinueBelow and checkout.confirmation.demoBanner.

## B. Manifest keys present but unused

| Key                     | Finding                                                                                        | Recommendation                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| checkout.common.loading | No translation callsite. The shared loader instead defaults to hardcoded Slovak “Načítavame…”. | Wire the loader to this key or move the common loader into the global common namespace. Status: deferred_B7_i18n. |

Locale keys that exist outside the manifest and have no scoped runtime callsite:

- cart.tax
- cart.quantity
- cart.itemAdded
- checkout.title
- checkout.contact
- checkout.shippingAddress
- checkout.shippingMethod
- checkout.review
- checkout.email
- checkout.company
- checkout.orderConfirmation
- checkout.orderNumber
- checkout.confirmationEmail

checkout.title is semantically useful because checkout metadata currently hardcodes “Pokladňa”; it is unwired rather than necessarily obsolete. The remaining keys should either gain a documented owner/callsite or be removed from the future translation package.

## C. Runtime keys missing from the manifest

All 22 keys below are already used through the locale runtime but absent from commerce-source-en.json. Their current EN/SK values are shown as source candidates.

| Recommended key         | EN source candidate                                     | SK canonical candidate                                              | Notes                                                 |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| cart.yourCart           | Your cart                                               | Váš košík                                                           | missing_from_manifest                                 |
| cart.subtotal           | Subtotal                                                | Medzisúčet                                                          | missing_from_manifest                                 |
| cart.shipping           | Shipping                                                | Doprava                                                             | missing_from_manifest                                 |
| cart.shippingAtCheckout | Calculated at checkout                                  | Vypočíta sa v pokladni                                              | missing_from_manifest                                 |
| cart.checkout           | Proceed to checkout                                     | Prejsť k pokladni                                                   | CTA; missing_from_manifest                            |
| cart.continueShopping   | Continue shopping                                       | Pokračovať v nákupe                                                 | missing_from_manifest                                 |
| cart.emptyCart          | Your cart is empty                                      | Váš košík je prázdny                                                | missing_from_manifest                                 |
| cart.emptyCartHint      | Looks like you haven't added anything to your cart yet. | Zatiaľ ste si do košíka nič nepridali.                              | missing_from_manifest                                 |
| cart.startShopping      | Start shopping                                          | Začať nakupovať                                                     | CTA; missing_from_manifest                            |
| cart.remove             | Remove                                                  | Odstrániť                                                           | Visible button label; missing_from_manifest           |
| cart.decreaseQuantity   | Decrease quantity                                       | Znížiť množstvo                                                     | aria label; missing_from_manifest                     |
| cart.increaseQuantity   | Increase quantity                                       | Zvýšiť množstvo                                                     | aria label; missing_from_manifest                     |
| cart.items              | {count, plural, one {# item} other {# items}}           | {count, plural, one {# položka} few {# položky} other {# položiek}} | Add count placeholder; Polish will also require many. |
| cart.total              | Total                                                   | Celkom                                                              | missing_from_manifest                                 |
| checkout.address        | Address                                                 | Ulica a číslo                                                       | Field label; missing_from_manifest                    |
| checkout.city           | City                                                    | Mesto                                                               | Field label; missing_from_manifest                    |
| checkout.country        | Country                                                 | Krajina                                                             | Field label; missing_from_manifest                    |
| checkout.firstName      | First name                                              | Meno                                                                | Field label; missing_from_manifest                    |
| checkout.lastName       | Last name                                               | Priezvisko                                                          | Field label; missing_from_manifest                    |
| checkout.phone          | Phone                                                   | Telefón                                                             | Field label; missing_from_manifest                    |
| checkout.postalCode     | ZIP code                                                | PSČ                                                                 | Field label; missing_from_manifest                    |
| checkout.placeOrder     | Place order                                             | Objednať s povinnosťou platby                                       | **legallySensitive: true**; critical closure gap.     |

Recommended manifest work is small and mechanical: add these keys with kind, area, context, maxLength where useful, placeholder metadata for count, and a legallySensitive flag for checkout.placeOrder. No locale rollout should begin until that key is part of the governed source.

## D. Hardcoded strings that should be catalogized or normalized

### Checkout/cart

| Location                                     | Hardcoded behavior                        | Recommended closure                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| src/ui/atoms/loader.tsx                      | Default “Načítavame…”                     | Reuse checkout.common.loading or a global common.loading key; do not retain a Slovak fallback in shared code.                                                      |
| src/app/checkout/layout.tsx                  | Static metadata title “Pokladňa”          | Wire existing checkout.title or introduce checkout.meta.title with locale-aware metadata.                                                                          |
| src/checkout/components/checkout-header.tsx  | Visible “TEST” environment marker         | Add checkout.payment.testModeBadge if this remains customer-visible; otherwise render it only as non-copy developer tooling.                                       |
| src/checkout/lib/payment/gateway-messages.ts | Nine Slovak FALLBACK_PAYMENT_LIB_MESSAGES | Remove the language-specific safety net or make initialization require the translated resolver. The fallback currently duplicates manifest messages and can drift. |

The nine fallback values include customer-facing payment failures and admin-oriented Stripe/Saleor dashboard instructions. Even if comments claim the fallback is unreachable from normal UI, a safety path must not silently force sk-SK for every locale.

Two provider guard strings in dummy/Stripe providers are internal truthy sentinels and are discarded by the current caller. They are intentionally not treated as customer copy.

### Raw backend/provider errors

Several checkout paths surface Saleor GraphQL, transport or Stripe message text directly. These are not stable translation sources:

- Saleor/transport messages passed through from checkout transport, billing updates, checkout completion formatting and gateway configuration;
- Stripe card/validation/integration message text returned by the payment formatter;
- Stripe Elements labels and wallet copy owned by Stripe.

Recommended rule:

- map known storefront failures to catalog keys;
- show a safe generic localized message for unknown backend/integration failures;
- log technical detail server-side;
- leave Stripe-owned card/Element localization to Stripe with the configured locale.

The normalization work is deferred_B7_i18n. Stripe-owned labels and provider-specific behavior are deferred_B8_stripe.

### Standalone auth/reset-link flow

The standalone login, sign-up, reset request and set-password pages contain approximately 67 distinct user-facing hardcoded English literals, including:

- page titles and metadata;
- labels, placeholders, button labels and show/hide-password aria labels;
- forgot-password/resend/success/expired-link states;
- sign-up legal agreement copy;
- API/BFF fallback and rate-limit messages.

This flow has no governed auth namespace. Add a separate source set rather than mixing all of it into the current commerce manifest:

- auth.common.\*
- auth.login.\*
- auth.signup.\*
- auth.resetRequest.\*
- auth.setPassword.\*
- auth.errors.\*

This is intentionally deferred_B7_i18n and excluded from Commerce Batch 1. The checkout-embedded auth/reset strings that already have checkout.contactSection.\* keys remain in the per-key appendix.

## E. Intentionally deferred copy

### B.6 truthfulness

| Key                                        | Why deferred                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| checkout.contactSection.activationNotice   | Claims an activation email will be sent; verify the active account-event configuration. |
| checkout.payment.authorizedTitle           | Depends on whether the payment is actually authorization-only.                          |
| checkout.payment.authorizedBody            | Claims capture at fulfillment; verify gateway capture mode and order lifecycle.         |
| checkout.payment.interruptedAfterAuthorize | Makes a financial-state claim after an interrupted flow.                                |
| checkout.payment.interruptedBeforeCharge   | Makes a “not charged” claim that must match reconciliation behavior.                    |
| checkout.shipping.ecoBadge                 | “Eco” is inferred from a method name, not verified metadata.                            |

Also review shipping estimates, refund timing, tax disclosure and the legal effect of order-confirmation language against actual market configuration.

### B.7 i18n

- checkout.common.loading is unwired while the loader contains a Slovak default.
- standalone auth/reset copy needs its own manifest.
- unknown Saleor/BFF errors need normalized localized fallbacks.
- locale-aware checkout metadata must replace the hardcoded title.

### B.8 Stripe

- checkout.confirmation.demoBanner belongs to the superseded demo confirmation step; the real payment flow routes to /checkout/complete.
- checkout.payment.expressCheckout, checkout.payment.payWithApplePay, checkout.payment.payWithGooglePay and checkout.payment.orContinueBelow live in an unimported legacy Express Checkout component.
- Stripe Element and wallet-owned labels should not be duplicated into the commerce manifest.

Remove dormant keys if the legacy component is retired. If Express Checkout is restored, re-audit against the real Stripe Express Checkout Element and its provider-owned localization.

## Cart closure

### Required cart text

| Requested concept                               | Runtime status                                                                      | Manifest status                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Your cart / Váš košík                           | Used in cart UI                                                                     | Missing: cart.yourCart                                            |
| Subtotal / Medzisúčet                           | Used                                                                                | Missing: cart.subtotal                                            |
| Calculated at checkout / Vypočíta sa v pokladni | Used in drawer                                                                      | Missing: cart.shippingAtCheckout                                  |
| Proceed to checkout / Prejsť k pokladni         | Used CTA                                                                            | Missing: cart.checkout                                            |
| Quantity decrease/increase                      | Used as aria labels                                                                 | Missing: cart.decreaseQuantity, cart.increaseQuantity             |
| Remove                                          | Visible key missing; product-specific and line-specific aria keys exist in manifest | Add cart.remove; keep cart.removeItemAria and cart.removeLineAria |
| Empty-cart title/hint/CTA                       | Used                                                                                | Missing: cart.emptyCart, cart.emptyCartHint, cart.startShopping   |
| Shipping label                                  | Used                                                                                | Missing: cart.shipping                                            |
| Total                                           | Used on drawer/page                                                                 | Missing: cart.total                                               |
| Item count plural                               | Used                                                                                | Missing: cart.items                                               |

The current manifest has only nine cart.\* keys, while 14 additional active cart keys are outside it.

### Shipping/tax truth

- Drawer wording “Calculated at checkout” is concise and consistent.
- cart.shippingNextStepNote currently says “Shipping will be calculated in the next step.” Rewrite it before translation to:
  - EN: “Shipping is calculated at checkout.”
  - SK: “Doprava sa vypočíta v pokladni.”
- The cart displays no tax/VAT note. cart.tax exists in the locale catalogs but has no scoped callsite.
- Product/legal must decide whether cart needs a legally sensitive disclosure such as:
  - EN candidate: “VAT included, where applicable.”
  - SK candidate: “Cena zahŕňa DPH, ak sa uplatňuje.”

Do not add that disclosure solely as a translation exercise; first verify price-display and tax rules per market.

## Source rewrites before translation

| Existing key                          | Problem                                                                                     | Recommended EN                                                                                                                      | Recommended SK                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| checkout.addressForm.selectField      | “Select {field}” assumes grammar and lowercasing that will not work across locales.         | Select an option                                                                                                                    | Vyberte možnosť                                                                                          |
| checkout.confirmation.emailNotice     | Optional email value creates awkward or misleading interpolation.                           | Split into emailNoticeWithAddress and emailNoticeGeneric.                                                                           | Rozdeliť na variant s adresou a všeobecný variant.                                                       |
| checkout.contactSection.resetLinkSent | Placeholder email means an account email, not the same concept as confirmation destination. | Use {accountEmail}.                                                                                                                 | Použiť {accountEmail}.                                                                                   |
| checkout.steps.progress               | Placeholder total collides with a money amount elsewhere.                                   | Step {current} of {stepCount}                                                                                                       | Krok {current} z {stepCount}                                                                             |
| checkout.shipping.noMethodsForCountry | Current form combined with country grammar is fragile.                                      | Shipping is not available for the selected country ({countryName}). Please check the address or contact us.                         | Doprava nie je dostupná pre vybranú krajinu ({countryName}). Skontrolujte adresu alebo nás kontaktujte.  |
| checkout.shipping.yourAddressFallback | Attempts to fabricate a grammatically inflected country phrase.                             | Remove it or use a neutral selected-country form.                                                                                   | Odstrániť alebo použiť neutrálny tvar „vybraná krajina“.                                                 |
| checkout.payment.dummyTestMode        | Mentions the exact order-button wording inside a test instruction.                          | Use the button below to complete the test order.                                                                                    | Testovaciu objednávku dokončite tlačidlom nižšie.                                                        |
| checkout.payment.notFullyPaid         | Repeats the legal CTA and makes a payment-state claim.                                      | Your payment status is still being confirmed. Refresh the page before trying again. Do not pay again until the status is confirmed. | Stav platby sa ešte overuje. Pred ďalším pokusom obnovte stránku. Neplaťte znova, kým sa stav nepotvrdí. |
| email.order.taxIncluded               | “Includes VAT” does not match the amount row and overstates tax semantics.                  | Of which VAT                                                                                                                        | Z toho DPH                                                                                               |

Admin-oriented payment copy must also be rewritten before translation. A shopper should not be told to inspect Saleor Dashboard, app activation or webhook delivery:

- checkout.payment.gateways.unsupportedList
- checkout.payment.gateways.dummyMissingBody
- checkout.payment.gateways.noGatewayConfigured
- checkout.payment.gateways.noneBody
- checkout.payment.gateways.paymentInitFailed
- checkout.payment.gateways.paymentWebhookFailed
- checkout.payment.stripeKeyMissing
- checkout.payment.stripeProcessFailed
- checkout.payment.stripeWebhookFailed

Recommended customer-safe base:

- EN: “Payment is temporarily unavailable. Please try again or contact us.”
- SK: “Platba je momentálne nedostupná. Skúste to znova alebo nás kontaktujte.”

Keep the precise configuration failure in logs/monitoring, not customer copy.

## Placeholder review

commerce-placeholders.json is syntactically complete for the current manifest: no referenced placeholder is absent, no registry entry is extra and appearsIn agrees with the source. The following semantic changes are still required:

| Placeholder                                                                              | Current issue                                                    | Recommendation                                                                                        |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| total                                                                                    | Used both as a monetary total and as total step count.           | Keep total for money; rename checkout.steps.progress to stepCount.                                    |
| email                                                                                    | Used for confirmation destination and account/reset identity.    | Use confirmationEmail and accountEmail, or key-specific definitions.                                  |
| countryName                                                                              | Backend country name may not inflect safely in translated prose. | Put it in parentheses after a neutral phrase.                                                         |
| count                                                                                    | Plural variable for cart.items.                                  | Add the missing key to the registry; require one/few/many/other as appropriate per locale.            |
| number                                                                                   | Display order number, not an internal database ID.               | Reuse consistently across order-email subjects and bodies.                                            |
| shippingMethodName                                                                       | Saleor-provided localized method name.                           | Treat as runtime data and do not translate inside the catalog.                                        |
| trackingNumber                                                                           | Customer-readable carrier identifier.                            | Never alter formatting.                                                                               |
| confirmationEmail, accountEmail, newEmail                                                | Different email-address roles.                                   | Define each meaning explicitly; do not reuse the ambiguous email placeholder.                         |
| trackingUrl, invoiceUrl, confirmUrl, resetUrl, passwordSetUrl, changeEmailUrl, deleteUrl | Action URLs.                                                     | Use only in href values; never translate or place raw URLs into prose unless intentionally displayed. |
| giftCardCode, balance, expiryDate, siteName                                              | Gift/account runtime data.                                       | Define type, formatting owner and whether value is optional.                                          |

The SMTP interpolation helper supports simple {name} replacement, not full ICU MessageFormat. Avoid ICU plural/select syntax in email copy until the formatter is upgraded.

## Transactional email inventory

The SMTP app defines 15 customer event types:

| Category             | Event types                                                                                                                                             | Current source state                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Order receipt/status | ORDER_CREATED, ORDER_CONFIRMED, ORDER_FULLY_PAID, ORDER_CANCELLED, ORDER_REFUNDED                                                                       | Only ORDER_CONFIRMED has event-specific catalog keys.     |
| Shipping/fulfillment | ORDER_FULFILLED, ORDER_FULFILLMENT_UPDATE                                                                                                               | Hardcoded English defaults; physical-product assumptions. |
| Invoice/gift card    | INVOICE_SENT, GIFT_CARD_SENT                                                                                                                            | Hardcoded English defaults.                               |
| Password/account     | ACCOUNT_CONFIRMATION, ACCOUNT_PASSWORD_RESET, ACCOUNT_SET_CUSTOMER_PASSWORD, ACCOUNT_CHANGE_EMAIL_REQUEST, ACCOUNT_CHANGE_EMAIL_CONFIRM, ACCOUNT_DELETE | Hardcoded English defaults.                               |

Additional runtime findings:

- 69 distinct visible English literals remain in default templates/shared fragments for the 14 uncatalogized event families.
- All default subjects except ORDER_CONFIRMED remain hardcoded English.
- The current enrichment assigns the ORDER_CONFIRMED preheader to every payload containing an order. A cancellation, refund or fulfillment email can therefore receive “we received your order and are preparing it,” which is semantically wrong.
- Account and gift-card events do not carry an order, so the current enrichment leaves them unchanged and English-only.
- The fulfillment-notify payload shape is snake_case while locale resolution expects camelCase channel/language fields; locale routing is not yet reliable for that path.
- Stored eventSettings.template and eventSettings.subject override code defaults. A source-only change will not fix already persisted templates; migration/reset must be planned and verified separately.
- ORDER_CREATED and ORDER_CONFIRMED can duplicate customer receipts. Product/operations must choose which event owns the canonical order receipt.

## Recommended email source

The following is source preparation, not a nine-locale implementation. Each family should have subject, preheader, title, intro and, where relevant, CTA/outro keys. Shared order-summary labels may remain under email.order.\*.

### Order events

| Event/key family        | Recommended EN canonical copy                                                                                                                                                                                                                                                                   | Recommended SK canonical copy                                                                                                                                                                                                                                                              | Sensitivity                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| email.orderCreated.\*   | Subject: “We received order {number}”. Preheader: “Order {number} is in our system. We’ll update you when its status changes.” Title: “Thank you for your order”. Intro: “We’ve received your order and will start processing it shortly.” Outro: “We’ll let you know when its status changes.” | Subject: „Prijali sme objednávku č. {number}“. Preheader: „Objednávku č. {number} evidujeme. O zmene stavu vás budeme informovať.“ Title: „Ďakujeme za objednávku“. Intro: „Vašu objednávku sme prijali a čoskoro ju začneme spracúvať.“ Outro: „O zmene jej stavu vás budeme informovať.“ | Contract/status truth; legallySensitive pending legal review.                                     |
| email.orderConfirmed.\* | Subject: “Order {number} confirmed”. Preheader: “Your order {number} is confirmed.” Title: “Your order is confirmed”. Intro: “We’ve confirmed your order and will continue processing it.” Outro: “We’ll send another update when its status changes.”                                          | Subject: „Potvrdenie objednávky č. {number}“. Preheader: „Vaša objednávka č. {number} je potvrdená.“ Title: „Vaša objednávka je potvrdená“. Intro: „Vašu objednávku sme potvrdili a pokračujeme v jej spracovaní.“ Outro: „O ďalšej zmene stavu vás budeme informovať.“                    | Contract/status truth; legallySensitive. Do not promise shipping for digital orders.              |
| email.orderFullyPaid.\* | Subject: “Payment received for order {number}”. Preheader: “We received the full payment for order {number}.” Title: “Payment received”. Intro: “Your payment has been recorded.” Outro: “We’ll continue processing your order.”                                                                | Subject: „Platbu za objednávku č. {number} sme prijali“. Preheader: „Prijali sme celú platbu za objednávku č. {number}.“ Title: „Platba prijatá“. Intro: „Vašu platbu sme zaevidovali.“ Outro: „Pokračujeme v spracovaní objednávky.“                                                      | Financial state; legallySensitive.                                                                |
| email.orderCancelled.\* | Subject: “Order {number} was cancelled”. Preheader: “Order {number} has been cancelled.” Title: “Order cancelled”. Intro: “Your order has been cancelled.” Outro: “If this is unexpected, contact us.”                                                                                          | Subject: „Objednávka č. {number} bola zrušená“. Preheader: „Objednávka č. {number} bola zrušená.“ Title: „Objednávka zrušená“. Intro: „Vaša objednávka bola zrušená.“ Outro: „Ak ste to neočakávali, kontaktujte nás.“                                                                     | Status/refund consequence; legallySensitive. Remove “as requested”.                               |
| email.orderRefunded.\*  | Subject: “Refund processed for order {number}”. Preheader: “We processed a refund for order {number}.” Title: “Refund processed”. Intro: “We’ve processed a refund for your order.” Timing: “When it appears depends on your payment provider.”                                                 | Subject: „Refundáciu objednávky č. {number} sme spracovali“. Preheader: „Spracovali sme refundáciu objednávky č. {number}.“ Title: „Refundácia spracovaná“. Intro: „Refundáciu vašej objednávky sme spracovali.“ Timing: „Čas pripísania závisí od vášho poskytovateľa platby.“            | Financial timing; legallySensitive. Do not promise 5–10 days unless verified per provider/market. |

### Fulfillment, invoice and gift card

| Event/key family                 | Recommended EN canonical copy                                                                                                                                                                            | Recommended SK canonical copy                                                                                                                                                                                               | Sensitivity                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| email.orderFulfilled.physical.\* | Subject: “Order {number} is on its way”. Preheader: “We’ve handed your order to the carrier.” Title: “Your order is on its way”. Tracking CTA: “Track shipment”.                                         | Subject: „Objednávka č. {number} je na ceste“. Preheader: „Vašu objednávku sme odovzdali dopravcovi.“ Title: „Vaša objednávka je na ceste“. CTA: „Sledovať zásielku“.                                                       | Use only when carrier handoff is true. Placeholders: shippingMethodName, trackingUrl.            |
| email.orderFulfilled.digital.\*  | Subject: “Order {number} is ready”. Preheader: “Your order is ready.” Title: “Your order is ready”.                                                                                                      | Subject: „Objednávka č. {number} je pripravená“. Preheader: „Vaša objednávka je pripravená.“ Title: „Vaša objednávka je pripravená“.                                                                                        | Avoid physical-shipping claims.                                                                  |
| email.fulfillmentUpdate.\*       | Subject: “Shipping update for order {number}”. Preheader: “There is an update for your shipment.” Title: “Shipping update”. Tracking label: “Tracking number: {trackingNumber}”.                         | Subject: „Aktualizácia dopravy objednávky č. {number}“. Preheader: „Máme aktualizáciu k vašej zásielke.“ Title: „Aktualizácia dopravy“. Label: „Číslo zásielky: {trackingNumber}“.                                          | Carrier data truth.                                                                              |
| email.invoiceSent.\*             | Subject: “Invoice for order {number}”. Preheader: “Your invoice is ready.” Title: “Your invoice”. Intro: “The invoice for your order is ready.” CTA: “Download invoice”.                                 | Subject: „Faktúra k objednávke č. {number}“. Preheader: „Vaša faktúra je pripravená.“ Title: „Vaša faktúra“. Intro: „Faktúra k vašej objednávke je pripravená.“ CTA: „Stiahnuť faktúru“.                                    | Document identity/availability. Placeholder: invoiceUrl.                                         |
| email.giftCardSent.\*            | Subject: “You received a gift card”. Preheader: “Your gift card is ready to use.” Title: “Your gift card”. Code label: “Gift card code”. Balance label: “Balance”. Validity: “Valid until {expiryDate}”. | Subject: „Dostali ste darčekovú kartu“. Preheader: „Vaša darčeková karta je pripravená na použitie.“ Title: „Vaša darčeková karta“. Label: „Kód darčekovej karty“. Zostatok: „Zostatok“. Platnosť: „Platí do {expiryDate}“. | Terms, balance and expiry are legallySensitive. Placeholders: giftCardCode, balance, expiryDate. |

### Password and account events

| Event/key family              | Recommended EN canonical copy                                                                                                                                                                                                                                                                                             | Recommended SK canonical copy                                                                                                                                                                                                                                                                               | Sensitivity                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| email.accountConfirmation.\*  | Subject: “Confirm your account”. Preheader: “Confirm your email address to activate your account.” Title: “Confirm your account”. Intro: “Use the button below to confirm your email address.” CTA: “Confirm account”. Safety: “If you didn’t create this account, you can ignore this email.”                            | Subject: „Potvrďte svoj účet“. Preheader: „Potvrďte e-mailovú adresu a aktivujte svoj účet.“ Title: „Potvrďte svoj účet“. Intro: „Svoju e-mailovú adresu potvrďte tlačidlom nižšie.“ CTA: „Potvrdiť účet“. Safety: „Ak ste si tento účet nevytvorili, e-mail môžete ignorovať.“                             | Security-sensitive. Placeholder: confirmUrl.                                              |
| email.passwordReset.\*        | Subject: “Reset your password”. Preheader: “Use this link to choose a new password.” Title: “Reset your password”. Intro: “We received a request to reset your password.” CTA: “Choose a new password”. Safety: “If you didn’t request this, you can ignore this email.”                                                  | Subject: „Obnovte si heslo“. Preheader: „Pomocou odkazu si nastavte nové heslo.“ Title: „Obnova hesla“. Intro: „Prijali sme žiadosť o obnovenie vášho hesla.“ CTA: „Nastaviť nové heslo“. Safety: „Ak ste o obnovu nežiadali, e-mail môžete ignorovať.“                                                     | Security-sensitive. Placeholder: resetUrl.                                                |
| email.setCustomerPassword.\*  | Subject: “Set your password”. Preheader: “Create a password for your account.” Title: “Set your password”. Intro: “Use the button below to create your account password.” CTA: “Set password”.                                                                                                                            | Subject: „Nastavte si heslo“. Preheader: „Vytvorte si heslo k svojmu účtu.“ Title: „Nastavte si heslo“. Intro: „Heslo k svojmu účtu si vytvorte tlačidlom nižšie.“ CTA: „Nastaviť heslo“.                                                                                                                   | Security-sensitive. Placeholder: passwordSetUrl.                                          |
| email.changeEmailRequest.\*   | Subject: “Confirm your new email address”. Preheader: “Confirm the change to {newEmail}.” Title: “Confirm email change”. Intro: “We received a request to change the email address on your account.” CTA: “Confirm new email”. Safety: “If you didn’t request this change, secure your account and contact us.”           | Subject: „Potvrďte novú e-mailovú adresu“. Preheader: „Potvrďte zmenu na adresu {newEmail}.“ Title: „Potvrďte zmenu e-mailu“. Intro: „Prijali sme žiadosť o zmenu e-mailovej adresy vášho účtu.“ CTA: „Potvrdiť nový e-mail“. Safety: „Ak ste o zmenu nežiadali, zabezpečte svoj účet a kontaktujte nás.“   | Security-sensitive. Placeholders: newEmail, changeEmailUrl.                               |
| email.changeEmailConfirmed.\* | Subject: “Your email address was changed”. Preheader: “The email address on your account is now {newEmail}.” Title: “Email address changed”. Intro: “Your account email address was changed successfully.” Safety: “If you didn’t make this change, contact us immediately.”                                              | Subject: „Vaša e-mailová adresa bola zmenená“. Preheader: „E-mailová adresa vášho účtu je teraz {newEmail}.“ Title: „E-mailová adresa zmenená“. Intro: „E-mailová adresa vášho účtu bola úspešne zmenená.“ Safety: „Ak ste túto zmenu nevykonali, ihneď nás kontaktujte.“                                   | Security-sensitive. Placeholder: newEmail.                                                |
| email.accountDelete.\*        | Subject: “Confirm account deletion”. Preheader: “Confirm the permanent deletion of your account.” Title: “Delete your account?”. Intro: “This action permanently deletes your account and cannot be undone.” CTA: “Permanently delete account”. Safety: “If you didn’t request this, do not use the link and contact us.” | Subject: „Potvrďte odstránenie účtu“. Preheader: „Potvrďte trvalé odstránenie svojho účtu.“ Title: „Odstrániť účet?“. Intro: „Táto akcia natrvalo odstráni váš účet a nedá sa vrátiť späť.“ CTA: „Natrvalo odstrániť účet“. Safety: „Ak ste o odstránenie nežiadali, odkaz nepoužívajte a kontaktujte nás.“ | Irreversible action; **legallySensitive** and security-sensitive. Placeholder: deleteUrl. |

Do not build optional greetings by concatenating “Hi” and firstName. Either omit the greeting or provide complete with-name/without-name variants.

### Current email keys to review

All 17 current email keys remain outside Batch 1:

- email.orderConfirmed.subject
- email.orderConfirmed.preheader
- email.orderConfirmed.title
- email.orderConfirmed.intro
- email.orderConfirmed.outro
- email.order.badge
- email.order.summaryTitle
- email.order.quantity
- email.order.subtotal
- email.order.shipping
- email.order.total
- email.order.taxIncluded
- email.order.shippingTo
- email.order.billingTo
- email.order.noShippingRequired
- email.order.noBillingAddress
- email.footer.support

email.order.taxIncluded needs rewrite_before_translation. The other 16 are email_review_needed until event ownership, status truth and persisted-template migration are agreed.

Reuse email.footer.support across all event families. Either remove the default “Powered by Saleor Commerce” line from customer templates or give it an explicit, intentional email.footer.poweredBy key.

## Locale matrix and validation

- commerce-locales.json contains 13 market/channel entries and matches the storefront CHANNEL_MAP/LOCALE_MAP for channel, currency, Saleor language and Stripe locale.
- The SMTP channel-locale map mirrors the same 13 channels.
- This audit did not call the live Saleor API, so it cannot certify that every configured channel is active or that shipping methods exist for it.
- Recommended future matrix fields: launchStatus, checkoutReady and shippingConfigured, generated or checked against live channel configuration in a controlled validation job.
- The current parity checker recognizes multi-plural locales but only requires one, few and other. Polish also needs many. Fix the checker before freezing Polish translation files.

## Batch 1 recommendation

Do not send the current manifest wholesale.

Safe immediate source pool:

- the 184 existing keys marked stable_now in the appendix;
- none of the current email keys;
- none of the standalone auth/reset hardcoded copy;
- none of the B.6 truthfulness or B.8 Stripe/dormant keys.

Before producing the actual Batch 1 file:

1. Add the 22 missing runtime keys, including all 14 active cart keys and legallySensitive checkout.placeOrder.
2. Apply and review the 19 source rewrites; split confirmation email copy and update placeholder names/registry.
3. Wire or remove checkout.common.loading and the other explicit hardcoded checkout strings.
4. Decide whether the five dormant keys are removed or restored as part of real Stripe Express Checkout.
5. Fix Polish many validation.
6. Re-run the static closure check and require zero unexplained runtime keys outside the manifest.

After those corrections, Batch 1 should contain active storefront commerce copy only. Email should be a separate batch after all 15 event families are catalogized, legally/truthfully reviewed and the persisted-template migration strategy is known.

## Per-key stability appendix

This table covers every one of the 231 keys in commerce-source-en.json at the audited Track B revision. The 22 runtime keys absent from that file are listed separately in section C with status missing_from_manifest.

| Manifest key                                                     | Status                     |
| ---------------------------------------------------------------- | -------------------------- |
| cart.itemCountOverflow                                           | stable_now                 |
| cart.quantityLabel                                               | stable_now                 |
| cart.removeItemAria                                              | stable_now                 |
| cart.removeLineAria                                              | stable_now                 |
| cart.removing                                                    | stable_now                 |
| cart.removingLineAria                                            | stable_now                 |
| cart.shippingNextStepNote                                        | rewrite_before_translation |
| cart.variantAttribute                                            | stable_now                 |
| cart.variantLabel                                                | stable_now                 |
| checkout.addressForm.addNewAddress                               | stable_now                 |
| checkout.addressForm.backToSavedAddresses                        | stable_now                 |
| checkout.addressForm.chooseAddress                               | stable_now                 |
| checkout.addressForm.countryRegion                               | stable_now                 |
| checkout.addressForm.defaultBadge                                | stable_now                 |
| checkout.addressForm.edit                                        | stable_now                 |
| checkout.addressForm.fieldRequired                               | stable_now                 |
| checkout.addressForm.fields.cityArea                             | stable_now                 |
| checkout.addressForm.fields.companyName                          | stable_now                 |
| checkout.addressForm.fields.countryArea                          | stable_now                 |
| checkout.addressForm.fields.streetAddress2                       | stable_now                 |
| checkout.addressForm.localized.district                          | stable_now                 |
| checkout.addressForm.localized.postTown                          | stable_now                 |
| checkout.addressForm.localized.postal                            | stable_now                 |
| checkout.addressForm.localized.prefecture                        | stable_now                 |
| checkout.addressForm.localized.province                          | stable_now                 |
| checkout.addressForm.localized.state                             | stable_now                 |
| checkout.addressForm.localized.zip                               | stable_now                 |
| checkout.addressForm.noAddressProvided                           | stable_now                 |
| checkout.addressForm.noSavedAddresses                            | stable_now                 |
| checkout.addressForm.noSavedAddressesHint                        | stable_now                 |
| checkout.addressForm.noSavedAddressesYet                         | stable_now                 |
| checkout.addressForm.selectAddressTitle                          | stable_now                 |
| checkout.addressForm.selectBillingAddressTitle                   | stable_now                 |
| checkout.addressForm.selectCountry                               | stable_now                 |
| checkout.addressForm.selectField                                 | rewrite_before_translation |
| checkout.addressForm.selectShippingAddressTitle                  | stable_now                 |
| checkout.addressForm.setAsDefaultBilling                         | stable_now                 |
| checkout.addressForm.setAsDefaultShipping                        | stable_now                 |
| checkout.common.back                                             | stable_now                 |
| checkout.common.backToInformation                                | stable_now                 |
| checkout.common.backToShipping                                   | stable_now                 |
| checkout.common.change                                           | stable_now                 |
| checkout.common.continue                                         | stable_now                 |
| checkout.common.continueToPayment                                | stable_now                 |
| checkout.common.continueToShipping                               | stable_now                 |
| checkout.common.loading                                          | deferred_B7_i18n           |
| checkout.common.optional                                         | stable_now                 |
| checkout.common.saving                                           | stable_now                 |
| checkout.common.securePurchase                                   | stable_now                 |
| checkout.confirmation.billingAddressLabel                        | stable_now                 |
| checkout.confirmation.confirmedTitle                             | stable_now                 |
| checkout.confirmation.demoBanner                                 | deferred_B8_stripe         |
| checkout.confirmation.emailNotice                                | rewrite_before_translation |
| checkout.confirmation.emailSentLabel                             | stable_now                 |
| checkout.confirmation.orderNotFoundMessage                       | stable_now                 |
| checkout.confirmation.orderNotFoundTitle                         | stable_now                 |
| checkout.confirmation.orderNumberLine                            | stable_now                 |
| checkout.confirmation.shippingAddressLabel                       | stable_now                 |
| checkout.confirmation.title                                      | stable_now                 |
| checkout.contactSection.activationNotice                         | deferred_B6_truthfulness   |
| checkout.contactSection.continueAsGuest                          | stable_now                 |
| checkout.contactSection.createAccountLabel                       | stable_now                 |
| checkout.contactSection.createAccountPasswordPlaceholder         | stable_now                 |
| checkout.contactSection.emailPlaceholder                         | stable_now                 |
| checkout.contactSection.enterEmailFirst                          | stable_now                 |
| checkout.contactSection.enterValidEmail                          | stable_now                 |
| checkout.contactSection.forgotPassword                           | stable_now                 |
| checkout.contactSection.haveAccount                              | stable_now                 |
| checkout.contactSection.invalidCredentials                       | stable_now                 |
| checkout.contactSection.newCustomer                              | stable_now                 |
| checkout.contactSection.passwordPlaceholder                      | stable_now                 |
| checkout.contactSection.processing                               | stable_now                 |
| checkout.contactSection.resendResetLink                          | stable_now                 |
| checkout.contactSection.resetLinkSendFailed                      | stable_now                 |
| checkout.contactSection.resetLinkSent                            | rewrite_before_translation |
| checkout.contactSection.resetPassword.backToSignIn               | stable_now                 |
| checkout.contactSection.resetPassword.confirmPasswordLabel       | stable_now                 |
| checkout.contactSection.resetPassword.confirmPasswordPlaceholder | stable_now                 |
| checkout.contactSection.resetPassword.failed                     | stable_now                 |
| checkout.contactSection.resetPassword.failedMaybeExpired         | stable_now                 |
| checkout.contactSection.resetPassword.linkInvalid                | stable_now                 |
| checkout.contactSection.resetPassword.newPasswordLabel           | stable_now                 |
| checkout.contactSection.resetPassword.newPasswordPlaceholder     | stable_now                 |
| checkout.contactSection.resetPassword.passwordTooShort           | stable_now                 |
| checkout.contactSection.resetPassword.passwordsMismatch          | stable_now                 |
| checkout.contactSection.resetPassword.submit                     | stable_now                 |
| checkout.contactSection.resetPassword.subtitle                   | stable_now                 |
| checkout.contactSection.resetPassword.title                      | stable_now                 |
| checkout.contactSection.signIn                                   | stable_now                 |
| checkout.contactSection.signInFailed                             | stable_now                 |
| checkout.contactSection.signInTitle                              | stable_now                 |
| checkout.contactSection.signOut                                  | stable_now                 |
| checkout.contactSection.signedInStatus                           | stable_now                 |
| checkout.contactSection.title                                    | stable_now                 |
| checkout.errors.cardPaymentsDisabled                             | stable_now                 |
| checkout.errors.generic                                          | stable_now                 |
| checkout.errors.invalidValue                                     | stable_now                 |
| checkout.errors.noSaleorResponse                                 | stable_now                 |
| checkout.errors.orderCreateFailed                                | stable_now                 |
| checkout.errors.paymentProcessFailed                             | stable_now                 |
| checkout.errors.paymentsDisabled                                 | stable_now                 |
| checkout.errors.testPaymentUnavailable                           | stable_now                 |
| checkout.errors.totalVerifyFailed                                | stable_now                 |
| checkout.info.accountCreateFailed                                | stable_now                 |
| checkout.info.addressSaveFailed                                  | stable_now                 |
| checkout.info.continueToPayment                                  | stable_now                 |
| checkout.info.continueToShipping                                 | stable_now                 |
| checkout.info.emailInvalid                                       | stable_now                 |
| checkout.info.emailRequired                                      | stable_now                 |
| checkout.info.emailSaveFailed                                    | stable_now                 |
| checkout.info.newsletterLabel                                    | stable_now                 |
| checkout.info.passwordRequired                                   | stable_now                 |
| checkout.info.passwordTooShort                                   | stable_now                 |
| checkout.info.selectShippingAddress                              | stable_now                 |
| checkout.info.shippingAddressTitle                               | stable_now                 |
| checkout.notFound.helpText                                       | stable_now                 |
| checkout.notFound.message                                        | stable_now                 |
| checkout.notFound.title                                          | stable_now                 |
| checkout.payment.alreadyCompleted                                | stable_now                 |
| checkout.payment.authorizedBody                                  | deferred_B6_truthfulness   |
| checkout.payment.authorizedTitle                                 | deferred_B6_truthfulness   |
| checkout.payment.bankDeclined                                    | stable_now                 |
| checkout.payment.billingAddressTitle                             | stable_now                 |
| checkout.payment.billingSaveFailed                               | stable_now                 |
| checkout.payment.channelUnresolved                               | stable_now                 |
| checkout.payment.completeOrder                                   | stable_now                 |
| checkout.payment.completeOrderFailed                             | stable_now                 |
| checkout.payment.completingBody                                  | stable_now                 |
| checkout.payment.completingTitle                                 | stable_now                 |
| checkout.payment.confirmingPayment                               | stable_now                 |
| checkout.payment.creatingOrder                                   | stable_now                 |
| checkout.payment.currencyUnavailable                             | stable_now                 |
| checkout.payment.detailsUnavailable                              | stable_now                 |
| checkout.payment.doNotClose                                      | stable_now                 |
| checkout.payment.dummyGateway                                    | stable_now                 |
| checkout.payment.dummyTestMode                                   | rewrite_before_translation |
| checkout.payment.expressCheckout                                 | deferred_B8_stripe         |
| checkout.payment.expressReset                                    | stable_now                 |
| checkout.payment.failed                                          | stable_now                 |
| checkout.payment.formReset                                       | stable_now                 |
| checkout.payment.freeOrderBody                                   | stable_now                 |
| checkout.payment.freeOrderTotalChanged                           | stable_now                 |
| checkout.payment.gatewayInitFailed                               | stable_now                 |
| checkout.payment.gateways.dummyMissingBody                       | rewrite_before_translation |
| checkout.payment.gateways.dummyMissingTitle                      | stable_now                 |
| checkout.payment.gateways.noGatewayConfigured                    | rewrite_before_translation |
| checkout.payment.gateways.noneBody                               | rewrite_before_translation |
| checkout.payment.gateways.noneTitle                              | stable_now                 |
| checkout.payment.gateways.paymentFailed                          | stable_now                 |
| checkout.payment.gateways.paymentInitFailed                      | rewrite_before_translation |
| checkout.payment.gateways.paymentTryAgain                        | stable_now                 |
| checkout.payment.gateways.paymentWebhookFailed                   | rewrite_before_translation |
| checkout.payment.gateways.stripeUseCardForm                      | stable_now                 |
| checkout.payment.gateways.unsupportedEmpty                       | stable_now                 |
| checkout.payment.gateways.unsupportedList                        | rewrite_before_translation |
| checkout.payment.gateways.unsupportedTitle                       | stable_now                 |
| checkout.payment.initFailed                                      | stable_now                 |
| checkout.payment.interruptedAfterAuthorize                       | deferred_B6_truthfulness   |
| checkout.payment.interruptedBeforeCharge                         | deferred_B6_truthfulness   |
| checkout.payment.invalidValue                                    | stable_now                 |
| checkout.payment.loadingGateway                                  | stable_now                 |
| checkout.payment.loadingTotal                                    | stable_now                 |
| checkout.payment.methodRequired                                  | stable_now                 |
| checkout.payment.notFullyPaid                                    | rewrite_before_translation |
| checkout.payment.orContinueBelow                                 | deferred_B8_stripe         |
| checkout.payment.orPayWithCard                                   | stable_now                 |
| checkout.payment.payWithApplePay                                 | deferred_B8_stripe         |
| checkout.payment.payWithGooglePay                                | deferred_B8_stripe         |
| checkout.payment.placeOrderFailed                                | stable_now                 |
| checkout.payment.priceChangedBody                                | stable_now                 |
| checkout.payment.priceChangedTitle                               | stable_now                 |
| checkout.payment.processingPayment                               | stable_now                 |
| checkout.payment.sameAsShipping                                  | stable_now                 |
| checkout.payment.securingWithStripe                              | stable_now                 |
| checkout.payment.sessionExpired                                  | stable_now                 |
| checkout.payment.stripeConfigFailed                              | stable_now                 |
| checkout.payment.stripeKeyMissing                                | rewrite_before_translation |
| checkout.payment.stripeLoadTitle                                 | stable_now                 |
| checkout.payment.stripeProcessFailed                             | rewrite_before_translation |
| checkout.payment.stripeWebhookFailed                             | rewrite_before_translation |
| checkout.payment.submittingOrder                                 | stable_now                 |
| checkout.payment.totalChanged                                    | stable_now                 |
| checkout.payment.totalUnavailable                                | stable_now                 |
| checkout.payment.totalsRefreshFailed                             | stable_now                 |
| checkout.payment.unavailable                                     | stable_now                 |
| checkout.payment.unexpectedError                                 | stable_now                 |
| checkout.payment.validationFailed                                | stable_now                 |
| checkout.payment.verificationUnavailable                         | stable_now                 |
| checkout.shipping.deliveryEstimate                               | stable_now                 |
| checkout.shipping.ecoBadge                                       | deferred_B6_truthfulness   |
| checkout.shipping.loadingMethods                                 | stable_now                 |
| checkout.shipping.methodSaveFailed                               | stable_now                 |
| checkout.shipping.noAddressYet                                   | stable_now                 |
| checkout.shipping.noMethodsForCountry                            | rewrite_before_translation |
| checkout.shipping.selectMethod                                   | stable_now                 |
| checkout.shipping.title                                          | stable_now                 |
| checkout.shipping.yourAddressFallback                            | rewrite_before_translation |
| checkout.steps.confirmation                                      | stable_now                 |
| checkout.steps.information                                       | stable_now                 |
| checkout.steps.navAria                                           | stable_now                 |
| checkout.steps.payment                                           | stable_now                 |
| checkout.steps.progress                                          | rewrite_before_translation |
| checkout.steps.shipping                                          | stable_now                 |
| checkout.summary.contact                                         | stable_now                 |
| checkout.summary.delivery                                        | stable_now                 |
| checkout.summary.digitalDelivery                                 | stable_now                 |
| checkout.summary.discount                                        | stable_now                 |
| checkout.summary.hideSummary                                     | stable_now                 |
| checkout.summary.method                                          | stable_now                 |
| checkout.summary.productFallback                                 | stable_now                 |
| checkout.summary.shipTo                                          | stable_now                 |
| checkout.summary.showSummary                                     | stable_now                 |
| checkout.summary.title                                           | stable_now                 |
| checkout.summary.total                                           | stable_now                 |
| email.orderConfirmed.subject                                     | email_review_needed        |
| email.orderConfirmed.preheader                                   | email_review_needed        |
| email.orderConfirmed.title                                       | email_review_needed        |
| email.orderConfirmed.intro                                       | email_review_needed        |
| email.orderConfirmed.outro                                       | email_review_needed        |
| email.order.badge                                                | email_review_needed        |
| email.order.summaryTitle                                         | email_review_needed        |
| email.order.quantity                                             | email_review_needed        |
| email.order.subtotal                                             | email_review_needed        |
| email.order.shipping                                             | email_review_needed        |
| email.order.total                                                | email_review_needed        |
| email.order.taxIncluded                                          | rewrite_before_translation |
| email.order.shippingTo                                           | email_review_needed        |
| email.order.billingTo                                            | email_review_needed        |
| email.order.noShippingRequired                                   | email_review_needed        |
| email.order.noBillingAddress                                     | email_review_needed        |
| email.footer.support                                             | email_review_needed        |

Appendix totals:

| Status                     |   Count |
| -------------------------- | ------: |
| stable_now                 |     184 |
| rewrite_before_translation |      19 |
| deferred_B6_truthfulness   |       6 |
| deferred_B7_i18n           |       1 |
| deferred_B8_stripe         |       5 |
| email_review_needed        |      16 |
| **Total current manifest** | **231** |

## Closure acceptance criteria for the next audit

The commerce source can be declared runtime-closed when:

- every active checkout/cart runtime key is in commerce-source-en.json;
- every manifest key has an intentional active owner or a documented deferred reason;
- no customer-facing checkout fallback forces one locale;
- unknown backend errors are normalized rather than copied verbatim;
- placeholder names have one semantic type and are validated per key;
- the Polish plural validator requires many;
- all 15 transactional event families have event-specific subject/preheader/body keys;
- email locale resolution works for every payload shape;
- persisted SMTP template overrides are inventoried and migrated/reset intentionally;
- truth-sensitive and legallySensitive wording has named product/legal approval.
