# Udalosť pre obnovu webu v2

## Doručenie

- CMS zapíše udalosť do outboxu (`web-updates` + Payload job) **v tej istej databázovej transakcii** ako zmenu obsahu. Pri rollbacku udalosť nevznikne; po commite sa nestratí ani pri výpadku storefrontu.
- Runner v procese `payload-web` ju doručí najneskôr pár sekúnd po commite: `POST {STOREFRONT_REVALIDATE_URL}` (dnes `https://maky.store/api/revalidate/payload`), `Content-Type: application/json`, `Authorization: Bearer <secret>`.
- Opakovanie: každý ne-2xx stav, timeout (10 s) alebo sieťová chyba = nový pokus s exponenciálnym odstupom 15 s, 30 s, 1 min … (8 pokusov, spolu asi 1 h). Potom stav „Chyba“ a ručné „Zopakovať“ v admine.
- Duplicita a poradie: rovnaká udalosť (`eventId`) môže prísť viackrát a staršia udalosť môže prísť po novšej. Storefront preto udalosť používa **iba na zneplatnenie cache**, nikdy ako dáta. Po zneplatnení si vždy načíta aktuálny publikovaný stav z CMS — staršia udalosť tak nevráti odstránený obsah ani neprepíše novšie vydanie.

## Telo

| Pole | Typ | Význam |
| --- | --- | --- |
| `source` | `"maky-cms"` | v1 |
| `schemaVersion` | `2` | verzia tohto tela |
| `eventId` | UUID | stabilné ID udalosti (deduplikácia, overenie) |
| `entityType` | `"collection" \| "global"` | v1 |
| `entitySlug` | string | vlastník: `pages`, `posts`, `brands`, `authors`, `article-categories`, `public-media` alebo slug globálu (v1) |
| `entityId` | string \| chýba | stabilné ID dokumentu (pri globáli chýba) (v1) |
| `event` | `publish \| update \| unpublish \| delete` | hrubý v1 typ |
| `change` | `publish \| update \| unpublish \| trash \| restore \| delete \| media-update \| media-delete` | presný typ zmeny |
| `revision` | ISO dátum \| `null` | `updatedAt` publikovaného dokumentu po zmene; `null`, keď obsah z webu zmizol |
| `occurredAt` | ISO dátum | čas zápisu udalosti |
| `locale` | `null` | v1 pole, vždy `null`; dotknuté jazyky sú v `locales` |
| `locales` | jazyky | zjednotenie jazykov trhov pred a po zmene (`sk cs pl hu ro de it fr es en`) |
| `markets` | trhy | zjednotenie trhov pred a po zmene; `[]` na dokumente = všetkých 12 |
| `slug` | string \| `null` | v1: nový slug, alebo slug, ktorý z webu zmizol |
| `previousSlug` | string \| `null` | v1: starý slug pri premenovaní |
| `routes.previous` / `routes.current` | `{ slug, markets, locales }` \| `null` | stará a nová identita routy; `null` = dokument pred/po zmene nebol verejný |
| `dependents` | `[{ entitySlug, entityId, slug }]` | pri `media-*`: publikované dokumenty, ktoré obrázok používajú |

Neznáme ďalšie polia storefront ignoruje. Slug je jeden pre všetky jazyky (R6); jazyk a trh určuje routu storefrontu.

Ukážky: `fixtures/events/page-publish.json`, `page-update-slug-and-markets.json`, `page-all-markets-update.json`, `page-unpublish.json`, `page-trash.json`, `page-restore.json`, `page-delete.json`, `media-update.json`, `brand-publish.json`, `global-update.json`.

## Čo má storefront spraviť

1. Overiť `Authorization` (bez zmeny), prijať v1 aj v2 telo.
2. Zneplatniť tagy:
   - `cms:collection:<entitySlug>`,
   - pri `pages`: `cms:page:<slug>` pre `routes.previous.slug`, `routes.current.slug` (a v1 `slug`/`previousSlug`),
   - pri `media-*`: tagy každého dokumentu z `dependents` (napr. `cms:page:poradna`, `cms:collection:brands`),
   - pri globáli: `cms:global:<entitySlug>`.
3. Odpovedať `200` s telom v2 (nižšie). `400` iba pri neplatnom tele; neznáme `change` s platným v1 `event` nie je chyba.

## Odpoveď v2

```json
{
  "success": true,
  "schemaVersion": 2,
  "eventId": "…",
  "revalidated": ["cms:collection:pages", "cms:page:o-nas"],
  "targets": [
    { "market": "SK", "locale": "sk", "live": true, "expect": "present", "url": "https://maky.store/sk/o-nas" },
    { "market": "CZ", "locale": "cs", "live": false, "expect": "present", "url": null, "reason": "market-not-live" }
  ]
}
```

- Jeden cieľ na každý trh z `markets`, pre ktorý má dokument routu.
- `live: false` + `reason` (`market-not-live`, `route-not-available`) = CMS ukáže „Publikované v CMS — trh nie je spustený“ a **neoveruje ani neopakuje**. Storefront kvôli tomu nezapína trh.
- `expect: "absent"` pri zmiznutí (`revision: null`).
- `url` musí byť na pôvodnom origine storefrontu a `https`; CMS nič iné nenačíta.
- Bez `targets` (v1) = „doručené bez overenia“. Pri médiách `targets: []` (overuje sa iba doručenie).

Ukážky: `fixtures/responses/*.json`.

## Overenie verejnou stránkou

- CMS pre každý živý cieľ načíta verejnú URL (`GET`, `User-Agent: maky-cms-verifier/1`) a hľadá značku revízie z [pages-content.md](./pages-content.md): `<meta name="maky-cms-revision" content="pages:<id>@<updatedAt>">`.
- `present`: stránka ukazuje túto alebo novšiu revíziu. `absent`: 404/410 alebo stránka bez značky tohto dokumentu.
- Stale-while-revalidate: prvé načítanie po zneplatnení môže byť staré. CMS skúša 3× s odstupom 3 s a potom celý pokus zopakuje s odstupom. HTTP 200 z revalidácie samo nestačí.
- 401/403/429 z verejnej stránky (WAF, limit) = „Web prijal zmenu (overenie nebolo možné)“, nie chyba obsahu.
- Stavy v admine: Čaká na obnovu webu → Overené na webe / Publikované v CMS — trh nie je spustený / Web prijal zmenu (bez overenia) / Chyba obnovy webu. Staršiu udalosť dokumentu, ku ktorému už existuje novšia, CMS len doručí a označí „Nahradené novšou zmenou“.
