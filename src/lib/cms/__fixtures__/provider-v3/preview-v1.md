# Náhľad konceptu v1

Cieľ: redaktor v admine klikne **Náhľad**, zvolí trh (tým aj jazyk) a počítač/mobil a v novej karte uvidí **skutočnú stránku storefrontu** s presne uloženou verziou konceptu. Verejný web, cache ani vyhľadávače koncept nikdy nevidia.

V2 platí iba pre `pages` — jediný typ, ktorý storefront dnes verejne zobrazuje. Články a značky dostanú náhľad s vlastnými routami v neskorších vláknach.

## Tok

1. Admin otvorí `GET https://cms.maky.store/api/pages/<id>/preview?market=CZ` (prihlásený redaktor alebo správca; predtým uloží koncept).
2. CMS vydá token pre **poslednú uloženú verziu** a odpovie stránkou, ktorá formulár **automaticky odošle metódou POST** na `https://maky.store/api/cms/preview` (pole `token`). Ukážka: `fixtures/preview/launch.form.html`. Token tak nie je v žiadnej URL, access logu, analytike ani v `Referer`.
3. Storefront `POST /api/cms/preview`:
   - zavolá server-to-server `POST https://cms.maky.store/api/pages/preview-resolve` s telom `{ "token": "…" }`, hlavičkami Cloudflare Access service tokenu a `Authorization: service-accounts API-Key <PAYLOAD_PREVIEW_API_KEY>`,
   - pri úspechu zapne Next.js `draftMode()`, uloží token do cookie `maky-cms-preview` (`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age` = zvyšok platnosti tokenu) a presmeruje `303` na stránku daného trhu (napr. `/cz/o-nas`),
   - pri chybe ukáže jednoduchú stránku „Náhľad nie je platný alebo vypršal“ (`noindex`, `no-store`) bez presmerovania.
4. Stránka v náhľade: ak je zapnutý `draftMode` a existuje cookie, storefront obsah **nenačíta z publikovaného REST**, ale znova cez `preview-resolve` s tokenom z cookie (`cache: 'no-store'`), spracuje ho tým istým parserom ako publikovaný obsah (povolí `_status: "draft"`) a zobrazí pás „Náhľad konceptu — nie je verejný“ s odkazom **Ukončiť náhľad**.
5. `GET /api/cms/preview/exit` vypne `draftMode`, zmaže cookie a presmeruje na tú istú stránku bez náhľadu.

## Token

- Formát `base64url(claims).base64url(HMAC-SHA256)`, pre storefront **nepriehľadný** — nič z neho nečíta ani neoveruje.
- Nároky (overuje CMS): typ, kolekcia `pages`, ID dokumentu, **ID verzie**, trh, jazyk trhu (DE/AT → `de`, US/CA → `en`), vydanie, expirácia.
- Platnosť najviac **30 minút**; potom resolve vráti `401 PREVIEW_TOKEN_EXPIRED` a náhľad končí.
- Kľúč je odvodený z `PAYLOAD_SECRET` s vlastným účelom; podvrhnutý cieľ (iný dokument, verzia, trh) alebo podpis → `401 PREVIEW_TOKEN_INVALID`.

## `POST /api/pages/preview-resolve`

- Iba identita `preview-reader` (kolekcia `service-accounts`, aktívna). Bez identity `401`, iná identita (aj prihlásený redaktor, `worker`) `403`.
- Odpoveď `200` má tvar publikovanej REST odpovede stránky (`docs[0]`, `depth=1`, jazyk tokenu, bez fallbacku jazyka) plus `preview`: `fixtures/preview/resolve.response.json`.
  - `docs[0]` je **presne verzia z tokenu**, aj keď medzitým vznikol novší koncept.
  - `docs[0]._status` môže byť `"draft"`; storefront to v náhľade povolí, inak nie.
  - Hlavičky `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`.
- Chyby: `fixtures/preview/resolve.errors.json` — dokument v koši alebo zmazaný `404 PREVIEW_DOCUMENT_UNAVAILABLE`, verzia iného dokumentu `404 PREVIEW_VERSION_UNAVAILABLE`.

## Budúce trhy

- Náhľad musí fungovať pre všetkých 12 dvojíc trh/jazyk **bez zapnutia verejného predaja**: proxy a route policy storefrontu pustia CMS routu (`o-nas`, `poradna` …) pre nespustený trh alebo trh mimo route policy **iba** vtedy, keď je zapnutý `draftMode` a existuje cookie náhľadu. Obsah sa aj tak zobrazí iba s platným tokenom (overuje ho CMS pri každom načítaní).
- Bez náhľadu sa správanie nemení (napr. `/cz/o-nas` ostáva 404, kým CZ nie je spustený a routa povolená).

## Súkromie a cache

- Stránka v náhľade: `Cache-Control: private, no-store, max-age=0`, `X-Robots-Tag: noindex, nofollow`, `<meta name="robots" content="noindex,nofollow">`, bez zápisu do Data Cache a bez ISR.
- Náhľad sa nesmie dostať do verejnej cache: čítanie cez `preview-resolve` nikdy nepoužíva `next.tags`/`revalidate` ani `'use cache'`.
- Token sa nesmie logovať ani posielať analytike; v cookie je iba po dobu platnosti. Analytika (GA4, Ads) sa v náhľade nenačítava.
- Cloudflare Access chráni `cms.maky.store`; storefront volá resolve iba zo servera.
