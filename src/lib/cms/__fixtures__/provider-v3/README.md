# Kontrakt CMS ↔ storefront v3 (vlákno 2)

Jedno verzované rozhranie medzi Payload CMS (`maky-cms`) a storefrontom (`maky-storefront`) pre tri veci, ktoré prináša vlákno 2. Nahrádza iba to, čo tu výslovne mení; ostatné pravidlá `storefront-cms-pages-v2` (REST tvar stránky, `depth=1`, markets, médiá) platia ďalej.

| Časť | Súbor | Verzia | Stav |
| --- | --- | --- | --- |
| Udalosť pre obnovu webu (revalidácia) a odpoveď s cieľmi overenia | [revalidation-event-v2.md](./revalidation-event-v2.md) | event `schemaVersion: 2` | candidate |
| Náhľad konceptu (podpísaný token, resolve, cookie) | [preview-v1.md](./preview-v1.md) | preview `v1` | candidate |
| Obsah stránok: tolerantné čítanie blokov, focal point, značka revízie | [pages-content.md](./pages-content.md) | pages `v3` | candidate |

Ukážky sú v `fixtures/`, digesty v [manifest.json](./manifest.json). Udalosti vo `fixtures/events/` vygeneroval skutočný `buildStorefrontEvent` z `src/storefront/events.ts`, nie ručný prepis.

## Vlastníctvo

- CMS hovorí, **čo** sa zmenilo: vlastník, stabilné ID, revízia, typ zmeny, dotknuté trhy a jazyky, staré a nové identity rout, závislé dokumenty. CMS **nepozná** URL ani cache tagy storefrontu.
- Storefront z toho odvodí svoje routy a tagy a v odpovedi povie, ktoré verejné adresy má CMS overiť a ktoré trhy ešte nie sú spustené.
- Náhľad: token vydáva aj overuje iba CMS (kľúč nikdy neopustí CMS). Storefront ho iba prenesie do `POST /api/pages/preview-resolve` so svojou strojovou identitou `preview-reader`.

## Kompatibilita a poradie nasadenia

- Udalosť v2 je **nadmnožina** udalosti v1: polia `source`, `entityType`, `entitySlug`, `entityId`, `event`, `locale`, `slug`, `previousSlug` majú rovnaký význam. Dnešný storefront (v1) ju prijme a zneplatní rovnaké tagy ako doteraz; nové polia ignoruje.
  - `event` zostáva hrubé v1 meno (`publish | update | unpublish | delete`); presný typ je v `change`.
  - Zmena obrázka ide ako `entitySlug: "public-media"`. Storefront v1 ju prijme, ale nezneplatní závislé stránky; tie sa obnovia až po uplynutí cache (15 min – 1 h). Storefront v2 použije `dependents`.
- Odpoveď bez `targets` (storefront v1) CMS zaznamená ako „Web prijal zmenu (bez overenia)“.
- Preto môže ísť CMS do produkcie pred storefrontom aj po ňom. Plná funkcia (overenie, médiá, náhľad) je až s oboma.

## Bezpečnosť v skratke

- Revalidácia: `POST /api/revalidate/payload`, `Authorization: Bearer <PAYLOAD_REVALIDATE_SECRET>` — bez zmeny.
- Resolve náhľadu: Cloudflare Access service token (ako pri čítaní obsahu) **a** `Authorization: service-accounts API-Key <kľúč preview-reader>`. Kľúč vydá správca v CMS (Nastavenia → Strojové identity); do storefrontu ide ako nová env premenná storefrontu `PAYLOAD_PREVIEW_API_KEY`. Na strane CMS netreba nový SSM parameter.
- Preview odpovede: `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`; token nikdy v URL, analytike ani logoch.
