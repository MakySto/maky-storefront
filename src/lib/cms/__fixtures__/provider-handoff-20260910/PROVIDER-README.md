# P → M handoff: O nás pre 12 trhov

Dátum snapshotu: 2026-09-10

Tento adresár je provider handoff pre storefront acceptance. Neobsahuje staging
URL, prihlasovacie údaje ani dôkaz produkčného publikovania. Schválený provider
base je commit 8eb9400ccd2e959cb78a75884968e7d8e47e0df1. Commit, ktorý tento
handoff nesie, sa doplní mimo manifestu po vytvorení commitu; pole providerHead
je preto zámerne null.

## Brány

| Brána                          | Stav        | Dôkaz alebo blokér                                                                                                  |
| ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| CONTENT_READY                  | YES         | Byte-exact schválený zdroj, 12 marketov, 10 Payload locales, validované H1/SEO/telo/odkazy.                         |
| IMPORT_READY                   | YES         | Guarded importer zachováva existujúce page ID a slug, nevytvára stránku a podporuje idempotentný publish lifecycle. |
| CMS_EPHEMERAL_HTTP_VERIFIED    | YES         | Run 34533368337 prešiel cez fresh DB, anonymný HTTP lifecycle, 34 revalidácií a owned-only cleanup.                 |
| CMS_STAGING_PUBLISHED          | BLOCKED_ENV | V dostupnom prostredí nebol nájdený izolovaný, M dostupný staging provider ani staging URL.                         |
| CMS_PROVIDER_STAGING_VERIFIED  | NOT_RUN     | Skutočný anonymný HTTP read cez GET /api/pages nebol proti stagingu vykonaný.                                       |
| STOREFRONT_STAGING_VERIFIED    | NOT_RUN     | Storefront nebol pripojený k reálnemu staging provideru.                                                            |
| CMS_PUBLISHED_PRODUCTION       | NO          | Chýba explicitné produkčné GO; produkcia nebola týmto handoffom zmenená.                                            |
| STOREFRONT_VERIFIED_PRODUCTION | NO          | Produkčný storefront acceptance nebol vykonaný.                                                                     |

Stavy sú aj v machine-readable súbore manifest.json. BLOCKED_ENV nie je
ekvivalent publikovaného stagingu a NOT_RUN nie je úspešný test.

## Čo je a nie je dôkaz

- content/o-nas/2026-09-10/data/o-nas.markets.json je schválený statický
  obsahový zdroj.
- Unit a integračné testy importéra cez Payload Local API a izolovaný PostgreSQL
  dokazujú parser, plánovanie, zápis a read-back na tejto hranici.
- Workflow .github/workflows/about-provider-http-acceptance.yml je spustiteľný
  disposable loopback HTTP harness. Jeho fresh PostgreSQL, vlastný Payload server
  a revalidation sink nie sú zdieľaný provider staging ani storefront E2E.
- Súbory vo fixtures/negative sú ručne zostavené syntetické REST envelopes na
  reprodukciu negatívneho consumer prípadu. Nie sú capture zo staging HTTP,
  nie sú mock provider E2E a nesmú byť tak reportované.
- Disposable loopback harness prešiel v GitHub Actions rune
  [34533368337](https://github.com/MakySto/maky-cms/actions/runs/34533368337)
  na provider SHA 7937da418fe59c287a0201d6e665173380ac453c. Artefakt
  `about-provider-http-34533368337-1` má ID 10174547032 a veľkosť 1 360 715 bytes.
- Skutočný provider acceptance vyžaduje HTTP request cez rovnakú sieťovú cestu
  ako storefront. Zatiaľ nebol vykonaný.
- Produkčný publish, deploy ani ostrý formulár nie sú súčasťou tohto handoffu.

## Identita dokumentu

- collection: pages
- page ID: 019fb008-504b-779e-ad3f-1ff353267c88
- slug: o-nas
- approved content SHA-256:
  fccf530019d10f264395cbeefddfd7a91e992550c65a890bdaf48b642e16305a
- legacy SK block ID: 6a6a80ddb64969525d329160
- layout: jeden spoločný 12-riadkový layout; lokalizuje sa iba obsah blokov
- mapping: DE/AT zdieľajú de, US/CA zdieľajú en; ostatné trhy majú vlastný locale

Manifest uvádza pre každý market Payload locale, jazykový tag, channel, route,
H1, navigation label, SEO, body checksum, stabilné block ID a presne dva
schválené odkazy.

## Kanonický published HTTP read

Storefront má volať server-side:

    GET PAYLOAD_CMS_URL/api/pages
      ?where[slug][equals]=o-nas
      &where[_status][equals]=published
      &locale=PAYLOAD_LOCALE
      &fallback-locale=none
      &depth=1
      &limit=1

Hlavičky, ak staging chráni Cloudflare Access:

    Accept: application/json
    CF-Access-Client-Id: hodnota CF_ACCESS_CLIENT_ID
    CF-Access-Client-Secret: hodnota CF_ACCESS_CLIENT_SECRET

Cloudflare Access údaje sú iba transportné credentials. Storefront pri
published read neposiela Payload Authorization. Redirect sa nesmie automaticky
nasledovať; 3xx alebo HTML odpoveď je upstream/auth chyba, nie not-found.

Staging URL je v manifeste null. Hodnoty secrets sa do balíka nesmú doplniť.

## Content-readiness a cache hranica

Page-level markets musí dovoliť požadovaný market. Následne sa layout filtruje
podľa layout[].markets. Published kandidát je content-ready iba vtedy, ak po
market filtri ostane podporovaný richText blok pre daný market s neprázdnym
Lexical telom.

Published dokument s validným H1 a SEO, ale bez regionálneho tela, je výsledok
content-not-ready. Nesmie sa:

- vykresliť ako hotová stránka,
- zaradiť ako platný navigation/SEO/sitemap/hreflang cieľ,
- zameniť za outage,
- doplniť slovenským bootstrapom alebo iným locale fallbackom.

Surový provider response môže byť spoločný pre DE/AT alebo US/CA, lebo dvojice
zdieľajú Payload locale. Cache výsledku po market filtri však musí mať market v
kľúči. Update alebo unpublish musí invalidovať oba trhy zdieľajúce locale.

## Syntetické negatívne fixtures

Každý fixture má page-level allowlist pre všetkých 12 trhov, status published a
validné spoločné locale metadata. Layout obsahuje iba telo druhého trhu zo
zdieľaného locale:

| Fixture                        | Request              | Jediné telo | Očakávanie po filtri                                |
| ------------------------------ | -------------------- | ----------- | --------------------------------------------------- |
| de-only-at-body.synthetic.json | market DE, locale de | AT          | content-not-ready, layout prázdny, bez SK fallbacku |
| at-only-de-body.synthetic.json | market AT, locale de | DE          | content-not-ready, layout prázdny, bez SK fallbacku |
| us-only-ca-body.synthetic.json | market US, locale en | CA          | content-not-ready, layout prázdny, bez SK fallbacku |
| ca-only-us-body.synthetic.json | market CA, locale en | US          | content-not-ready, layout prázdny, bez SK fallbacku |

Fixtures sú zámerne minimálne. Obsahujú schválený verejný úryvok opačného trhu,
ale nereprezentujú schválený kompletný dokument ani skutočný HTTP capture.

## Disposable provider HTTP harness

Workflow .github/workflows/about-provider-http-acceptance.yml vytvorí výhradne
fresh PostgreSQL 18 databázu payload_about_provider_test, nainštaluje jednorazový
ownership sentinel, spustí vlastný Payload na 127.0.0.1:3101 a vlastný revalidation
sink na 127.0.0.1:3102. Nepoužíva existujúci port 3000, produkčnú DB, S3 ani SMTP.

Harness vykoná dva samostatné cykly:

1. publish → update de → unpublish cez de → restore → republish,
2. update en → unpublish cez en → restore → republish.

Každá published fáza číta všetkých 10 Payload locales cez anonymný REST GET a
validuje všetkých 12 market blokov, metadata, body a odkazy. Očakáva presnú
34-udalosťovú revalidation sekvenciu: tri kompletné publish sady a update/unpublish
pre de aj en. Cleanup zmaže iba sentinel-owned fixed-ID fixture a overí absenciu
stránky aj jej owned versions.

Každý HTTP evidence manifest má klasifikáciu disposable-loopback-http alebo
provider-staging-http, environment kind, target origin, provider repository/ref/SHA,
CI run ID/attempt a pre každý locale zoznam obsluhovaných marketov. Tieto dve
klasifikácie sa nesmú zlúčiť do jednej „real HTTP“ kategórie.

Úspešný run 34533368337 overil fresh DB import, presný fixed page ID/slug,
published read všetkých 10 locales a 12 market blokov, update/unpublish/republish
pre oba zdieľané locales `de` a `en`, presne 34 revalidation udalostí a vymazanie
iba sentinel-owned stránky a verzií. SHA-256 kľúčových evidence manifestov sú
uložené v `manifest.json.disposableHttpHarness.ciRun.evidenceChecksums`.

Ani zelený loopback run nedokazuje cold/warm storefront cache, 12 verejných URL,
navigation/footer/sitemap/hreflang, vizuál 360/1280 px ani zdieľaný staging. Tie
zostávajú v nasledujúcej staging acceptance bráne.

## Povinný staging lifecycle po sprístupnení prostredia

P a M majú spoločne zaznamenať oddelené dôkazy pre:

1. publish schváleného importného plánu,
2. anonymný GET /api/pages pre všetkých 12 route pri cold cache,
3. rovnakých 12 route pri warm cache,
4. update CMS fixture a revalidáciu,
5. unpublish a autoritatívny prázdny published read,
6. republish a obnovený read,
7. oba smery DE ↔ AT a US ↔ CA vrátane invalidácie druhého marketu,
8. H1, SEO, telo, dva odkazy, navigation, footer, sitemap, hreflang a 360/1280 px.

Každý skutočný response capture musí obsahovať čas, provider commit, request
market/locale a SHA-256 súboru. Synthetic, Local API, reálny HTTP staging,
storefront E2E a produkcia sa reportujú samostatne.

## Názvy premenných prostredia

Handoff prenáša iba názvy, nikdy hodnoty:

- read path: PAYLOAD_CMS_URL, CF_ACCESS_CLIENT_ID,
  CF_ACCESS_CLIENT_SECRET
- Payload runtime: PAYLOAD_SECRET, PAYLOAD_PUBLIC_SERVER_URL
- izolovaný PostgreSQL: PGHOST, PGCONNECT_HOST, PGPORT, PGUSER, PGPASSWORD,
  PGDATABASE, PGSSLROOTCERT, PGTLS_SERVERNAME, DB_POOL_MAX, PGAPPNAME
- write guard: MAKY_ABOUT_IMPORT_WRITES_ENABLED, MAKY_ABOUT_IMPORT_TARGET,
  MAKY_ABOUT_IMPORT_REQUIRE_PG_TABLE_LOCK, MAKY_ABOUT_IMPORT_GO_ID
- post-commit revalidation: MAKY_ABOUT_IMPORT_POSTCOMMIT_REVALIDATION,
  STOREFRONT_REVALIDATE_URL, STOREFRONT_REVALIDATE_SECRET
- izolovaný SMTP/runtime, ak sa bootuje celá aplikácia: SMTP_HOST, SMTP_PORT,
  SMTP_USER, SMTP_PASS, SMTP_FROM_ADDRESS, SMTP_FROM_NAME
- izolované media/runtime, ak sa bootuje celá aplikácia: S3_REGION,
  S3_BUCKET_PUBLIC, S3_BUCKET_PRIVATE, MEDIA_CDN_URL; pre tento test majú
  prázdne bucket hodnoty storage plugin vypnúť

Pred mutujúcim staging testom musí byť dokázané, že PostgreSQL, storage, SMTP a
revalidation smerujú iba do izolovaných testovacích cieľov. Generic Playwright
suite sa nesmie spustiť proti existujúcemu procesu alebo produkčným službám.

## Rollback a vlastníctvo

P mení iba CMS fixture a vykonáva guarded import po samostatnom GO. M mení iba
storefront consumer. Importér vytvára exkluzívny backup pred zápisom; rollback
sa pripraví z tohto konkrétneho backupu a opäť vyžaduje autorizovaný postup.
Odpublikovanie sa nesmie obísť bootstrapom, ktorý by obnovil starý SK obsah.
