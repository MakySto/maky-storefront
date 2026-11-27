# The product feed for Google Merchant Center

State: 27 November 2026. The Slovak feed has been live since 15 November. The unit in the repository now lists all twelve markets; it runs on the server only when a person installs it (see "Order of work", step 6).

## Why a feed

Merchant Center has been reading the products from the pages by itself. Of about 33 700 products it
approved 186 (owner's screenshots, 15 November): 72 % had no shipping weight, and the rest failed on
delivery settings. A page cannot state a shipping weight (structured data has no field Merchant Center
reads it from), and it cannot mark a set as a bundle. A feed can do both, and it lets the shop decide
which products are offered at all.

## Who decides what an item says

The shop does, and only the shop.

```
Saleor (channel of the market)
   │  one step of the catalogue, read past every cache
   ▼
src/lib/merchant-feed/page.ts      resolveExactLocaleProduct: abroad only a product with its whole translation
   ▼
src/lib/merchant-feed/item.ts      productJsonLdOptions + availabilityOf: the product page's own functions
   ▼
/api/internal/merchant-feed        one step as JSON, operator secret, loopback use
   ▼
scripts/ops/merchant-feed.mjs      walks the steps, writes XML, gzip, renames into place
   ▼
/var/lib/maky-feeds/google-<market>.xml.gz
   ▼
/feeds/google-<market>.xml.gz      the shop hands the file out; Merchant Center fetches it
```

Google compares every feed item with the page it links to and disapproves the product when price or
availability disagree. That is why there is no second program with rules of its own. `item.ts` reads
price, availability, URL, code and GTIN from `productJsonLdOptions` (`src/lib/seo/product-jsonld-options.ts`),
the object `[productSlug]/page.tsx` hands to `buildProductJsonLd`. A rule that changes there changes on
the page and in the feed at once, and `item.test.ts` fails if the two ever state different things for the
same product. The writer holds no rule about a product: it writes down what it is given.

Data ownership is unchanged. CFM owns the content, Saleor the price, currency and availability of each
market, the shop the presentation. The feed stores nothing and is no second catalogue.

## What an item carries

| Field                                 | Source                                                                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                  | Saleor's variant id. Unique, the same in every market, never shown. Not the visible code: several products may share one (`lib/product-code.ts`).                    |
| `title`, `link`                       | The product's name and URL in the market's language (the translated slug abroad).                                                                                    |
| `description`                         | The description as plain text, at most 5 000 characters; else the short description; else the name.                                                                  |
| `image_link`, `additional_image_link` | The gallery, in its order, without the "no image" placeholder. Up to ten further pictures.                                                                           |
| `price`, `sale_price`                 | The channel's gross price. With a discount, the price before it and the current one.                                                                                 |
| `availability`                        | `in_stock`, `out_of_stock` or `backorder`, by the page's own `availabilityOf`.                                                                                       |
| `availability_date`                   | For `backorder` only: the day of the run plus the longest wait the badge names, in working days (10 in the EU markets, 14 in the US and Canada, `DELIVERY_REGIONS`). |
| `brand`                               | The manufacturer attribute (`cfm:attribute:manufacturer`). Never the category.                                                                                       |
| `gtin`                                | The variant's `cfm_ean`, through `publicGtin`. For a set: the EAN of its bars.                                                                                       |
| `is_bundle`                           | `yes` for a set, which is a product with `cfm_component_eans`.                                                                                                       |
| `condition`                           | `new`.                                                                                                                                                               |
| `shipping_weight`                     | The variant's weight in Saleor.                                                                                                                                      |
| `product_type`                        | The category's name in the market's language.                                                                                                                        |
| `item_group_id`                       | The product, for a product with a real choice of variants (none in the catalogue today).                                                                             |

Left out of the feed, and counted by reason in every run:

- `untranslated`: abroad, a product without its whole translation. It has no page either.
- `not-purchasable`: the market shows the product and does not sell it (a quote button, or none).
- `no-price`, `no-image`: nothing to state; Google refuses an item without a picture.
- `no-brand`: Google requires the brand. On 15 November no set, no Kargo basket and no SnowDrive chain
  had a manufacturer in Saleor, so the first feed will be small. CFM is writing the manufacturer, the
  EANs and the weights; a product enters the feed the night after it has a manufacturer.

Left unsaid on purpose:

- `mpn`. The code on the page is the shop's own, not the maker's part number.
- `shipping`. The price of delivery is set in Merchant Center per country, from the owner's price table.
- `google_product_category`. Optional; a wrong one is worse than none.

## The sets

A roof-rack set is put together by the shop from parts that are also sold on their own. Google's rule
for that is the main product's identifiers plus `is_bundle`. So a set carries the EAN of its bars, where
CFM has published it in `cfm_component_eans`, and the flag. The same EAN appears on many sets; the flag
is what makes that legitimate. On the page the same set shows the EANs of all its parts and states no
`gtin` of its own, because structured data has no bundle flag.

## The writer

`scripts/ops/merchant-feed.mjs`, run by `maky-merchant-feed.timer` once a night. What it guarantees:

1. A dry run by default; `--write` is the only way a file changes.
2. A feed is whole or it is not replaced. A step that cannot be read after its retries ends that market
   and the file of the night before stays.
3. An empty feed is never written. A feed with less than half the items of the last one is not written
   without `--force`: to Merchant Center a missing item is a product withdrawn.
4. The file is written beside its final name and renamed.
5. The secret of the internal route is read from the shop's `.env` by name, sent only to a loopback
   address and never printed.

`status.json` beside the feeds holds, per market, when the feed was written, how many products were read,
how many items it has and how many were left out by reason. It is not served.

## Between two fetches: the Merchant API

Owner, 2026-11-15: the feed is the main source, and the Merchant API is added for one thing only, a
price or an availability that changed since the feed was fetched. Two main sources for the same products
would overwrite each other, so there is exactly one, the feed.

What Google's own description of the API says (read 2026-11-15 from the discovery documents of
`merchantapi.googleapis.com`, versions `products_v1`, `datasources_v1`, `accounts_v1`, `quota_v1`, and
from the guides; nothing of it was tried on the account):

- The Content API for Shopping was retired on 2026-08-18. The Merchant API v1 is its successor.
- The API cannot change a product that came from a file: `productInputs.insert` takes API data sources
  only. The documented way to change price and availability of a feed's products is a **supplemental**
  data source of type API, linked to the feed's (primary) source. Merchant Center's help names the rule
  for exactly this: for price and availability, "take latest", the most recently updated value of the
  two sources. The other way is the default rule, an ordered list: with the supplemental source ahead
  of `self`, an attribute the supplemental source states wins.
- A project in Google Cloud has to be registered with the Merchant Center account once
  (`developerRegistration:registerGcp`); without it every call answers 401. `--register --account <id>`
  does that one call, and nothing when the project is registered already.
- The legacy "Content API" source in the account (primary, type API, no products) is not used. It is a
  second main source, which is what the owner's decision rules out.

`scripts/ops/merchant-api.mjs`, run by `maky-merchant-api.timer` every hour, does it:

1. It walks the same internal route as the feed writer. The price and the availability it sends are
   the page's, by the same functions.
2. It compares each product with what Google was last told: by an earlier run if it ever sent that
   product, otherwise by the last written feed. The feed writer leaves that record beside every feed,
   `offers-<market>.json`. Comparing with what was sent is right under either way of linking: at worst
   a value the feed has caught up with is sent once more.
3. Only a difference is sent, and only for a product the feed names: the supplemental source cannot add
   a product. A product new since the feed waits for the next feed.
4. A product the walk no longer finds is told `out_of_stock` when two runs in a row missed it.
5. A walk that did not reach the end sends nothing. More than a quarter of the feed differing at once
   sends nothing without `--force`.
6. Before sending, it reads the account and refuses unless the feed's source exists and exactly one
   supplemental API source is linked to it. `--check` prints how it is linked and the quota;
   `--show <id>` prints what Google holds for one product. Both only read.
7. A sale that ended while the feed of the morning still states the sale price is ended by its dates
   (`salePriceEffectiveDate` closed at the time of the run): a supplemental source can state an
   attribute, it cannot take one away.

**Link the two with "take latest", not with the default rule.** With the supplemental source ahead of
the feed in the default rule, a value this program sent stays in front of the feed until the program
sends another. If the hourly run ever stops (a revoked key, a disabled timer), Google would go on
showing the last price it was sent while the feed states a newer one, which is worse than having no API
at all. With "take latest" the next fetched feed replaces it. The API does not show attribute rules, so
`--check` can only say which kind of link it sees; the rule itself is set, and looked at, in Merchant
Center.

The key of the Google service account is a SecureString in AWS SSM
(`/maky/storefront/google/merchant-api-key`). The program reads it at run time through the server's own
role, holds it in memory and writes it nowhere; it is not copied into `.env` (the shop's process has no
use for it, and `sync-secrets.sh` rightly refuses a value with quotes and line breaks). It is never in
this repository, in a log or in a message.

Set the fetch in Merchant Center soon after the feed is written (05:05 UTC). The record the hourly run
compares with is the feed as written; Google holds it only once it has fetched it.

## What is not verified yet

Saleor is not reachable from where this was written. Checked: the items against the page's structured
data on fixtures, the route, the file route, and the writer as a real process against a stand-in for the
route (1 200 items, well-formed XML). Not checked: `MerchantFeedProducts` against the live Saleor (it
passed code generation against the schema of Saleor 3.23.31), the time a whole Slovak walk takes, and
how many products the first feed holds. The first dry run on the server answers all three and changes
nothing.

For the Merchant API nothing has been tried on the account: the program was run against a stand-in for
Google that checks the signature of the sign-in and the shape of each request. To be seen on the account:
that a "take latest" rule for price and availability can be set between a file source and an API
supplemental source and what Google counts as the later value, how long an accepted change takes to show, the
quota (`--check` prints it), and with `--show` on the first real case that a sale ended by its dates is
shown at the full price.

## Order of work after the merge

1. Deploy the build (the routes come with it).
2. Dry run on the server; look at the counts and the first item.
3. Install the timer, first run with `--write`, look at `/feeds/google-sk.xml.gz`.
4. In Merchant Center: add the file as a product source for Slovakia with a daily fetch, and set the
   delivery prices for Slovakia.
5. The Merchant API, once the feed is a source in Merchant Center: a project in Google Cloud with the
   Merchant API enabled and a service account, added as a user of the Merchant Center account; its key
   into AWS SSM; in Merchant Center a supplemental source of type API linked ahead of the feed's;
   `--check` on the server, a dry run, then the hourly timer.
6. The other eleven markets (27 November, owner's go-ahead on the server thread): Merchant Center has
   delivery set for all eleven foreign countries, so the unit lists every market
   (`--markets sk,cz,de,at,pl,hu,it,fr,es,ro,us,ca`, the pilot first, limit 150 minutes). Before the
   installed unit is changed, a dry run of one market of each kind (`--markets de`, `--markets us`) is looked at:
   the counts, the first item, `shipping_weight`, the currency. Then the installed unit is replaced by the one in
   the repository and the first run is watched. The feed addresses are `/feeds/google-<market>.xml.gz`.

## Weight in the feed, measured

The writer states `shipping_weight` for every item whose variant has a weight in Saleor, and states nothing
for the others. Measured on the live Slovak feed of 27 November 05:12 UTC (29 110 items): 10 272 have a
weight (all in kg), 18 838 have none. By product type: Nordrive roof racks 9 157 of 9 157, dog cages 25 of 25,
roof boxes 55 of 60, towbar boxes 37 of 41; **Thule roof racks 0 of 12 044, Menabo 0 of 3 506, Green Valley 0 of
2 751, snow chains 0 of 153**. The weight does not depend on the market, so the other eleven feeds have the same
gaps. Where Merchant Center is told to charge by weight, an item without one cannot be placed in a weight
band; until the sets have weights, delivery for them stays a flat price per country.
