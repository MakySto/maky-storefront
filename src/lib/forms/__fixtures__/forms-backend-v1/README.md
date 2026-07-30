# Forms Backend V1 — server-to-server contract

Tento dokument opisuje aktuálny wire a authorization kontrakt implementovaný v:

- `src/endpoints/forms.ts`
- `src/forms/access.ts`
- `src/forms/email.ts`
- `src/forms/security.ts`
- `src/forms/submissionNumber.ts`
- `src/forms/validation.ts`
- `src/forms/immutability.ts`
- `src/collections/WithdrawalRequests.ts`
- `src/collections/ContactRequests.ts`
- `src/migrations/20260730_111111_forms_backend_v1.ts`
- `src/payload.config.ts`

Contract status je `candidate`, stable contract revision je `1.1.0` a Payload
verzia je `3.86.0`. `manifest.json` je machine-readable autorita: uvádza
canonical scenáre a SHA-256 presných bytes každého artefaktu v tomto adresári
okrem manifestu samotného. SHA-256 manifestu sa lockuje v unit teste.

Schválená seller identity a return copy sú source-controlled v
`src/forms/seller.ts`. Dokument neobsahuje SMTP credentials, Cloudflare
credentials ani hodnotu HMAC secretu.

## Architektúra a trust boundary

```text
browser
  -> storefront server action
  -> Cloudflare Access
  -> signed Payload custom endpoint
  -> Payload Local API with overrideAccess:false
  -> withdrawal-requests | contact-requests
```

Browser nesmie volať Payload priamo. Storefront server je zodpovedný za session,
Saleor order ownership, honeypot/rate limit a vytvorenie podpísaného requestu.
Payload Forms V1:

- overí raw-body HMAC, čas, body size a striktný JSON shape,
- uloží immutable submission,
- generuje submission number a serverový čas,
- zabezpečí databázovú idempotenciu,
- nevolá Saleor,
- po uložení nového withdrawal podania odošle cez Payload e-mailový adaptér
  nezávislý customer a internal e-mail.

Payload je autoritatívny producent `submittedAt`, `submissionNumber`,
`noticeSnapshot` a delivery stavu. Storefront tieto polia nikdy neposiela.
Unknown-key validácia preto okrem iného odmietne `noticeSnapshot`,
`submittedAt`, `submissionNumber` aj `emailDelivery` v create requeste.

Pri `source: "account"` CMS dôveruje podpísanému serverovému callerovi, že
`saleorOrderId` a `saleorCustomerId` overil proti server session. Samotný Forms
endpoint order ownership neoveruje.

Cloudflare Access je sieťová brána. Implementácia endpointu nekontroluje
`CF-Access-Client-Id` ani `CF-Access-Client-Secret`; ich validáciu musí vykonať
Cloudflare pred dosiahnutím originu. Priamy origin nesmie umožniť obídenie
Cloudflare. HMAC je samostatná aplikačná autorizácia, nie náhrada sieťovej
brány.

## Endpointy

Payload používa default API prefix `/api`.

| Method  | URL                                              | Účel                                               |
| ------- | ------------------------------------------------ | -------------------------------------------------- |
| `POST`  | `/api/forms/withdrawal`                          | vytvorenie alebo idempotentné načítanie odstúpenia |
| `POST`  | `/api/forms/contact`                             | vytvorenie alebo idempotentné načítanie kontaktu   |
| `PATCH` | `/api/forms/withdrawal/:id/email-delivery`       | delivery stav withdrawal záznamu                   |
| `PATCH` | `/api/forms/contact/:id/email-delivery`          | delivery stav contact záznamu                      |
| `POST`  | `/api/forms/withdrawal/:id/email-delivery/retry` | retry jednej definitívne zlyhanej e-mailovej vetvy |

`:id` je Payload record ID v canonical UUID tvare. Nie je to
`submissionId` ani `submissionNumber`.

## Povinné request headers

```text
Content-Type: application/json
X-Maky-Forms-Timestamp: <Unix seconds>
X-Maky-Forms-Submission-Id: <canonical UUID>
X-Maky-Forms-Signature: <64 lowercase hexadecimal characters>
```

Na nasadenom network path storefront navyše posiela existujúce Cloudflare
Access service-token headers. Ich hodnoty nie sú súčasťou tohto kontraktu.

### Timestamp

- Desiatkový Unix timestamp v sekundách, nie milisekundách.
- Parser prijíma 10 alebo 11 číslic.
- Bežný 13-ciferný JavaScript millisecond timestamp je `401 INVALID_TIMESTAMP`.
- Akceptované je absolútne serverové clock skew najviac `300` sekúnd.
- Presne `300` sekúnd je ešte platných; viac než `300` je
  `STALE_TIMESTAMP`.
- Platí rovnaké okno do minulosti aj do budúcnosti.

Producent a Payload host musia mať synchronizované hodiny.

### HMAC

Secret:

```text
MAKY_FORMS_HMAC_SECRET
```

Musí mať aspoň 32 UTF-8 bytes. Secret je server-only a nesmie byť
`NEXT_PUBLIC_*`, v HTML, RSC flight dátach, client bundle, logoch ani fixtures.

Podpis:

```text
HMAC-SHA256(timestamp + "." + rawBody, MAKY_FORMS_HMAC_SECRET)
```

Výsledok sa posiela ako presne 64 lowercase hex znakov. Payload podpis porovnáva
constant-time. `rawBody` znamená presné UTF-8 bytes odoslaného JSON textu:
whitespace a poradie keys menia podpis. Producent musí podpísať ten istý string,
ktorý odošle; nesmie objekt po podpise znovu serializovať.

Timestamp je v podpísanom preimage jeho presný header string. Napríklad pre
header `X-Maky-Forms-Timestamp: 1785412800` a raw body bytes `BODY` je preimage
presne `1785412800.BODY`; bez newline alebo iného separatora navyše.

`X-Maky-Forms-Submission-Id` sa normalizuje na lowercase a po overení podpisu
sa musí rovnať normalizovanému `submissionId` v podpísanom body.

### Body size a media type

- Maximálny raw body je `64 KiB`, presne `65 536` UTF-8 bytes.
- Ak `Content-Length` existuje, musí byť nezáporné celé desiatkové číslo.
- Príliš veľký deklarovaný body sa odmietne pred čítaním.
- Skutočná raw-body veľkosť sa overí vždy, aj pri chunked requeste.
- Media type musí byť `application/json`; parameter ako `charset=utf-8` je
  povolený.
- Neznáme JSON keys sa odmietajú na top-level aj vo vnorených objektoch.

### Presné request fixtures

Úplný zoznam a rola fixtures sú v `manifest.json`. Canonical storefront
withdrawal requesty sú najmä:

- `fixtures/withdrawal-guest-whole-order.request.json` (`phone: null`),
- `fixtures/withdrawal-guest-selected-items.request.json` (reálna phone value),
- `fixtures/withdrawal-account-phone-value.request.json`.

Ďalšie hash-locknuté fixtures dokazujú missing/empty/trim/non-ASCII phone,
akceptovanie 32 normalizovaných Unicode znakov aj s okolitým whitespace,
odmietnutie control characters a 33-znakovej hodnoty, obidva retry kanály,
crash recovery z `pending`/attempt `0`, obidva reconciliation outcomes a
canonical create/duplicate response. Strict
request schéma je `withdrawal.schema.json`.

Každý canonical create request súbor predstavuje presný validný `rawBody`. Pri fixture-based
signature teste sa podpisujú nezmenené bytes celého súboru vrátane jeho
koncového LF a presne tie isté bytes sa odošlú. Produkčný caller môže použiť
iné JSON whitespace alebo poradie keys, ale vždy musí podpísať presne výsledný
odosielaný string. Súbory s `.invalid.` v názve sú zámerne validný JSON, ktorý
produkčný parser musí odmietnuť.

### Normatívne normalizované string pravidlá

`withdrawal.schema.json` je machine-readable autorita iba vtedy, keď consumer
pred použitím štandardných JSON Schema assertions vykoná aj custom `x-*` keywords,
ktoré sú označené ako normatívne. Draft 2020-12 validator, ktorý ich ignoruje,
poskytuje iba structural precheck typov, required fields, enumov a raw patterns.

Poradie normalizácie je:

1. overiť raw JSON type a prípadný raw `pattern`,
2. použiť ECMAScript `String.prototype.trim()`,
3. aplikovať `x-normalization`,
4. aplikovať `x-normalizedMinLength`, `x-normalizedMaxLength`, length unit,
   normalizovaný pattern a format.

Význam custom keywords:

- `trim-required` po trim odmieta prázdnu hodnotu; preto má
  `x-normalizedMinLength: 1`,
- `trim-empty-to-null` mapuje missing, `null`, empty a whitespace-only na `null`,
- `x-normalizedLengthUnit: utf16-code-units` zodpovedá JavaScript `.length`, kým
  withdrawal phone používa `unicode-code-points` zodpovedajúce `Array.from()`,
- e-mailový `maky-form-email-v1` používa po trim presný
  `x-normalizedPattern` a `x-normalizedPatternFlags` z runtime
  `validateFormEmail`; štandardný raw `format: email` nie je jeho náhradou.

## Withdrawal create

### Request

```json
{
  "submissionId": "018f0000-0000-7000-8000-000000000003",
  "source": "guest",
  "market": "SK",
  "locale": "sk",
  "customer": {
    "name": "Meno zákazníka",
    "email": "customer@example.com",
    "phone": null
  },
  "contract": {
    "orderNumber": "ORDER-10001",
    "saleorOrderId": null,
    "saleorCustomerId": null
  },
  "scope": "selectedItems",
  "items": [
    {
      "orderLineId": null,
      "productName": "Názov položky",
      "sku": null,
      "quantity": 1
    }
  ],
  "note": null,
  "legalNoticeVersion": "withdrawal-notice-version",
  "privacyNoticeVersion": "privacy-notice-version"
}
```

Povolené top-level keys sú presne:

```text
submissionId source market locale customer contract scope items note
legalNoticeVersion privacyNoticeVersion
```

`customer` povoľuje iba `name`, `email`, `phone`. Phone je optional/nullable,
trimuje sa, missing/empty/whitespace-only sa normalizuje na `null`, po trim má
maximum 32 Unicode znakov a nesmie obsahovať C0/C1 control characters vrátane
CR/LF. E.164 formát sa nevynucuje a phone nemá marketingový ani consent
význam. `contract` povoľuje iba
`orderNumber`, `saleorOrderId`, `saleorCustomerId`. Item povoľuje iba
`orderLineId`, `productName`, `sku`, `quantity`.

`noticeSnapshot`, `submissionNumber`, `submittedAt`, workflow polia a
`emailDelivery` nie sú request keys. Storefront ich nesmie zostavovať ani
posielať; request s ktorýmkoľvek z nich je `400 INVALID_REQUEST`.

Scope invariant:

- `wholeOrder`: `items` musí chýbať, byť `null` alebo byť prázdne pole.
- `selectedItems`: `items` musí obsahovať 1 až 100 položiek.

Pri guest partial withdrawal môžu byť `orderLineId` aj `sku` explicitne `null`,
ale `productName` zostáva povinný a `quantity` musí byť kladné celé číslo.
Samotná `note` bez aspoň jednej položky nie je validné `selectedItems` podanie.

Endpoint neprijíma address, ordered/received date, refund IBAN ani reason for withdrawal.

### Server-controlled hodnoty

Pri novom zázname Payload generuje:

```text
submissionNumber               = "ODS-" + UTC year + "-" + 6-digit DB sequence
submittedAt                    = server ISO-8601 timestamp
noticeSnapshot                 = normalized immutable request snapshot
orderMatchStatus               = pending
workflowStatus                 = received
emailDelivery.customerStatus   = pending, potom unknown počas pokusu a výsledok
emailDelivery.internalStatus   = pending, potom unknown počas pokusu a výsledok
emailDelivery.*AttemptCount    = 0, potom inkrement pred každým SMTP pokusom
emailDelivery.*LastAttemptAt   = null, potom server timestamp rezervácie pokusu
emailDelivery.*LastAttemptId   = null, potom nový serverový canonical UUID rezervácie
```

Storefront neposkytuje žiadnu z týchto hodnôt.

`customerLastAttemptId` a `internalLastAttemptId` sú server-only ownership
tokeny. Payload generuje nový odlišný lowercase UUID pre každú channel
rezerváciu. Nie sú provider message ID, HMAC secret ani caller capability;
create, PATCH ani retry caller ich nikdy neposiela.

`noticeSnapshot` sa vytvorí z normalizovaného vstupu:

```json
{
  "schemaVersion": 1,
  "source": "guest",
  "market": "SK",
  "locale": "sk",
  "customer": {
    "name": "Meno zákazníka",
    "email": "customer@example.com",
    "phone": "+421 901 730 066"
  },
  "contract": {
    "orderNumber": "ORDER-10001"
  },
  "scope": "selectedItems",
  "items": [
    {
      "orderLineId": null,
      "productName": "Názov položky",
      "sku": null,
      "quantity": 1
    }
  ],
  "note": null,
  "legalNoticeVersion": "withdrawal-notice-version",
  "privacyNoticeVersion": "privacy-notice-version"
}
```

Snapshot a pôvodné submission fields sú immutable.

### Nový záznam — `201`

```json
{
  "ok": true,
  "duplicate": false,
  "submission": {
    "id": "018f1000-0000-7000-8000-000000000001",
    "submissionId": "018f0000-0000-7000-8000-000000000003",
    "submissionNumber": "ODS-2026-000001",
    "submittedAt": "2026-07-30T12:00:00.000Z",
    "noticeSnapshot": {
      "schemaVersion": 1,
      "source": "guest",
      "market": "SK",
      "locale": "sk",
      "customer": {
        "name": "Meno zákazníka",
        "email": "customer@example.com",
        "phone": "+421 901 730 066"
      },
      "contract": {
        "orderNumber": "ORDER-10001"
      },
      "scope": "selectedItems",
      "items": [
        {
          "orderLineId": null,
          "productName": "Názov položky",
          "sku": null,
          "quantity": 1
        }
      ],
      "note": null,
      "legalNoticeVersion": "withdrawal-notice-version",
      "privacyNoticeVersion": "privacy-notice-version"
    },
    "emailDelivery": {
      "customerStatus": "sent",
      "customerSentAt": "2026-07-30T12:00:01.000Z",
      "customerAttemptCount": 1,
      "customerLastAttemptAt": "2026-07-30T12:00:00.500Z",
      "internalStatus": "sent",
      "internalSentAt": "2026-07-30T12:00:01.500Z",
      "internalAttemptCount": 1,
      "internalLastAttemptAt": "2026-07-30T12:00:00.500Z"
    }
  }
}
```

Create acknowledgement zámerne nikdy nevracia provider message ID ani interné
fixed error/reconciliation polia.

### Idempotentný duplicate — `200`

Shape je rovnaký ako `201`, ale:

```json
{
  "ok": true,
  "duplicate": true
}
```

`submission` obsahuje pôvodný record, pôvodný `submittedAt`, pôvodný
`noticeSnapshot` aj aktuálny verejný `emailDelivery`. Duplicate
request nikdy znovu neodosiela customer ani internal e-mail, a to ani keď je
uložený stav `pending`, `failed` alebo `unknown`.

## Contact create

### Request

```json
{
  "submissionId": "018f0000-0000-7000-8000-000000000002",
  "source": "account",
  "market": "SK",
  "locale": "sk",
  "customer": {
    "name": "Meno zákazníka",
    "email": "customer@example.com",
    "phone": null
  },
  "topic": "productAdvice",
  "order": {
    "orderNumber": "ORDER-10001",
    "saleorOrderId": "saleor-order-id",
    "saleorCustomerId": "saleor-customer-id"
  },
  "message": "Text správy.",
  "privacyNoticeVersion": "privacy-notice-version"
}
```

Povolené top-level keys sú presne:

```text
submissionId source market locale customer topic order message
privacyNoticeVersion
```

`customer` povoľuje iba `name`, `email`, `phone`. `order` je voliteľný, môže
byť `null`, alebo povoľuje iba `orderNumber`, `saleorOrderId`,
`saleorCustomerId`.

Topics:

```text
productAdvice
orderStatus
shipping
returns
complaint
payment
account
businessCooperation
other
```

Nie je podporované marketing-consent pole. Contact podanie sa nestáva
withdrawal podaním.

### Server-controlled hodnoty

```text
submissionNumber = "KON-" + UTC year + "-" + 6-digit DB sequence
submittedAt       = server ISO-8601 timestamp
status            = new
emailDelivery.customerStatus = pending
emailDelivery.internalStatus = pending
emailDelivery.customerAttemptCount = 0
emailDelivery.internalAttemptCount = 0
```

Contact nemá samostatný JSON snapshot field. Normalizované immutable contact
fields v kolekcii sú autoritatívny obsah použitý pri idempotency porovnaní.

### Nový záznam — `201`

```json
{
  "ok": true,
  "duplicate": false,
  "submission": {
    "id": "018f1000-0000-7000-8000-000000000002",
    "submissionId": "018f0000-0000-7000-8000-000000000002",
    "submissionNumber": "KON-2026-000001",
    "submittedAt": "2026-07-30T12:00:00.000Z",
    "emailDelivery": {
      "customerStatus": "pending",
      "customerSentAt": null,
      "customerAttemptCount": 0,
      "customerLastAttemptAt": null,
      "internalStatus": "pending",
      "internalSentAt": null,
      "internalAttemptCount": 0,
      "internalLastAttemptAt": null
    }
  }
}
```

Idempotentný duplicate vracia rovnaký shape s HTTP `200` a
`duplicate: true`.

Contact create v tejto verzii automaticky neposiela e-mail; response vracia
aktuálny uložený delivery stav. Storefront nie je jeho bežný delivery actor.

## Human-readable submission numbers

`submissionNumber` má presne jeden z týchto tvarov:

```text
ODS-YYYY-NNNNNN
KON-YYYY-NNNNNN
```

`ODS` označuje withdrawal a `KON` contact. `YYYY` je UTC rok serverového
`submittedAt`; `NNNNNN` je šesťmiestna hodnota samostatnej PostgreSQL sequence
pre daný form type. Sekvencie sa na začiatku roka neresetujú, takže counter
pokračuje aj pri zmene `YYYY`. Medzery v číslovaní sú povolené a očakávané,
napríklad po rollbacknutej transakcii alebo create race.

Číslo generuje Payload pri create a caller ho nesmie posielať. `submissionId`
zostáva nezmenený canonical UUID idempotency key; human number ho nenahrádza.
Databázová unique ochrana bráni opakovaniu čísla aj pri súbežných create.

## Payload-owned withdrawal email

Automatické withdrawal e-maily vlastní Payload endpoint a odosiela ich cez
`payload.sendEmail` až po úspešnom uložení nového podania. Delivery update je
in-process Local API operácia, nie callback zo storefrontu.

Poradie operácií je:

1. uložiť nový immutable withdrawal record vrátane snapshotu, čísla a pending
   delivery a **commitnúť create transakciu**,
2. v krátkej advisory-lock transakcii rezervovať oba pokusy (`unknown`,
   `attemptCount + 1`, `lastAttemptAt`, nový channel-specific `lastAttemptId`) a
   commitnúť rezerváciu,
3. samostatným read-only persisted rereadom potvrdiť celú rezervovanú channel
   state vrátane count/time/token; až potom iba z persisted `noticeSnapshot`,
   `submissionNumber` a `submittedAt` zostaviť kanonické plaintext oznámenie,
4. mimo DB transakcie skúsiť customer a potom internal odoslanie,
5. v krátkej advisory-lock transakcii uložiť výsledok iba pri zhode
   `unknown` + expected count + presný reservation token, znovu potvrdiť
   persisted výsledok a vrátiť create acknowledgement.

Kanonické oznámenie obsahuje:

- schválenú presnú identitu predávajúceho,
- `submissionNumber` a serverový `submittedAt`,
- celý autoritatívny `noticeSnapshot`,
- číslo objednávky, scope a všetky položky vrátane quantity,
- schválené aktuálne pokyny na vrátenie.

Phone sa do oboch receiptov renderuje len pri non-null normalizovanej hodnote.
Seller a return text sú source-controlled v `src/forms/seller.ts`. Presná adresa
na vrátenie je `Stará Vajnorská 11, 831 04 Bratislava`; je vedome duplikovaná
s autoritatívnym storefront `src/config/company.ts` a cross-repo zmenu treba
urobiť koordinovane.

Rovnaký autoritatívny notice blok sa posiela zákazníkovi aj interne. Customer
recipient je persisted customer e-mail; internal recipient je
`info@maky.store`. Obe správy explicitne používajú
`From: MAKY.STORE <info@maky.store>`. Customer `Reply-To` je `info@maky.store`;
internal `Reply-To` je normalizovaný customer e-mail. Každá header hodnota
prechádza CR/LF/control-char ochranou.

Oba e-maily majú úplný `text/plain` variant. HTML je len bezpečné zobrazenie
toho istého textu: každá submitted aj runtime textová hodnota sa HTML-escapuje,
nie je interpretovaná ako markup.

Customer a internal pokus sú nezávislé. Každý používa Nodemailer transport
deadlines pre DNS, connection, greeting a socket fázu. Aplikačný
`Promise.race` sa zámerne nepoužíva: `sendEmail` nevie abortovať a mohol by
označiť správu ako failed, hoci ju provider neskôr prijme. Definitívne SMTP
odmietnutie je `failed`; timeout/socket/neklasifikovaný výsledok je `unknown` a
pred retry vyžaduje explicitnú operator reconciliation. Sanitizovaný Postmark
provider ID sa uloží iba ak transport response obsahuje ukotvené
`queued as <UUID>`. Po persistovaní podania zlyhanie jedného, oboch alebo
delivery-state update nikdy nezmení
create na chybu: acknowledgement zostáva `201` a vracia najlepší uložený stav
oboch delivery vetiev. Do logu nejde submission body, PII, SMTP error objekt,
credentials ani stack trace.

Idempotentný duplicate iba vráti pôvodný record a aktuálny delivery stav. Nikdy
nespustí nové odoslanie, bez ohľadu na uložené delivery statusy.

## Email-delivery PATCH

Signed PATCH zostáva úzkym operational seamom pre autorizovanú recovery a
reconciliation. Sám e-mail neodosiela. Storefront nie je jeho bežný caller a
nesmie ho volať ako normálne pokračovanie úspešného create.

State-only patch má rovnaký tvar pre obe kolekcie; `formType` sa musí zhodovať
s URL:

```json
{
  "formType": "withdrawal",
  "submissionId": "018f0000-0000-7000-8000-000000000001",
  "emailDelivery": {
    "internalStatus": "failed",
    "internalProviderMessageId": null,
    "internalLastError": "WITHDRAWAL_EMAIL_INTERNAL_SEND_FAILED"
  }
}
```

Povolené delivery keys:

```text
customerStatus
customerProviderMessageId
customerLastError
internalStatus
internalProviderMessageId
internalLastError
```

Aspoň jeden musí byť prítomný. Status hodnoty:

```text
pending
sent
failed
unknown
```

Last-error hodnoty sú iba fixed non-PII kódy definované v
`EMAIL_DELIVERY_ERROR_VALUES`; arbitrary SMTP text, header, stack, secret ani
PII nie sú platné. Provider message ID je optional/null, single-line, bez
control characters a max 128 znakov.

Caller nesmie posielať `sentAt`, `attemptCount`, `lastAttemptAt`,
`lastAttemptId` ani `lastReconciledAt`. Endpoint ich generuje a attempt token
zachováva ako server-only state. Po `sent` nemožno vetvu downgradovať. Stav
`unknown` nemožno zmeniť generic patchom; vyžaduje explicitnú reconciliation:

```json
{
  "formType": "withdrawal",
  "submissionId": "018f0000-0000-7000-8000-000000000003",
  "reconciliation": {
    "channel": "customer",
    "expectedAttemptCount": 1,
    "outcome": "accepted",
    "providerMessageId": "018f2000-0000-7000-8000-000000000001"
  }
}
```

`outcome` je `accepted` alebo `notAccepted`. `notAccepted` nesmie obsahovať
provider ID, nastaví vetvu na `failed` a tým ju sprístupní retry. `accepted`
nastaví `sent`. Obe vetvy sa reconciliujú nezávisle a request musí uviesť
aktuálny `expectedAttemptCount`.

Signed PATCH operácie nad rovnakým `formType:id` sa serializujú v jednej
PostgreSQL transakcii pomocou transaction-scoped advisory locku. Handler až pod
lockom znovu načíta record, zlúči iba povolené delivery polia a uloží ho v tej
istej transakcii. Súbežná customer/internal aktualizácia sa preto nestratí a
súbežný pokus znížiť už dosiahnutý stav `sent` skončí `409`.

Signed PATCH a signed retry endpoint sú jediné write-authorized delivery seams.
Payload admin môže celý delivery stav vrátane `customerLastAttemptId` a
`internalLastAttemptId` čítať pre audit, ale polia sú read-only a raw
REST/GraphQL/admin zápis je odmietnutý. Token je dôkaz vlastníctva konkrétnej
serverovej rezervácie, nie bearer credential pre admina ani operatora. Preto
všetci autorizovaní writery používajú rovnaký advisory lock. Collection
`beforeChange` hook navyše vynucuje monotónnosť a server-owned metadata ako
defense-in-depth; interný caller nesmie obísť serializovaný seam cez
`overrideAccess: true`.

URL `:id`, body `submissionId` a uložený record sa musia zhodovať. To zabraňuje
použitiu platného podpisu proti inému recordu.

### Úspech — `200`

```json
{
  "ok": true,
  "submission": {
    "id": "018f1000-0000-7000-8000-000000000001",
    "submissionId": "018f0000-0000-7000-8000-000000000001",
    "emailDelivery": {
      "customerStatus": "sent",
      "customerSentAt": "2026-07-30T12:05:00.000Z",
      "customerAttemptCount": 1,
      "customerLastAttemptAt": "2026-07-30T12:00:00.500Z",
      "internalStatus": "failed",
      "internalSentAt": null,
      "internalAttemptCount": 1,
      "internalLastAttemptAt": "2026-07-30T12:00:00.500Z"
    }
  }
}
```

Verejný acknowledgement zostáva presne osem-poľový. Zámerne nevracia provider
ID, last-error, reconciliation metadata ani server-only `customerLastAttemptId`
alebo `internalLastAttemptId`.

## Withdrawal e-mail retry

`POST /api/forms/withdrawal/:id/email-delivery/retry` je samostatný HMAC-signed
operational resend endpoint. Canonical body:

```json
{
  "formType": "withdrawal",
  "submissionId": "018f0000-0000-7000-8000-000000000003",
  "channel": "customer",
  "expectedAttemptCount": 1
}
```

Endpoint retryuje presne jeden `customer` alebo `internal` kanál. Bežne je
retryable iba definitívny `failed` stav. Úzka crash-recovery výnimka povoľuje
`pending` iba ak persisted `attemptCount` je presne `0`: pokrýva pád po commitnutí
create, ale pred rezerváciou initial SMTP pokusu. `pending` s iným count nie je
retryable. `sent` sa vždy odmietne a `unknown` vyžaduje najprv explicitnú PATCH
reconciliation. Retry `expectedAttemptCount` je safe integer `0..1000000`;
reconciliation count zostáva `1..1000000`. Expected count je caller-visible
replay guard. Caller neposiela ani nedostáva `lastAttemptId`; ten generuje
Payload ako interný ownership token presnej rezervácie.

Pod rovnakým transaction-scoped advisory lockom endpoint znovu načíta record,
overí target/status/count, inkrementuje count, nastaví `lastAttemptAt`, nový
unikátny `lastAttemptId` a `unknown`, potom rezerváciu commitne. Pred SMTP
samostatný persisted reread musí potvrdiť presnú rezervovanú channel state
vrátane tokenu. SMTP prebehne až mimo DB transakcie. Výsledok sa finalizuje
druhou krátkou locked transakciou iba pri stále rovnakom `unknown`, attempt
count aj `lastAttemptId`; následne sa persisted výsledok znovu potvrdí. Token
tak viaže výsledok na konkrétnu commitnutú rezerváciu, nie iba na číslo
generácie. Súbežné retry sa serializujú a iba jeden môže rezervovať daný count.

Definitívne odmietnutie skončí `failed`; timeout/socket/nejasný výsledok zostáva
`unknown`. Ak SMTP prebehne, ale finalizačný DB update zlyhá, konzervatívne
zostáva už commitnutý `unknown`, aby caller neposlal správu naslepo znovu.
Úspešná odpoveď používa rovnaký verejný osem-poľový delivery acknowledgement.
Retry nikdy nemení immutable submission fields a duplicate create ho nikdy
nespúšťa.

## Idempotency a same-ID conflict

`submissionId` je unique a indexed samostatne v každej kolekcii. Databázový
unique index je autoritatívny aj pri súbežných requestoch:

1. endpoint vyhľadá existujúci record,
2. ak neexistuje, skúsi create,
3. pri create race/error znovu vyhľadá ten istý `submissionId`,
4. porovná normalizovaný immutable obsah.

Výsledky:

| Stav                                     |  HTTP | Výsledok                          |
| ---------------------------------------- | ----: | --------------------------------- |
| nový ID                                  | `201` | nový record, `duplicate: false`   |
| rovnaký ID + rovnaký normalizovaný obsah | `200` | pôvodný record, `duplicate: true` |
| rovnaký ID + odlišný obsah               | `409` | `SUBMISSION_ID_CONFLICT`          |

Withdrawal porovnáva serverom zostavený `noticeSnapshot` a samostatne uložené
interné `saleorOrderId` a `saleorCustomerId`; tieto interné ID nie sú súčasťou
snapshotu ani response. Contact porovnáva normalizovaný immutable content
snapshot zostavený z uloženého recordu.

Normalizácia trimuje stringy, prázdne voliteľné stringy mení na `null` a UUID
mení na lowercase. E-mail nemení na lowercase; zmena jeho case je preto zmena
obsahu. Idempotencia je per collection: rovnaký UUID v contact a withdrawal
kolekcii sú dve oddelené identity.

Platný replay v 300-sekundovom HMAC okne je bezpečný duplicate. Replay po
uplynutí okna je `STALE_TIMESTAMP`.

## Market–locale mapping

Vstup musí byť presne jedna z týchto dvojíc:

| Market | Locale |
| ------ | ------ |
| `SK`   | `sk`   |
| `CZ`   | `cs`   |
| `PL`   | `pl`   |
| `HU`   | `hu`   |
| `RO`   | `ro`   |
| `AT`   | `de`   |
| `DE`   | `de`   |
| `IT`   | `it`   |
| `FR`   | `fr`   |
| `ES`   | `es`   |
| `US`   | `en`   |
| `CA`   | `en`   |

Iná kombinácia je `400 INVALID_REQUEST` s message
`locale does not match market.`.

## Field limits

Všetky limity znakov sa aplikujú po `trim()`.

| Field                                 | Pravidlo                                              |
| ------------------------------------- | ----------------------------------------------------- |
| `submissionId`                        | hyphenated hex `8-4-4-4-12`, 36 znakov                |
| `submissionNumber`                    | server-only, presne 15 znakov, `ODS/KON-YYYY-NNNNNN`  |
| `source`                              | `guest \| account`                                    |
| `customer.name`                       | required, max 200                                     |
| `customer.email`                      | required, max 320, základná `local@domain.tld` syntax |
| withdrawal `contract.orderNumber`     | required, max 128                                     |
| withdrawal `customer.phone`           | optional/null, trim, max 32, bez C0/C1 controls       |
| `saleorOrderId`, `saleorCustomerId`   | optional, max 128                                     |
| withdrawal `scope`                    | `wholeOrder \| selectedItems`                         |
| withdrawal `items`                    | max 100                                               |
| `items[].orderLineId`                 | optional, max 128                                     |
| `items[].productName`                 | required, max 300                                     |
| `items[].sku`                         | optional, max 128                                     |
| `items[].quantity`                    | safe integer, `1..10000`                              |
| withdrawal `note`                     | optional, max 5000                                    |
| `legalNoticeVersion`                  | withdrawal required, max 128                          |
| `privacyNoticeVersion`                | required, max 128                                     |
| contact `customer.phone`              | optional, max 50                                      |
| contact `message`                     | required, max 10000                                   |
| delivery `*ProviderMessageId`         | optional/null, max 128, single-line                   |
| delivery `*LastError`                 | optional/null, iba fixed non-PII error enum           |
| retry `expectedAttemptCount`          | safe integer, `0..1000000`                            |
| reconciliation `expectedAttemptCount` | safe integer, `1..1000000`                            |
| raw request body                      | max 65 536 UTF-8 bytes                                |

Optional string `undefined`, `null`, `""` alebo whitespace-only sa normalizuje
na `null`. Číselná quantity sa nesmie posielať ako string.

## Error response a status codes

Všetky custom endpoint responses majú:

```text
Cache-Control: no-store, max-age=0
X-Content-Type-Options: nosniff
Content-Type: application/json
```

Error envelope:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Description without submitted PII."
  }
}
```

Consumer má vetviť podľa HTTP statusu a `error.code`, nie podľa message textu.

|  HTTP | Code                                        | Podmienka                                          |
| ----: | ------------------------------------------- | -------------------------------------------------- |
| `400` | `INVALID_CONTENT_LENGTH`                    | neplatný `Content-Length`                          |
| `400` | `INVALID_REQUEST_BODY`                      | body nie je dostupný alebo nie je validné UTF-8    |
| `400` | `INVALID_REQUEST`                           | malformed JSON, unknown key alebo field validation |
| `400` | `INVALID_RECORD_ID`                         | PATCH `:id` nie je canonical UUID                  |
| `400` | `EMAIL_DELIVERY_ERROR_REQUIRED`             | stav `failed`/`unknown` vyžaduje fixed error code  |
| `401` | `MISSING_TIMESTAMP`                         | chýba timestamp header                             |
| `401` | `INVALID_TIMESTAMP`                         | timestamp nemá 10–11 číslic                        |
| `401` | `STALE_TIMESTAMP`                           | clock skew je väčší než 300 s                      |
| `401` | `MISSING_SIGNATURE`                         | chýba signature header                             |
| `401` | `INVALID_SIGNATURE`                         | podpis nemá lowercase-hex shape alebo nesedí       |
| `401` | `INVALID_SUBMISSION_ID_HEADER`              | chýba/neplatný submission header                   |
| `404` | `FORM_NOT_FOUND`                            | PATCH record neexistuje                            |
| `409` | `SUBMISSION_ID_CONFLICT`                    | ten istý ID má iný immutable obsah                 |
| `409` | `SUBMISSION_TARGET_MISMATCH`                | PATCH body ID nepatrí URL recordu                  |
| `409` | `DELIVERY_STATUS_REGRESSION`                | downgrade zo `sent`                                |
| `409` | `DELIVERY_ATTEMPT_STATE_INVALID`            | generic PATCH nesmie vstúpiť do `unknown`          |
| `413` | `BODY_TOO_LARGE`                            | declared alebo actual body nad 64 KiB              |
| `409` | `EMAIL_DELIVERY_ATTEMPT_MISMATCH`           | stale/replayed attempt count                       |
| `409` | `EMAIL_DELIVERY_ALREADY_SENT`               | sent vetva sa nesmie retryovať                     |
| `409` | `EMAIL_DELIVERY_NOT_RETRYABLE`              | stav nie je failed ani pending s count `0`         |
| `409` | `EMAIL_DELIVERY_RECONCILIATION_REQUIRED`    | unknown vyžaduje reconciliation                    |
| `409` | `EMAIL_DELIVERY_RECONCILIATION_NOT_ALLOWED` | reconciliation iba pre unknown                     |
| `409` | `EMAIL_DELIVERY_ALREADY_ATTEMPTED`          | initial pokus už bol rezervovaný                   |
| `409` | `EMAIL_DELIVERY_ATTEMPT_LIMIT`              | attempt counter dosiahol limit                     |
| `415` | `UNSUPPORTED_MEDIA_TYPE`                    | media type nie je `application/json`               |
| `500` | `FORMS_INTERNAL_ERROR`                      | neočakávané bezpečne redigované zlyhanie           |
| `500` | `EMAIL_DELIVERY_STATE_INVALID`              | neplatný persisted delivery attempt count          |
| `503` | `FORMS_AUTH_UNAVAILABLE`                    | HMAC secret chýba alebo má menej než 32 bytes      |

Raw Payload collection REST/GraphQL chyby používajú štandardný Payload error
shape, nie tento custom forms envelope.

Neočakávané endpoint zlyhanie loguje iba structured event a operation name.
Caught database/SMTP/error objekt ani plný submission body sa do logu
neposiela.

## Collection access matrix

| Operácia                             | Anonymous raw REST/GraphQL | Payload admin |          Signed forms endpoint |
| ------------------------------------ | -------------------------: | ------------: | -----------------------------: |
| create submission                    |                        nie |           nie |                            áno |
| read submission/PII                  |                        nie |           áno | nie je všeobecný read endpoint |
| update immutable submission fields   |                        nie |           nie |                            nie |
| update workflow/status/internal note |                        nie |           áno |                            nie |
| update/retry `emailDelivery`         |                        nie |           nie | áno, iba PATCH/retry allowlist |
| delete                               |                        nie |           nie |                            nie |

Raw create je odmietnutý aj autentifikovanému adminovi. Vytvárať sa dá iba cez
HMAC handler.

### Object capability a Local API

Create a delivery authorization používa frozen object identity uloženú v
`req.context`, nie string/boolean bearer flag. Externý REST alebo GraphQL JSON
nevie vytvoriť rovnakú object identity.

HMAC handler volá Local API create/update s:

```text
overrideAccess: false
context: exact in-process capability object
```

Preto stále prejde collection aj field access. Delivery capability povoľuje iba
`emailDelivery`; handler navyše parsuje explicitný JSON allowlist a nikdy
neposiela pôvodné submission fields do update.

Interné idempotency/target lookupy používajú read-only Local API
`overrideAccess: true`, `depth: 0`. Táto výnimka sa nepoužíva na create/update
a nie je dostupná callerovi.

Field-level update access je primárna immutable ochrana. Collection
`beforeChange` hook navyše deep-porovná immutable fields a odmietne ich zmenu
`403 IMMUTABLE_SUBMISSION` aj pri budúcom internom update, ktorý by omylom
použil `overrideAccess: true`. Druhý collection hook chráni monotónny
`emailDelivery`, server-owned timestamps aj attempt ownership tokeny ako defense-in-depth. Autorizačná a
concurrency hranica však ostáva signed PATCH/retry; nový interný delivery writer
musí použiť rovnaký advisory lock a nesmie zaviesť paralelnú `overrideAccess` write
cestu.

## E-mail configuration ground truth

Payload `3.86.0` má nakonfigurovaný Nodemailer adapter. Contract používa iba
názvy runtime configu, nikdy ich hodnoty:

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM_ADDRESS
SMTP_FROM_NAME
```

Adapter má `skipVerify: true`. Transport má `secure: false`, `requireTLS: true`,
default port `587` a timeouty `dnsTimeout: 10000`,
`connectionTimeout: 10000`, `greetingTimeout: 10000`,
`socketTimeout: 20000`. Locked sender decision aj adapter fallback sú:

```text
SMTP_FROM_ADDRESS=info@maky.store
SMTP_FROM_NAME=MAKY.STORE
```

Withdrawal renderer nastavuje tento `From` explicitne. `info@maky.store` je
operatorom potvrdený ako verified sender. Source ani env prítomnosť však samy
nedokazujú aktuálnu dostupnosť Postmark credentials; pred release zostáva
provider/config acceptance gate. Tento branch neposiela externý testovací
e-mail.

Seller identity a return instructions už nie sú runtime env vstupy. Sú
source-controlled v `src/forms/seller.ts`; env mená
`MAKY_FORMS_SELLER_IDENTITY` a `MAKY_FORMS_RETURN_INSTRUCTIONS` sa nepoužívajú.

## Production SSM a migration checkpoint

Tento branch nesmie sám meniť SSM, aplikovať produkčnú migráciu, deployovať ani
reštartovať služby.

Pred produkčným release musí human-operated checkpoint potvrdiť:

1. Jediná Forms Backend V1 batch migrácia bola manuálne skontrolovaná vrátane
   UP, DOWN, oboch tables, unique indexov a oboch PostgreSQL sequences.
2. Draft PR CI prešiel na fresh PostgreSQL DB vrátane Forms DB suite.
3. Ten istý candidate prešiel upgrade testom zo schema stavu aktuálneho
   `main`.
4. Handoff obsahuje skutočné fresh/upgrade DB výsledky; candidate sa nesmie
   označiť `prod-approved`, kým nie sú oba zelené.
5. Pred RDS aplikáciou existuje overený recovery snapshot/backup.
6. `MAKY_FORMS_HMAC_SECRET` bol vytvorený v schválenom SSM/runtime secret
   mechanizme ako minimálne 32 náhodných bytes a dostane ho iba Payload a
   oprávnený storefront server-side runtime, nikdy browser.
7. Review potvrdil presné source-controlled seller/return texty vrátane
   koordinovanej duplicity return address so storefrontom.
8. Recursive `get-parameters-by-path` loader načíta `MAKY_FORMS_HMAC_SECRET`
   automaticky; tento source nevyžaduje samostatnú renderer allowlist zmenu.
9. Pred release human operator zmení existujúce SSM/runtime hodnoty presne
   na `SMTP_FROM_ADDRESS=info@maky.store` a `SMTP_FROM_NAME=MAKY.STORE`;
   tento branch túto externú zmenu nevykonáva.
10. Po human-operated runtime zmene sa služby reštartujú v poradí
    `payload-env` a až potom `payload-web`.
11. SMTP operator vykoná reálny Postmark acceptance check hostu, credentials
    a verified sendera `MAKY.STORE <info@maky.store>` pred zapnutím trafficu.
12. Exact SSM parameter paths sú operator-owned deployment detail a v tomto
    source nie sú definované ani vymyslené.
13. Povinný runtime config existuje pred štartom produkčného candidate;
    produkčný config pri chýbajúcom Forms vstupe failne pri štarte.
14. Forms traffic ostane vypnutý, kým migrácia, candidate health check a
    samostatne schválený e-mailový acceptance check neprejdú.
15. Release handoff zaznamená migration name, proposed release SHA, rollback
    SHA, sender/domain verification a schválené recovery kroky.

Aktuálna implementácia podporuje iba jeden aktívny HMAC secret, nie overlap
starého a nového. Rotácia preto musí byť koordinovaná medzi Payload a
storefront runtime; nekontrolovaná rolling rotácia spôsobí dočasné
`INVALID_SIGNATURE`.

## Rollback a recovery

### Pred prijatím prvého produkčného podania

- vypnúť forms traffic na storefronte,
- vrátiť aplikáciu na schválený rollback SHA,
- DOWN migráciu zvažovať iba po kontrole backupu a presného SQL,
- secret nemažte, kým žiadny candidate proces nemôže znovu štartovať.

### Po prijatí čo i len jedného podania

DOWN migrácia môže odstrániť právne významné/PII záznamy, preto:

- neaplikovať destructive DOWN,
- zachovať nové tables a všetky submission records,
- odpojiť nový traffic alebo rollbacknúť iba application release,
- preferovať forward fix,
- pred akoukoľvek data operáciou spraviť audit/export podľa schváleného
  retention procesu.

Extra nepoužívané tables sú pri application rollbacku bezpečnejšie než strata
prijatého podania.

### Persist succeeded, mail failed

Submission zostáva prijatý; storefront zachová success/proof s pôvodným
`submissionNumber` a `submittedAt`. Nevytvárať druhý record a neopakovať create
POST: duplicate e-mail neposiela a signed PATCH sám nič neodosiela.

V1 má server-only signed operational retry endpoint; nie je to browser ani
bežný storefront success-flow endpoint. Autorizovaný operator:

1. načíta aktuálny delivery status a attempt count,
2. pre `pending`/count `0` môže obnoviť pokus po páde medzi create commitom a
   initial reservation; iný `pending` stav nereplayuje,
3. pre `failed` pošle signed retry presne jedného kanála s
   `expectedAttemptCount`,
4. pre `unknown` najprv overí provider log a signed PATCH reconciliation nastaví
   `accepted` alebo `notAccepted`,
5. retryuje iba pending/count `0`, reconciled `notAccepted` alebo definitive
   `failed`; `sent` ani
   nereconciled `unknown` nikdy neposiela znovu.

Operator môže `lastAttemptId` vidieť v read-only admin audite, ale nikdy ho
nekopíruje do retry ani reconciliation requestu. Token generuje, kontroluje a
porovnáva výhradne Payload.

SMTP timeout alebo zlyhanie delivery-state update nemusí dokazovať, či provider
správu prijal. Pred resend treba podľa schváleného procesu
reconciliovať provider delivery log/message ID; absolútne exactly-once e-mail
doručenie nie je garantované. Recovery log nesmie obsahovať notice body ani PII.

### Podozrenie na kompromitovaný HMAC secret

- zachovať Cloudflare/origin isolation,
- zastaviť forms traffic,
- koordinovane vymeniť secret v oboch server runtimoch,
- neuvádzať secret v incident logu,
- skontrolovať submission IDs, timestamps a konflikty bez exportu plného PII
  do bežných aplikačných logov.

## Mimo rozsahu

- ďalšie autorstvo, právne zmeny alebo preklady seller/return copy,
- Saleor ownership lookup,
- storefront UI, rate limiting, honeypot a success page,
- automatický contact e-mail,
- verejný retry UI alebo automatický retry scheduler/worker,
- CAPTCHA/third-party anti-abuse,
- retention/delete automatizácia,
- produkčná migrácia, SSM zmena, release alebo deploy.
