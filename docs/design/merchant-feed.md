# The product feed for Google Merchant Center

State: 15 November 2026. Written, tested, not deployed, not installed on the server. The pilot is Slovakia.

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

## What is not verified yet

Saleor is not reachable from where this was written. Checked: the items against the page's structured
data on fixtures, the route, the file route, and the writer as a real process against a stand-in for the
route (1 200 items, well-formed XML). Not checked: `MerchantFeedProducts` against the live Saleor (it
passed code generation against the schema of Saleor 3.23.31), the time a whole Slovak walk takes, and
how many products the first feed holds. The first dry run on the server answers all three and changes
nothing.

## Order of work after the merge

1. Deploy the build (the routes come with it).
2. Dry run on the server; look at the counts and the first item.
3. Install the timer, first run with `--write`, look at `/feeds/google-sk.xml.gz`.
4. In Merchant Center: add the file as a product source for Slovakia with a daily fetch, and set the
   delivery prices for Slovakia.
5. Another market when its dry run has been looked at and its delivery is set in Merchant Center:
   add it to `--markets` in the installed unit.
