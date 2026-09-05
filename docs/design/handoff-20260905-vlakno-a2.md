# Vlákno A2 — výsledok (2026-09-05)

`origin/claude/sf-a-catalog-l10n-seo` — **pushnuté**, branch-only.
Produkcia nedotknutá: `maky.store/sk` 200, `/opt/storefront` HEAD `e353c70`,
nasadený artefakt stále `bdcc925` / `iyLXwmjRqPX0jdVSumaqz`, obidva PM2 procesy bežia.

```
CODE_READY      = YES  (A2.2, A2.5, A2.6, JSON-LD, lastmod, manifest)
DATA_CONNECTED  = NO   (fitment provider je B; Nordrive strešné nosiče nie sú publikované)
PUBLIC_ENABLED  = NO   (žiadny deploy, žiadna aktivácia trhu)
SEO_READY       = NO   (hreflang + sitemap index nedokončené — viď §4)
```

---

## 1. Čo pribudlo v tomto behu

| commit    | čo                                                                                  |
| --------- | ----------------------------------------------------------------------------------- |
| `8569507` | **A2.2 — typed add-to-cart** (P0, odovzdané B hneď po dokončení)                    |
| `a704dfd` | A2.6 — široká tabuľka už nepanuje celou stránkou                                    |
| `561c2fe` | read-only Nordrive identity + sellability manifest                                  |
| `d03313b` | A2.5 — revalidácia: 12 trhov, preklady, médiá, starý slug, `{expire:0}`             |
| `3fb6b65` | JSON-LD `Product+Offer` / `ProductGroup+hasVariant`; `lastmod` už nie je čas buildu |

Predtým (prvý beh): A0 slug fallback, prev-pagination, merge S1, pravdivé prázdne stavy,
noindex na cart/account/orders, pravdivé počty, media `id`, sitemap kategórie, search
direction, kategóriový filter.

### Validácia

`tsc` 0 · `lint` 0 errors · **1129 testov / 72 súborov** · `i18n:check` OK (12 locales) ·
`next build` zelený v izolovanom worktree (§13.7) · CSS pravidlo `.maky-prose-scroll`
**overené v skompilovanom chunku** (Tailwind pre nepoužité pravidlo neemituje nič).

### Akceptácia proti zbehnutej aplikácii (`next start`)

```
/sk/<nordrive-box>            200  <h1>Strešný box Nordrive 430 Shiny Black</h1>
  JSON-LD                     Product / Offer · 299 EUR · BackOrder · sku N60012
  canonical                   https://maky.store/sk/stresny-box-nordrive-430-shiny-black-n60012
/sk/products                  <title>Všetky produkty | MAKY.STORE</title>
/sk/categories/stresne-nosice „Zatiaľ tu nie sú žiadne produkty."
  …&direction=prev            16 produktov
/sitemap.xml                  444 URL, 414 lastmod  → lastmod nesú IBA produkty
/sk/cart /account /orders     noindex, follow
```

---

## 2. P0, ktoré si menoval — hotové

`addListingItemToCart` vracalo `void` a pozeralo iba na transportné `result.ok`.
`checkoutLinesAdd` odpovedá HTTP 200 s naplneným `errors`, takže **out of stock, not
published, not purchasable a unavailable-in-channel prichádzali ako úspech** — a mutácia
si ani nepýtala `errors.code`, takže nebolo na čom klasifikovať.

`addVariantToCart` je teraz jediná implementácia pod oboma call sites (karta aj PDP)
a vracia **tri** stavy, nie dva:

- `added` — Saleor odpovedal a checkout sa vrátil bez chýb;
- `rejected` + `reason` (`unavailable` / `invalid` / `not-found` / `checkout` / `rejected`);
- `unconfirmed` — **nevieme**.

Tretie rameno je podstata. Transportné zlyhanie po odoslaní nie je zlyhanie: zápis mohol
prejsť. Označiť ho za chybu pozýva retry, a retry je presne to, ako sa z jedného kliku
stanú dva riadky. Nikdy sa preto neopakuje automaticky a nikdy sa nehlási ako úspech.
Košík sa napriek tomu revaliduje, lebo riadok tam môže byť.

`AddToCartResult` / `AddToCartRejection` sú kontrakt pre B. Saleor je v testoch kompletne
mockovaný — zámerne, spustiť to naozaj by zapísalo riadok do živého checkoutu.

---

## 3. Nordrive manifest — čo dáta hovoria dnes

`node scripts/ops/nordrive-manifest.mjs` (read-only, anonymné, žiadne historické čísla):

```
public cohort  20
canary-ready   20/20        (žiadny blocker — variant, SKU, externalReference,
                             kategória, obrázky, cena, purchasable)
kategórie      nosice-lyzi 7 · prislusenstvo-k-stresnym-boxom 5 · stresne-boxy 4 ·
               prislusenstvo-k-nosicom-bicyklov 2 · autodoplnky 1 ·
               prislusenstvo-k-nosicom-lyzi 1
```

Všetkých 20 odpovedá 200 anonymne na produkcii. Príklad presnej identity pre canary:

```
slug              stresny-box-nordrive-430-shiny-black-n60012
productId         UHJvZHVjdDozODU=
variantId         UHJvZHVjdFZhcmlhbnQ6Mzg1
sku               N60012
externalReference cfm:product:CFMP-TAZ-N60012-X-A42F89CA
cena              299 EUR · sale_to_order · 8 obrázkov · od 2026-07-28
```

**Ale ani jeden z tých dvadsiatich nie je strešný nosič.** `stresne-nosice`,
`nordrive-stresne-nosice` a `thule-stresne-nosice` nemajú verejne nič. SK canary teda
môže ísť hneď — ale **Nordrive strešné nosiče sa z toho, čo je live, canary-ovať nedajú.**
Sú to dva rôzne releasy a skript ich drží oddelené.

---

## 4. Čo z A2 NIE JE hotové

| úloha                            | stav           | prečo                                                                          |
| -------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| A2.3 lokalizovaný URL reťazec    | **nezačaté**   | najväčší zvyšný blok; kontrakt pre B ešte nedodaný                             |
| A2.4 sitemap index + shardovanie | **nezačaté**   | viď nižšie — vyžaduje rozhodnutie                                              |
| A2.4 hreflang                    | **nezmenené**  | dnes vracia `[]` (jediný live trh) — správne; chýba identity-based mechanizmus |
| A2.7 integrácia B                | **čaká na B2** | pinned commit ešte nie je                                                      |

**Sitemap index — pozor na pascu.** `generateSitemaps()` v Next 16.2.9 presunie sitemap na
`/sitemap/<id>.xml` a **root `/sitemap.xml` prestane existovať** (404). Na ten root ukazuje
`robots.txt` aj deploy kontrola. Next žiadny `<sitemapindex>` negeneruje. Index sa preto
musí napísať ručne ako route handler — nie zapnúť vlajkou. Sám si to označil ako
nie-blocker pre SK canary, takže som to nezačal robiť narýchlo.

---

## 5. `$RX` na kategóriách — vyriešené, netreba ďalší audit

Reprodukované na tomto builde a spárované so serverovým logom cez digest:

```
$RX("B:b","1118623967")
⨯ Error: Couldn't find all resumable slots by key/index during replaying.
  The tree doesn't match so React will fallback to client rendering.
  digest: '1118623967'
```

**Je to známy limit Next 16 PPR (resumable slots), nie kód tohto obchodu** — a už raz
zaznamenaný pri B.1 dep-alignment ako „16.2.9 to neopravuje".

**Obchodný dopad: žiadny.** Serverové HTML kategórie nesie všetko, čo crawler potrebuje —
`<h1>`, „101 produktov", 17 produktových odkazov, stránkovaciu navigáciu aj
`direction=next` odkaz. React tú hranicu iba prekreslí na klientovi. Vyskytuje sa na
`/sk/categories/*` a na PDP; `/sk`, `/sk/products`, `/sk/kontakt` sú čisté.

Jediný reálny náklad: **na každej kategórii a PDP sa loguje serverová chyba**, takže
error log nie je použiteľný ako signál — skutočná chyba v ňom zanikne.

---

## 6. Pre vlákno B

- **Použi `addVariantToCart` / `addListingItemToCartWithResult`** z
  `src/ui/components/plp/actions.ts`. Neimplementuj `{ok:true}` nad void akciou.
  `unconfirmed` NIE JE úspech a NIE JE dôvod opakovať mutáciu.
- Import: `import { addVariantToCart } from "@/ui/components/plp/actions"` a typy z
  `./add-to-cart-result`.
- Integračný SHA odo mňa: **`3fb6b65`**.
- `FitmentProductsByIds.graphql` stále nemá translation projekciu — kontrakt na to
  (A2.3) ešte nedodávam, je to zvyšná práca.

## 7. Pre deploy / ops

Na cieľovom deployi musia existovať (dnes v `/opt/storefront/.env` **nie sú**):
`REVALIDATE_SECRET` alebo `SALEOR_WEBHOOK_SECRET`. Bez nich `/api/revalidate` vracia 401 —
to je endpoint, ktorý funguje, nie chyba, a **neopravuje sa vypnutím autentifikácie**.
Kým nie sú nastavené, nič z §A2.5 sa nespustí.

Akceptácia invalidácie sa musí písať s deadlinom na konkrétnu novú verziu.
Webhook purge teraz používa `{ expire: 0 }`, nie pomenovaný profil — pomenované profily sú
stale-while-revalidate, takže „druhý request musí byť čerstvý" nie je garancia, o ktorú sa
dá oprieť.
