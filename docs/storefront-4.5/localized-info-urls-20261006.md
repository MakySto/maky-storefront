# Lokalizované URL informačných stránok

## Stav a príčina

Oprava pripravená 6. 10. 2026 na vetve `codex/localized-info-urls-20261006`, zo základu
`release/r1-thule-20261001 @ 8b96c295bc29c10a8b4cf71f825db7cc883adc60`.
Toto je overený kandidát na zlúčenie a nasadenie, nie hlásenie zmeny produkcie.

Pri priamom čítaní živého webu mali americký aj nemecký sitemap informačné URL so
slovenskými cestami. `/us/kontakt`, `/us/doprava-a-platba` a
`/de/doprava-a-platba` vracali 200 a lokalizovaný obsah, ale canonical, hreflang aj
interné odkazy opakovali slovenské cesty. Texty boli preložené; chýbala lokalizácia URL.

`marketHref` pred opravou lokalizoval iba košík. Sitemap a hreflang skladali URL
priamo z trhu a interného názvu cesty. Úprava samotného XML by preto nestačila.

## Verejné adresy

Zdrojom názvov je `src/config/info-routes.ts`: osem stránok v každom z dvanástich
trhov SK, CZ, DE, AT, PL, HU, IT, FR, ES, RO, US a CA. Existujúce súbory stránok,
právne texty a interné identifikátory pravidiel dostupnosti ostávajú zachované.

| Interná cesta                            | US a CA, za prefixom trhu         | DE, za prefixom trhu                |
| ---------------------------------------- | --------------------------------- | ----------------------------------- |
| `/cookies`                               | `/cookies`                        | `/cookies`                          |
| `/doprava-a-platba`                      | `/shipping-and-payment`           | `/versand-und-zahlung`              |
| `/kontakt`                               | `/contact`                        | `/kontakt`                          |
| `/obchodne-podmienky`                    | `/terms-and-conditions`           | `/agb`                              |
| `/ochrana-osobnych-udajov`               | `/privacy-policy`                 | `/datenschutz`                      |
| `/odstupenie-od-zmluvy`                  | `/cancellations-and-returns`      | `/widerruf`                         |
| `/odstupenie-od-zmluvy/vzorovy-formular` | `/cancellations-and-returns/form` | `/widerruf/musterformular`          |
| `/reklamacie-a-vratenie`                 | `/returns-and-complaints`         | `/reklamationen-und-ruecksendungen` |

Rovnaká mapa sa používa v sitemap, canonical, hreflang, Open Graph, interných
odkazoch a JSON-LD odkaze na pravidlá vrátenia. Prepínač trhu rozpozná stránku podľa
zdrojového trhu a zachová query aj fragment. Niektoré slová sú správne rovnaké vo
viacerých jazykoch, napríklad nemecké `kontakt` alebo anglické `cookies`.

Staré slovenské adresy dostanú HTTP 308 priamo v proxy pred vykreslením stránky.
Nové adresy sa interne prepíšu na pôvodné súbory stránok. Presmerovanie zachová
query; vnorený vzorový formulár má preloženú celú cestu. Presné rozpoznávanie
informačných ciest neprekladá podobne pomenované produkty ani ľubovoľné podstránky.
Preview/noindex a kontrola dostupnosti na trhu naďalej platia.

## Overenie

- Cielená sada: **17 súborov, 677 úspešných testov**. Zahŕňa všetkých 96 kombinácií
  stránky a trhu, staré presmerovania, transportné prípony Next.js, chybné potomky,
  nedostupné trhy, výnimkový fallback, sitemap XML, canonical/hreflang, JSON-LD,
  prepínač trhu, footer a vykreslenie skutočnej anglickej stránky dopravy.
- `corepack pnpm exec tsc --noEmit`: bez chýb. GraphQL typy boli lokálne vygenerované
  z verejnej introspekcie aktuálneho Saleoru; generované súbory nie sú súčasťou zmeny.
- ESLint dotknutých súborov: bez chýb; existujúce upozornenie na obrázok vlajky v
  `header-market-controls.tsx` zostáva. Formátovanie a `git diff --check` sú čisté.
- Skutočný `next dev --hostname localhost --port 3106`, všetkých 12 trhov zapnutých:
  `/us/kontakt?source=check` → 308 `/us/contact?source=check` a
  `/us/doprava-a-platba` → 308 `/us/shipping-and-payment`.
- HTTP 200 bez presmerovania: `/us/shipping-and-payment`,
  `/de/versand-und-zahlung`, `/de/kontakt`, `/sk/doprava-a-platba` a
  `/us/cancellations-and-returns/form`. V HTML je správny jazyk, self-canonical
  a lokalizované hreflang vrátane vnoreného formulára. V anglickej a nemeckej
  doprave nie sú interné odkazy na staré slovenské adresy.
- Skutočný `/sitemaps/us-pages-1.xml`: HTTP 200, 12 URL, všetkých osem informačných
  adries zodpovedá novej mape. Nemecké XML a ostatné trhy navyše pokrývajú testy.

Lokálny server pri prvom spustení s `127.0.0.1` vytváral falošnú 301 slučku:
NextURL normalizuje loopback na `localhost`, zatiaľ čo router použil pôvodný origin.
Zhodný hostname ju odstránil bez zmeny aplikácie. V lokálnom behu sa tiež objavili
časové limity čítania kategórií a existujúce upozornenie na prerenderovanie layoutu;
uvedené stránky aj sitemap napriek tomu vrátili kompletnú úspešnú odpoveď.
Plný produkčný build ani produkčný deploy táto kontrola nevykonala.

## Dokončenie na storefront serveri

Zlúčiť do `release/r1-thule-20261001`; aktuálny release skladá relácia na VPS podľa
skutočne nasadeného stavu vrátane SYNC-1. Použiť existujúci postup v `CLAUDE.md` §13
a `scripts/ops/deploy-production.sh`, najprv dry-run. Tento kandidát nevyžaduje nové
premenné, závislosti, preklady obsahu ani zápis do CFM/Saleoru.

Po nasadení overiť na `https://maky.store` tie isté staré/nové dvojice, HTTP stav,
canonical, hreflang, odkazy vo footeri a oba sitemap súbory
`/sitemaps/us-pages-1.xml` a `/sitemaps/de-pages-1.xml`. V sitemap majú byť iba nové
kanonické adresy; staré adresy majú zostať dostupné cez permanentné presmerovanie.
Skontrolovať aj prepnutie z US dopravy na DE a z formulára AT na DE.

Zmenu GSC indexu nemožno očakávať okamžite: Google musí nové stránky a presmerovania
znova prejsť. Podklady: [permanentné presmerovania](https://developers.google.com/search/docs/crawling-indexing/301-redirects)
a [jazyk URL](https://developers.google.com/search/docs/crawling-indexing/url-structure).
