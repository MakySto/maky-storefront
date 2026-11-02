# MAKY-B2B-V1: čo storefront od backendu číta a posiela

2\. 11. 2026 · storefront PR #84 do `release/r1-thule-20261001` (vetva `claude/project-thread-1shbdz`) · pre reláciu
„MAKY Backend (Saleor)“ a pre toho, kto bude spájať obe strany v sandboxe.

Tento súbor nie je druhý kontrakt. Kontrakt je text MAKY-B2B-V1 a schéma backendu. Tu je len to, ako ho storefront
prečítal a v kóde použil. Pri rozdiele sa najprv opraví tento súbor aj backendový handoff, potom kód.

## Stav

- Všetko je vypnuté, kým proces nemá `B2B_CHECKOUT_UI_ENABLED=true`. Bez toho sa firemný blok neukáže, VIES sa nevolá
  a žiadny B2B dopyt nejde do Saleoru.
- B2B dokumenty sú overené proti **skutočnej schéme backendu**: `src/checkout/lib/b2b/maky-b2b-v1.graphql` je vygenerovaný
  z `saleor/graphql/schema.graphql` v MakySto/maky-saleor (PR #16, commit `68ca91a`), ako rozšírenie pripnutej schémy
  3.23.31. Hlavička súboru nesie commit a sha256 zdroja.
- `graphql.test.ts` dokumenty proti tejto schéme validuje a kontrolu pripravenosti na nej aj **vykoná** (tak, ako ju vykoná
  Saleor). Proti čistej 3.23.31 alebo schéme bez niektorého čítaného poľa kontrola správne zlyhá a pomenuje pole.
- Žiadny priechod cez Stripe test mode ani sandbox s patchom zatiaľ nebol. Backend v testoch storefrontu je maketa
  so správaním podľa kontraktu (zámok, `STALE_CONTEXT`, odvolanie, nesúlad súm).
- B2B dokumenty sú reťazce v `src/checkout/lib/b2b/graphql.ts`, mimo globu codegenu. Ten beží pred každým buildom proti
  živému Saleoru a pole, ktoré živá schéma nepozná, by build zastavilo.

## Čo storefront číta

**Verejne, bez tokenu.** `Checkout.b2bTaxState: B2bTaxState!` je pole checkoutu ako každé iné, takže stav storefront
prečíta aj vtedy, keď prístup B2B aplikácie práve nefunguje:

```graphql
checkout(id: $id) {
	id
	b2bTaxState { contextVersion decision effectiveTaxExemption checkedAt expiresAt paymentLocked }
	totalPrice { net { amount currency } tax { amount currency } gross { amount currency } }
}
```

- `contextVersion` je pre storefront nepriehľadný reťazec. Len ho prenesie späť ako `expectedContextVersion`.
- `decision` a kódy chýb číta storefront **ako reťazce**. Neznáma hodnota je „nepotvrdené“.
- `effectiveTaxExemption` spolu s `decision == EXEMPT` je jediné, čo v súhrne zapne text „Bez DPH — oslobodené podľa § 43“.
- `totalPrice.gross` zo stavu sa porovná s verejným `checkout.totalPrice.gross`. Ak sa líšia, storefront prečíta stav ešte
  raz. Ak sa líšia aj potom, výsledok je „nepotvrdené“ a platba sa nespustí. Storefront kontroluje aj protirečenie: EXEMPT
  nad sumou s daňou, alebo zdanený výsledok nad kladnou sumou bez dane. Oboje je „nepotvrdené“, nikdy „pokračujte s DPH“.
- Vlastný vstup zákazníka číta z `metafield(key: "maky.b2b.input.v1")` na checkoute.

### `paymentLocked`

Kým beží začatá platba (`paymentLocked: true`), storefront do backendu nič nezapisuje: nepýta sa VIES, neposiela atestáciu
ani odvolanie. Zmrazené rozhodnutie platí tak, ako je, aj po 24 h platnosti odpovede VIES, takže opakovanie tej istej
platby sa k nemu pripojí. Výnimka je `TAXED_STALE` pod zámkom (kontext sa zmenil po začatí platby): storefront ukáže
„Platba tejto objednávky už prebieha…“ s tlačidlom na obnovenie stavu a platbu nepustí. Zámok na zápisoch
(`CHECKOUT_LOCKED`, `B2B_CHECKOUT_LOCKED`) je vždy hláška o rozpracovanej platbe, nikdy chyba poľa.

### Keď prístup aplikácie nefunguje

Keď kontrola pripravenosti nie je v poriadku (token chýba, aplikácia neaktívna, chýba oprávnenie, schéma nesedí,
Saleor neodpovedá), storefront s tokenom nič nezapíše. Stav však prečíta verejne a ukáže rozhodnutie backendu, nikdy
„vypnuté“:

| stav backendu                                                  | čo zákazník vidí                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `EXEMPT` s účinným oslobodením                                 | oslobodené, kým ho backend drží ako účinné (obnoviť ani odvolať ho storefront bez prístupu nevie) |
| `TAXED_INVALID`, `TAXED_SK_VAT` a iné rozhodnutia nad overeným | to isté rozhodnutie                                                                               |
| `TAXED_UNVERIFIED` alebo zmenený kontext, ktorý treba overiť   | „IČ DPH sa teraz nedá overiť“ a možnosť pokračovať s DPH                                          |
| zákazník firemný nákup vypol nad `EXEMPT`                      | „nepotvrdené“: bez zápisu sa oslobodenie odvolať nedá, platba nejde                               |
| stav sa nedá prečítať                                          | „nepotvrdené“                                                                                     |

## Čo storefront posiela

S tokenom B2B aplikácie (`SALEOR_B2B_APP_TOKEN`, iba na serveri):

```graphql
checkoutB2bTaxAttestationUpdate(id: $id, input: {
	expectedContextVersion: String!
	verification: { vatId status checkedAt requestIdentifier name address } | null
})
```

- `verification: null` znamená odvolať predošlé schválenie. Storefront ho pošle, keď IČ DPH chýba, krajina nesedí
  alebo zákazník firemný nákup vypol. Ak je stav už odvolaný alebo rozhodnutý iba z kontextu, nepošle nič.
- `status` je `VALID`, `INVALID` alebo `UNAVAILABLE`. Výpadky VIES storefront hlási ako `UNAVAILABLE`, aj keď prídu
  ako HTTP 200 s `userError`. Patrí sem aj timeout 8 s, sieťová chyba a odpoveď na iné číslo, než sa pýtalo.
- `vatId` je úplné normalizované číslo s predponou VIES (`DE123456789`, `ATU12345678`, `EL…` pre Grécko).
- `checkedAt` je pôvodný čas overenia; odpoveď z cache si ho nesie ďalej.
- `name` a `address` sú z VIES. Keď členský štát údaj nezverejní (`---`), storefront pošle `null`, nie chybu čísla.
- `requestIdentifier` sa pošle **iba vtedy, keď ho VIES vráti**. `MAKY_VAT_ID` ako žiadateľ je podmienka, aby ho VIES
  vôbec mohol vrátiť, nie záruka: pri výpadku, pri neplatnom čísle a pri odpovedi bez identifikátora pole ostane `null`.
- `STALE_CONTEXT`: storefront prečíta stav znova a pošle ešte raz s novou verziou. Druhé `STALE_CONTEXT` znamená
  „údaje sa zmenili, skontrolujte a skúste znova“, bez ďalšieho zápisu.

Prehliadač posiela serveru iba id checkoutu. Číslo, krajinu, firmu a dopravu storefront prečíta zo Saleoru sám, takže
odpoveď VIES sa nedá prilepiť k inému číslu.

**IČO a DIČ nie sú overenie firmy.** Pri slovenskej firme storefront kontroluje iba ich tvar (IČO 6 až 8 číslic, DIČ 10
číslic) a uloží ich vo vstupe zákazníka. Do VIES ide iba IČ DPH a o oslobodení rozhoduje iba backend nad odpoveďou VIES.

## Kódy chýb

Na `checkoutB2bTaxAttestationUpdate` (`CheckoutB2bTaxAttestationErrorCode`): `STALE_CONTEXT` (opakovanie podľa vyššie),
`CHECKOUT_LOCKED` (rozpracovaná platba). `INVALID_ATTESTATION`, `UNMANAGED_EXEMPTION_CONFLICT`, `NOT_FOUND`,
`INVALID`, `GRAPHQL_ERROR`, každý iný kód aj každá chyba transportu sú „nepotvrdené“.

Na existujúcich mutáciách storefront rozpozná `B2B_TAX_CONTEXT_CHANGED` a `B2B_CHECKOUT_LOCKED` (aj `CHECKOUT_LOCKED`).
Porovnáva ich ako reťazce, takže generované enumy 3.23.31 ich znať nemusia. Backend ich pridal do `CheckoutErrorCode`,
`MetadataErrorCode` (iba zámok), `PaymentErrorCode`, `TransactionInitializeErrorCode` a `OrderCreateFromCheckoutErrorCode`
(iba zmena kontextu).

| Mutácia                                                         | Čo storefront urobí                                                                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `checkoutBillingAddressUpdate` (krok Informácie aj Platba)      | zámok: hláška o rozpracovanej platbe, nie chyba poľa; zmena kontextu: nové načítanie a súhrn                          |
| `checkoutShippingAddressUpdate`, `checkoutDeliveryMethodUpdate` | zámok: hláška o rozpracovanej platbe namiesto „neplatná adresa“                                                       |
| `updateMetadata` na checkoute (uloženie `maky.b2b.input.v1`)    | zámok alebo zmena kontextu: rovnaké hlášky, vstup sa neuloží potichu                                                  |
| `transactionInitialize`                                         | `B2B_CHECKOUT_LOCKED`: zablokované; `B2B_TAX_CONTEXT_CHANGED`: nové načítanie, nová suma pre súhrn aj Stripe Elements |
| `checkoutComplete`                                              | to isté ako pri `transactionInitialize`                                                                               |

`taxExemptionManage` storefront nevolá, preto `TaxExemptionManageErrorCode.B2B_MANAGED_CHECKOUT` nepotrebuje.

## Kontrola pripravenosti (readiness)

`GET /api/internal/b2b-readiness` (len s revalidate secret, inak 404) pošle s tokenom, ktorý proces drží, **jeden** dopyt
`MakyB2bReadiness` s `operationName`. Dokument obsahuje:

- vykonávanú časť `app { id name isActive permissions { code } }`: aplikácia aktívna, `MANAGE_TAXES` aj `HANDLE_TAXES`;
  ďalšie oprávnenia sú iba varovanie;
- presne ten dopyt na stav a tú mutáciu atestácie, ktoré storefront posiela. Saleor (`SaleorGraphQLBackend`) validuje
  celý dokument a vykoná iba pomenovanú operáciu, takže mutácia sa nevykoná, ale endpoint bez kontraktu alebo s iným
  poľom, argumentom či typom vstupu dokument odmietne (HTTP 400) so správami validácie.

Introspekcia nie je potrebná a žiadny názov typu sa nekontroluje (pôvodná kontrola sa pýtala na `CheckoutB2bTaxState`,
backend ho volá `B2bTaxState`).

Odpoveď obsahuje mená, id a pravdivostné hodnoty, nikdy hodnotu tokenu. `schema.contract` je `valid`, `invalid` alebo
`unknown` (dopyt sa neposlal alebo nedobehol) a `schema.errors` nesie správy validácie Saleoru. Kódy v `failures`:

| kód                                                                  | význam                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `endpoint-missing`, `token-missing`, `requester-vat-id-missing`      | chýba `NEXT_PUBLIC_SALEOR_API_URL`, `SALEOR_B2B_APP_TOKEN`, `MAKY_VAT_ID` |
| `writes-blocked`                                                     | proces má zakázané zápisy do Saleoru; dopyt sa nepošle (obsahuje mutáciu) |
| `schema-contract-invalid`                                            | Saleor dokumenty odmietol, dôvod v `schema.errors`                        |
| `saleor-<druh>[-<status>]`                                           | Saleor neodpovedal alebo odpovedal chybou (napríklad `saleor-http-502`)   |
| `app-not-authenticated`, `app-inactive`                              | token nepatrí aktívnej aplikácii                                          |
| `permission-missing-MANAGE_TAXES`, `permission-missing-HANDLE_TAXES` | aplikácii chýba oprávnenie                                                |

Varovanie `app-has-extra-permissions`: aplikácia má viac oprávnení, než potrebuje.

Režim backendu (`MAKY_B2B_VAT_EXEMPTION_MODE`) storefront nečíta, kontrakt ho nevystavuje. Vidí iba rozhodnutie
`TAXED_DISABLED`. Pri ňom ukáže vetu o vypnutom oslobodení, ale iba zákazníkovi, ktorý zadal IČ DPH.

## Čo backend PR #16 potvrdil

1. Názvy: `B2bTaxState`, `B2bTaxDecision`, `B2bVatVerificationStatus`, `CheckoutB2bTaxAttestationInput`,
   `CheckoutB2bVatVerificationInput`, `CheckoutB2bTaxAttestationUpdate`, `CheckoutB2bTaxAttestationError(Code)`.
2. Hodnoty `decision`: `EXEMPT`, `TAXED_NOT_COMPANY`, `TAXED_NO_VAT_ID`, `TAXED_SK_VAT`, `TAXED_DOMESTIC_DELIVERY`,
   `TAXED_COUNTRY_MISMATCH`, `TAXED_UNVERIFIED`, `TAXED_INVALID`, `TAXED_UNAVAILABLE`, `TAXED_IDENTITY_REVIEW`,
   `TAXED_STALE`, `TAXED_DISABLED`, `OUT_OF_SCOPE`.
3. `b2bTaxState` je non-null a verejné pole checkoutu.
4. Stav sa vyhodnocuje spolu s cenami checkoutu v tej istej odpovedi (popis poľa), takže porovnanie súm vyššie je
   poistka, nie bežná cesta.
5. `paymentLocked: Boolean!` je súčasť stavu.
6. Rozsah: rozhodnutie nezávisí od produktov v košíku. Kontext, ktorý backend podpisuje (`Context.canonical` v
   `saleor/checkout/maky_b2b.py`), tvorí kanál, mena, vstup, fakturačná a dodacia adresa a spôsob doručenia;
   oslobodenie je natívny príznak `Checkout.tax_exemption`, teda pre celý checkout. `OUT_OF_SCOPE` je doručenie mimo
   EÚ (US/CA), nie druh tovaru. Firemný nákup preto platí pre celý sortiment, nielen pre Kargo.

Exportné kanály `us-usd` a `ca-cad`: storefront na nich B2B mutáciu ani VIES nikdy nevolá a firemné meno uloží iba ako
fakturačnú firmu.

## Známe medzery (zámerne, nie chyby)

- Keď sa UI vypne (`false`) a v Saleore ostane staré účinné oslobodenie, storefront text § 43 neukáže. Odvolanie je
  úloha backendu pri vypnutí režimu. Vypnutie UI samo nič neodvolá.
- Kartu, express aj nulovú objednávku storefront pustí iba na `ready` z kontroly pred platbou. Súbeh dvoch platieb
  a zmenu po `transactionInitialize` stráži backend zámkom. Storefront zámok iba zobrazí.
- Faktúry, KROS a refundy tu nie sú.

## Keď sa schéma backendu zmení

1. `node scripts/b2b-schema-extension.mjs <maky-saleor>/saleor/graphql/schema.graphql` prepíše
   `src/checkout/lib/b2b/maky-b2b-v1.graphql`. Skript prijme iba pridané typy, polia, hodnoty a voliteľné argumenty;
   odstránenie alebo zmenu typu odmietne. `--check` iba porovná, nič nezapíše.
2. `pnpm vitest run src/checkout/lib/b2b` (`graphql.test.ts` overí dokumenty a vykoná kontrolu pripravenosti).
3. Spoločný priechod v sandboxe s patchom a Stripe test mode podľa tabuľky v zadaní 02, §6. Výsledok sa zapíše sem a do
   `current-state.md`, s rozlíšením, čo bola maketa a čo skutočný test mode.
4. Až keď produkčný Saleor schému má, môžu sa dokumenty presunúť do `src/checkout/graphql/**` a generovať codegenom.
