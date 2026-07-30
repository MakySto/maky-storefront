# Pages REST contract V2

## Kanonický published request

```text
GET {PAYLOAD_CMS_URL}/api/pages
  ?where[slug][equals]={payloadSlug}
  &where[_status][equals]=published
  &locale={payloadLocale}
  &fallback-locale=none
  &depth=1
  &limit=1
```

Server-only headers:

```text
Accept: application/json
CF-Access-Client-Id: <runtime secret>
CF-Access-Client-Secret: <runtime secret>
```

Storefront neposiela Payload `Authorization`. Cloudflare Access service token
otvára sieťovú hranicu; Payload `publishedOrAuthenticated` access naďalej
obmedzuje anonymné čítanie na published dokumenty. Request musí mať
`redirect: "manual"`, pretože odmietnutý CF Access request môže vrátiť `302`
s HTML namiesto JSON.

Market sa zámerne neposiela ako Payload `where` filter. Consumer po prijatí
kandidáta vyhodnotí najprv `page.markets` a následne každý
`page.layout[].markets`, aby mal rovnakú semantiku pre `null`, `[]` a allowlist.

## Collection envelope

Úspešná list odpoveď:

```json
{
  "docs": [],
  "hasNextPage": false,
  "hasPrevPage": false,
  "limit": 1,
  "nextPage": null,
  "page": 1,
  "pagingCounter": 0,
  "prevPage": null,
  "totalDocs": 0,
  "totalPages": 0
}
```

`docs[0]`, ak existuje, obsahuje:

- `id`,
- lokalizované `title`, `summary` a `slug`,
- non-localized `layout` pole, ktorého konkrétne obsahové fields sú podľa
  block schémy lokalizované,
- page-level `markets`,
- SEO `meta.title`, `meta.description`, `meta.image`,
- `updatedAt`, `createdAt`,
- `_status: "published"`.

JSON object key order nie je súčasťou kontraktu. Nullable/optional polia môžu
byť `null` alebo chýbať podľa Payload serializácie a obsahu. Runtime validátor
musí rozlišovať túto prípustnú optionalitu od chýbajúceho povinného obsahu.

### Aditívna hranica Forms V1 releasu

Manifest a checksum fixtures zostávajú presným záznamom provider commitu
`91dc302982a103e1cfa6b0d456f5293ec905d275`, zachyteného ešte pred schémovou
fázou Forms V1. Táto následná schéma pridáva na Page iba non-localized,
non-content-bearing top-level skupinu:

```text
legalMetadata: {
  documentType: "editorial" | "legal"
  legalVersion?: string | null
  effectiveFrom?: ISO-8601 string | null
}
```

V2 consumer ju musí akceptovať ako voliteľnú skupinu; pre editorial rendering
ju smie ignorovať. Jej prítomnosť nie je unsupported obsahový blok ani Lexical
node a sama nesmie spustiť fail-closed odmietnutie kandidáta. Sedem block
shapes, Lexical allowlist, market filtering a `depth=1` kontrakt sa tým nemenia.
Ostatné neznáme obsahové polia nedostávajú touto výnimkou automatickú podporu.

## Link wire shape

Custom link:

```json
{
  "type": "custom",
  "newTab": false,
  "reference": null,
  "url": "https://example.com/vehicle-fit-guide",
  "label": "Externý sprievodca",
  "appearance": "primary",
  "id": "a00000000000000000000001"
}
```

Polymorphic Page/Post relationship:

```json
{
  "type": "reference",
  "newTab": false,
  "reference": {
    "relationTo": "pages",
    "value": {
      "id": "018f0000-0000-7000-8000-000000000001",
      "title": "Kontakt",
      "slug": "kontakt"
    }
  },
  "url": null,
  "label": "Kontakt",
  "appearance": "secondary",
  "id": "a00000000000000000000002"
}
```

Pri skutočnom `depth=1` obsahuje `value` populovaný Page alebo Post dokument,
nie iba tri ukážkové polia. Kompletné tvary sú vo fixtures. Ak je cieľ
odstránený alebo neprístupný, `reference` môže byť `null`; consumer link
nesmie vytvoriť z neovereného ID.

## Media wire shape

Priamy upload relationship pri `depth=1` je objekt `public-media`. Musí
obsahovať aspoň bezpečne validovateľné `id`, `alt` a verejné URL/filename
metadata. Fixture `page-image.sk.published.depth-1.json` zachytáva úplný
očakávaný objekt vrátane:

```text
thumbnail
card
content
hero
og
```

Každý size má vlastné `url`, rozmery, MIME type, filesize a filename.
Consumer nesmie skladať CDN URL z neverifikovaných secrets alebo interného
bucket názvu.

## Výsledkové vetvy

| Výsledok                                  | Semantika                                      |
| ----------------------------------------- | ---------------------------------------------- |
| `200` + jeden validný published dokument  | validovať celý candidate a až potom renderovať |
| `200` + `docs: []`                        | autoritatívne not-found/unpublished            |
| page market mismatch                      | candidate nepoužiť pre daný market             |
| nepodporovaný obsahový block/Lexical node | odmietnuť celý candidate                       |
| timeout, DNS/network error                | upstream failure                               |
| HTTP `3xx`, `401`, `403`, `5xx`           | upstream/auth failure                          |
| invalid JSON/runtime shape                | contract violation                             |
| `_status !== "published"`                 | contract violation                             |

Not-found, market mismatch, upstream failure a contract violation sú rozdielne
vetvy observability. Konkrétnu storefront fallback politiku určuje consumer,
ale nesmie z nepodporovaného dokumentu vykresliť iba významovo neúplný zvyšok.

## Locale a market

Payload locale a Saleor market nie sú tá istá hodnota. V2 nemení existujúce
locale mapovanie storefrontu. Povolené market hodnoty schémy:

```text
SK CZ PL HU RO AT DE IT FR ES US CA
```

`page.markets: null | []` znamená všetky trhy. To isté platí samostatne pre
každý blok. Page mismatch zastaví celý candidate; block mismatch odstráni iba
daný podporovaný blok ešte pred renderovaním.
