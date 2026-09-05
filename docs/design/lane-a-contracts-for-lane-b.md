# Lane A → Lane B: the contracts B consumes (2026-09-05)

**Pin this document to `claude/sf-a-catalog-l10n-seo`. Every symbol below is already
exported by A; A adds nothing new for B.** Read it against A's HEAD, not against
production — production has none of this.

|            |                                                            |
| ---------- | ---------------------------------------------------------- |
| Lane A     | `claude/sf-a-catalog-l10n-seo` (see the branch tip in git) |
| Lane B     | `claude/sf-b-vehicles @ 3a981ac`                           |
| Production | `feat/cms-m2 @ e353c70`, artifact `bdcc925`                |

Three integration gaps are real and verified. All three are B-side changes; none needs a
change in A. **B branched before A's cart rewrite, so B's current code is not misuse of
these contracts — it is a correct workaround for the untyped API B can see today. It
becomes misuse at the merge, which is why this exists now.**

---

## 1. Cart — `@/ui/components/plp/actions` + `@/ui/components/plp/add-to-cart-result`

```ts
addVariantToCart(input: {
  channel: string; variantId: string; quantity: number; maxQuantity?: number | null;
}): Promise<AddToCartResult>

type AddToCartResult =
  | { status: "added" }
  | { status: "rejected"; reason: AddToCartRejection; message: string }
  | { status: "unconfirmed"; message: string };

type AddToCartRejection = "unavailable" | "invalid" | "not-found" | "checkout" | "rejected";
```

**The semantics that matter, in one line each.**

- `added` — Saleor answered and the line is in the checkout.
- `rejected` — Saleor answered and said no, **or** the request was never sent. Safe to
  tell the customer it did not happen, and safe to let them try again.
- `unconfirmed` — **we do not know.** The write may have landed.

**`unconfirmed` must never be rendered as "sold out", "failed", or anything with an
error tone, and must never trigger an automatic retry.** `checkoutLinesAdd` is not
idempotent — live-verified, the same call three times takes a line from 1 to 3 — so a
retry is how one click becomes two lines. Render it the way `CartForm` does: a neutral
status, and an invitation to look at the cart.

A settles an unclear write by READING the checkout back, bounded by both an attempt
schedule and a wall clock, and it can no longer answer `rejected` from a read at all. An
unchanged read is a statement about one instant, not about the future.

### What B replaces

`src/lib/fitment/cart-actions.ts` builds a `FormData`, calls the void wrapper
`addListingItemToCart`, and infers the outcome by counting the line quantity before and
after with its private `countLine` helper. Replace all of that with one call:

```ts
const result = await addVariantToCart({ channel, variantId: saleorVariantId, quantity: 1 });
```

and **delete `countLine`**. A's `reconcile` already does that read-back, and does it
better: bounded, repeated, and structurally incapable of calling an unchanged read a
failure. Two independent estimates of the same fact is the thing to remove.

`addListingItemToCart` (void) stays exported only so B keeps compiling across the merge.
It swallows the outcome, which is the behaviour all of this exists to remove. Nothing in
Lane A calls it.

---

## 2. Availability — the metafield is on the VARIANT

`cfm_availability_mode` is published by CFM on the **ProductVariant**, never on the
Product. Verified live: 100/100 variants carry it, 0/100 products do.

**B already knows this and already does it right in one place.** B's own
`src/graphql/ProductListItem.graphql:83` reads the metafield from `variants` and carries
the identical "100/100 variants, 0/100 products" comment. Only
`FitmentProductsByIds.graphql:30` reads it from the product node. So this is a one-line
divergence inside B, not a disagreement between lanes — and **not a reason to ask CFM to
duplicate the metafield onto the product.**

The consequence is silent and green. `offers.ts:299` and `:373` pass the product's
always-null metafield into `availabilityFrom(...)`, so every real product resolves to
`"unknown"`, and the `on-demand` branch at `configurator-results.tsx:200` is dead code on
the real path — the configurator shows no "Na objednávku" line for a variant where the
PLP and PDP both show one. Nothing looks broken because `quantityAvailable` IS read from
the variant, so the out-of-stock branch still works.

Resolver to use, unchanged: `resolveAvailability` from
`@/ui/components/product/availability-badge`. B is already on the right resolver; only
the query needs moving.

---

## 3. Localization — A refuses, it does not fall back

`src/lib/saleor/exact-locale.ts` is in B **byte-identical**, exporting the same eight
symbols, and B never calls it.

```ts
resolveExactLocaleProduct<T extends ProductLike>(product: T | null | undefined, locale: string): T | null
resolveExactLocaleProducts<T extends ProductLike>(products: readonly T[], locale: string): { products: T[]; dropped: number }
```

The rule is stronger than "prefer the translation". For a non-source locale the function
returns **null** unless `translation.name`, `translation.description` and
`translation.seoDescription` are all present — and null again if any attribute, category
or variant translation is incomplete. Nothing in it falls back to the Slovak row.

`offers.ts:293` does `name: node.translation?.name ?? node.name`. That `??` is the half
that matters: it is not a missing feature, it is the one thing A's localization policy
forbids, using a function B already has.

**The slug is the single deliberate exception** (`exact-locale.ts:167`): a base slug is
allowed as a URL fallback and is never used as visible content. So B's `/${offer.slug}`
links do resolve — `lookupBySlug` asks the base slug first — and the defect is a
Slovak-slugged URL with a Slovak name on a foreign page, not a 404.

Convention to imitate: A localizes at the **data boundary**, once, immediately after the
fetch (`products/page.tsx:138`, `categories/[slug]/page.tsx:242`, and four more). That is
why the card builders downstream can read plain `product.name` with no `??` anywhere —
the substitution already happened. Do it in `offers.ts`, not in the components.

---

## 4. Display code — `@/lib/product-code`

```ts
publicProductCode(variant: { name?: string | null; id?: string | null } | null | undefined): string | null
```

**The symbol is `publicProductCode`. There is no `displayCode` and A must not create
one** — knip already fails on pre-existing unused exports.

Source is `variant.name`, accepted only when it passes the shape test (length 3–40,
`/^[A-Za-z0-9|/.-]+$/`, at least one digit, no `CFMP-` marker). `variant.sku` is **never**
a fallback: on the bundle products the SKU is the short code with a CFM-internal suffix
appended, and leaking that is what the helper exists to prevent. `null` means render
nothing — a missing code tells a shopper nothing, the internal SKU tells them something
false.

**The result is a label, not a key.** It need not be unique, and it must never be used
for joining, deduplication or fitment. Use `variant.id`. In particular: do not parse a
bundle's components out of the code string — carry them as explicit items with
quantities.

Do NOT route the cart, drawer or order views through this. They render `variant.name` as
the _variant label_, which is correct for them; for a colour variant "Black" is the right
answer and this helper would suppress it.

---

## 4b. Checkout lookup — `@/lib/checkout`

```ts
lookup(checkoutId: string, options?: { signal?: AbortSignal; retry?: boolean }):
  Promise<{ status: "found"; checkout: T } | { status: "not-found" } | { status: "upstream-error"; reason: string }>

findOrCreate({ channel, checkoutId }):
  Promise<{ status: "ready"; checkout: T; created: boolean } | { status: "unavailable"; reason: string }>
```

`find()` still exists and still returns `T | null`, but it is for surfaces that only
DISPLAY. **Anything that may write — replace a cookie, create a replacement, clear a
session — must use `lookup`.** Collapsing "Saleor says this is gone" into "we could not
ask" is what made a few seconds of downtime take a shopper's basket away.

`not-found` is a claim and only a definitive reply earns it. Measured against live
Saleor: a well-formed but missing id answers `data.checkout: null` (that is
`not-found`); a malformed id answers with GraphQL errors (that is `upstream-error`).

The three `AddToCartResult` statuses are unchanged.

## 5. Stability

Everything listed is already exported today, so B can adopt it without waiting for A.
`AddToCartRejection`, `ReadBackVerdict` and `AvailabilityMode` are exported and currently
unimported — they are part of the existing knip baseline, not new debt.

What A will NOT change without telling B: the three `AddToCartResult` status strings and
their meanings, the `publicProductCode` signature and its null-means-silence rule, and
the variant-side location of `cfm_availability_mode`.
