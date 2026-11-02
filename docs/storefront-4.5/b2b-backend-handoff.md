# MAKY-B2B-V1: čo storefront od backendu číta a posiela

2\. 11. 2026 · storefront PR do `release/r1-thule-20261001` (vetva `claude/project-thread-1shbdz`) · pre reláciu „MAKY Backend (Saleor)“
a pre toho, kto bude spájať obe strany v sandboxe.

Tento súbor nie je druhý kontrakt. Kontrakt je text MAKY-B2B-V1 v oboch zadaniach z 2. 11. Tu je len to, ako ho storefront
prečítal a v kóde použil, a body, ktoré text nefixuje a backend ich musí potvrdiť alebo opraviť. Pri rozdiele sa najprv opraví
tento súbor aj backendový handoff, potom kód.

## Stav

- Všetko je vypnuté, kým proces nemá `B2B_CHECKOUT_UI_ENABLED=true`. Bez toho sa firemný blok neukáže, VIES sa nevolá
  a žiadny B2B dopyt nejde do Saleoru.
- Testy bežia **proti navrhnutému SDL s makety** (`src/checkout/lib/b2b/maky-b2b-v1.graphql` nad pripnutou schémou 3.23.31),
  nie proti skutočnému backendu. Žiadny priechod cez Stripe test mode ani sandbox s patchom zatiaľ nebol.
- B2B dokumenty sú reťazce v `src/checkout/lib/b2b/graphql.ts`, mimo globu codegenu. Ten beží pred každým buildom proti
  živému Saleoru a pole, ktoré živá schéma nepozná, by build zastavilo.

## Čo storefront číta

Iba s tokenom B2B aplikácie (`SALEOR_B2B_APP_TOKEN`), iba na serveri:

```graphql
checkout(id: $id) {
	id
	b2bTaxState { contextVersion decision effectiveTaxExemption checkedAt expiresAt }
	totalPrice { net { amount currency } tax { amount currency } gross { amount currency } }
}
```

- `contextVersion` je pre storefront nepriehľadný reťazec. Len ho prenesie späť ako `expectedContextVersion`.
- `decision` a kódy chýb číta storefront **ako reťazce**. Iný názov enumu nič nestojí. Iná **hodnota** sa musí zapísať do oboch handoffov.
- `effectiveTaxExemption` spolu s `decision == EXEMPT` je jediné, čo v súhrne zapne text „Bez DPH — oslobodené podľa § 43“.
- `totalPrice.gross` zo stavu sa porovná s verejným `checkout.totalPrice.gross`, ktorý číta bežný checkout. Ak sa líšia,
  storefront prečíta stav ešte raz. Ak sa líšia aj potom, výsledok je „nepotvrdené“ a platba sa nespustí.
- Storefront kontroluje aj protirečenie: EXEMPT nad sumou s daňou, alebo zdanený výsledok nad kladnou sumou bez dane.
  Oboje je „nepotvrdené“, nikdy „pokračujte s DPH“.

Verejne, bez tokenu, číta storefront len vlastný vstup zákazníka: `metafield(key: "maky.b2b.input.v1")` na checkoute.

## Čo storefront posiela

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
- `name` a `address` sú z VIES. Keď členský štát údaj nezverejní (`---`), storefront pošle `null`, nie chybu čísla.
- `requestIdentifier` sa pošle, keď ho VIES vráti (vďaka `MAKY_VAT_ID` ako žiadateľovi).
- `STALE_CONTEXT`: storefront prečíta stav znova a pošle ešte raz s novou verziou. Druhé `STALE_CONTEXT` znamená
  „údaje sa zmenili, skontrolujte a skúste znova“, bez ďalšieho zápisu.

Prehliadač posiela serveru iba id checkoutu. Číslo, krajinu, firmu a dopravu storefront prečíta zo Saleoru sám, takže
odpoveď VIES sa nedá prilepiť k inému číslu. Cookie checkoutu sa kontroluje len na privilegovanej ceste.

## Kódy chýb

Na `checkoutB2bTaxAttestationUpdate`: `STALE_CONTEXT`, `INVALID_ATTESTATION`, `CHECKOUT_LOCKED`,
`UNMANAGED_EXEMPTION_CONFLICT`, `NOT_FOUND`. Každý iný kód aj každá chyba transportu je „nepotvrdené“.

Na existujúcich mutáciách storefront rozpozná `B2B_TAX_CONTEXT_CHANGED` a `B2B_CHECKOUT_LOCKED` (aj `CHECKOUT_LOCKED`).
Porovnáva ich ako reťazce, takže generované enumy 3.23.31 ich znať nemusia. Kde ich hľadá:

| Mutácia                                                         | Čo storefront urobí                                                                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `checkoutBillingAddressUpdate` (krok Informácie aj Platba)      | zámok: hláška o rozpracovanej platbe, nie chyba poľa; zmena kontextu: nové načítanie a súhrn                          |
| `checkoutShippingAddressUpdate`, `checkoutDeliveryMethodUpdate` | zámok: hláška o rozpracovanej platbe namiesto „neplatná adresa“                                                       |
| `updateMetadata` na checkoute (uloženie `maky.b2b.input.v1`)    | zámok alebo zmena kontextu: rovnaké hlášky, vstup sa neuloží potichu                                                  |
| `transactionInitialize`                                         | `B2B_CHECKOUT_LOCKED`: zablokované; `B2B_TAX_CONTEXT_CHANGED`: nové načítanie, nová suma pre súhrn aj Stripe Elements |
| `checkoutComplete`                                              | to isté ako pri `transactionInitialize`                                                                               |

Návrh SDL rozširuje iba `CheckoutErrorCode` a `TransactionInitializeErrorCode`. Ak backend pridá kódy aj do
`MetadataErrorCode` alebo inam, storefront nemení nič.

## Kontrola pripravenosti (readiness)

`GET /api/internal/b2b-readiness` (len s revalidate secret, inak 404) sa pýta Saleoru s tokenom, ktorý proces drží:

- `app { id name isActive permissions { code } }`: aplikácia aktívna, `MANAGE_TAXES` aj `HANDLE_TAXES`. Ďalšie
  oprávnenia sú iba varovanie.
- introspekcia `__type(name: "Mutation" | "Checkout" | "CheckoutB2bTaxState")`: pole `b2bTaxState`, jeho päť polí
  a mutácia `checkoutB2bTaxAttestationUpdate`.

**Backend musí potvrdiť:** introspekcia je pre tento token na produkčnom endpointe povolená (rovnaký mechanizmus používa
`prebuild` codegen). Ak ju backend vypne, readiness hlási `schema-missing-*` a firemný blok ostane bez oslobodenia.
Vtedy treba dohodnúť iný dôkaz schémy.

Režim backendu (`MAKY_B2B_VAT_EXEMPTION_MODE`) storefront nečíta, kontrakt ho nevystavuje. Vidí iba rozhodnutie
`TAXED_DISABLED`. Pri ňom ukáže vetu o vypnutom oslobodení, ale iba zákazníkovi, ktorý zadal IČ DPH.

## Body, ktoré text kontraktu nefixuje (storefront navrhuje, backend potvrdí)

1. Názvy typov: `CheckoutB2bTaxDecision`, `CheckoutB2bTaxAttestationErrorCode`, `CheckoutB2bTaxAttestationError`,
   `CheckoutB2bVatVerificationInput`, `B2bVatVerificationStatus`. Na názvoch storefrontu nezáleží, na hodnotách áno.
2. Hodnoty `decision`: `EXEMPT`, `TAXED_NOT_COMPANY`, `TAXED_NO_VAT_ID`, `TAXED_SK_VAT`, `TAXED_DOMESTIC_DELIVERY`,
   `TAXED_COUNTRY_MISMATCH`, `TAXED_UNVERIFIED`, `TAXED_INVALID`, `TAXED_UNAVAILABLE`, `TAXED_IDENTITY_REVIEW`,
   `TAXED_STALE`, `TAXED_DISABLED`, `OUT_OF_SCOPE`. Neznáma hodnota je pre storefront „nepotvrdené“.
3. **`b2bTaxState` nesmie byť `null` pre checkout EÚ kanála**, ani keď sa ho B2B ešte nedotklo (napríklad
   `TAXED_NOT_COMPANY` alebo `OUT_OF_SCOPE` s platnou `contextVersion`). Storefront potrebuje verziu pre prvý zápis.
   Keď dostane `null`, výsledok je „nepotvrdené“ (`state-missing`) a firemný zákazník nezaplatí. B2C nákup sa to netýka,
   bez firemného vstupu sa stav nečíta.
4. Či verejný `checkout.totalPrice` je po zápise atestácie už prepočítaný v tej istej transakcii. Storefront to predpokladá
   (porovnanie súm vyššie). Ak nie, každé porovnanie skončí jedným opakovaním a potom „nepotvrdené“.
5. Exportné kanály `us-usd` a `ca-cad`: storefront na nich B2B mutáciu ani VIES nikdy nevolá a firemné meno uloží iba ako
   fakturačnú firmu.

## Známe medzery (zámerne, nie chyby)

- Keď sa UI vypne (`false`) a v Saleore ostane staré účinné oslobodenie, storefront text § 43 neukáže. Odvolanie je
  úloha backendu pri vypnutí režimu. Vypnutie UI samo nič neodvolá.
- Kartu, express aj nulovú objednávku storefront pustí iba na `ready` z kontroly pred platbou. Súbeh dvoch platieb
  a zmenu po `transactionInitialize` stráži backend zámkom. Storefront zámok iba zobrazí.
- Faktúry, KROS a refundy tu nie sú.

## Keď backend odovzdá schému

1. Nahradiť `src/checkout/lib/b2b/maky-b2b-v1.graphql` B2B časťou vygenerovanej schémy kandidáta.
2. `pnpm vitest run src/checkout/lib/b2b` (`graphql.test.ts` overí dokumenty proti nej).
3. Spoločný priechod v sandboxe s patchom a Stripe test mode podľa tabuľky v zadaní 02, §6. Výsledok sa zapíše sem a do
   `current-state.md`, s rozlíšením, čo bol mock a čo skutočný test mode.
4. Až keď produkčný Saleor schému má, môžu sa dokumenty presunúť do `src/checkout/graphql/**` a generovať codegenom.
