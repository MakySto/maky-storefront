# M3 — the customer journey, first pass

Written 10 September 2026, on top of the M2 handoff. Branch-only. Nothing is deployed,
published, sellable or indexable, and this document does not make it so.

## Where it is

|             |                                                                           |
| ----------- | ------------------------------------------------------------------------- |
| Branch      | `claude/maky-store-integration-abcd-4e54c6`                               |
| Base        | `b7d55d8` — the M2 tip                                                    |
| Commits     | `d5bfc47` (i18n of the journey), `0ae3229` (header nav), `eff1ab3` (sort) |
| Local build | `pnpm build` clean                                                        |
| Tests       | **1796 passed**, 9 skipped                                                |
| Regression  | **96/96 identical**, every field, vs `b7d55d8`                            |

## Two things I did NOT fix, because reproducing came first

The brief says to reproduce a fault before fixing it. Both of these looked like defects
in the first browser pass and are not:

1. **The configurator and the garage render empty.** They do — with no
   `MAKY_FITMENT_PROVIDER`. That is the documented safe default (`provider.ts`: "THE
   DEFAULT IS OFF… the only safe default"). With `MAKY_FITMENT_PROVIDER=fixture` the
   vehicle selector is there and works. Not a defect; a missing local env var.
2. **`/sk/search?q=nosic` answers "Stránka nenájdená".** The parameter is `?query=`,
   which is what the header form actually submits. My test was wrong, not the page.

I also checked the configurator add-to-cart defect recorded in the project notes
(a `"use client"` constant read from `"use server"`, yielding `NaN`). Lane B
(`2139f1a`) **is** an ancestor of this branch and `cart-actions.ts` passes a literal
`quantity: 1`. Already fixed; not fixed again.

## What was actually broken

### The header linked a page eleven markets do not have

`/poradna` was in the primary navigation of all twelve markets. One has it. The other
eleven answer **404** — from the header, on every page.

It showed up as `404 /de/poradna?_rsc=…` in the network log of an ordinary add-to-cart
walkthrough, which is worse than it first sounds: Next prefetches nav links, so the
dead link was being fetched continuously, not only when clicked.

`HeaderPrimaryNav` took `channel` and destructured it away — `({}: { channel: string })`
— which is how a nav that cannot see the market ends up asserting the same routes for
all of them.

Task A gave the footer this rule and the header never got it. **Both now call one
shared `visibleNavLinks`**, because two copies of a rule that disagree is how this
happened in the first place.

> The trap: `/stresne-nosice` is a root _catalogue_ URL, not an entry in
> `route-policy`, so `marketHasRoute` answers "no" for every category link and a naive
> filter empties the entire menu. Only market-root segments are filtered.

**Verified on a real build: every header link on all twelve markets resolves 200** —
`sk` 17 links, the other eleven 15 each — with `Poradňa` still in the Slovak nav and
`Ratgeber` gone from the German one.

### The journey spoke English

A visitor on the Slovak storefront who searched, logged in or opened their account was
answered in English.

| surface        | was                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sk/login`    | "Welcome Back", "Enter your password"                                                                                                              |
| `/sk/signup`   | "Create an Account", "Re-enter your password", "Passwords do not match", "Please check your email to verify your account."                         |
| `/sk/search`   | "Results for …", "N products found", "No results for …", the help paragraph, "Browse All Products", "Go to Homepage"                               |
| search sort    | "Relevance", "Price: Low to High", "Price: High to Low", "Name", "Newest"                                                                          |
| `/sk/account*` | "Here is an overview of your account activity.", "Recent Orders", "Default Address", "Manage your saved addresses", "Manage your account settings" |
| PDP            | "Unable to load product options.", "Try again"                                                                                                     |
| set-password   | "Password Updated!", "Redirecting you to the store…", "Set New Password"                                                                           |

**The count could not be patched with a string.** English needs two plural forms;
Slovak, Czech, Polish and Romanian need three, and `count === 1 ? "product" :
"products"` cannot express that. `plp.productCount` already carries each locale's
rules, so the search page uses it: _9 421 produktov_, _58 produktov_, _1 produkt_.

Existing keys were reused wherever the meaning already existed rather than adding a
synonym — `product.noImageAvailable`, `checkout.addressForm.noSavedAddressesYet`,
`pages.backToHome`, `common.retry`, `plp.price`, `product.quantity`, and four of the
five sort labels. Sort labels are message **keys** now, so the search control and the
listing control cannot name the same ordering two ways.

### Screen-reader text was English too

Worse than it looks: invisible on screen, and read aloud to exactly the visitors who
depend on it. The mobile trigger said "Open menu", the nav landmark "Primary
navigation", the drawer "Navigation menu", and every order in the account listed its
columns as "product", "quantity and unit price", "price".

`/sk` now serves: _Hlavná navigácia, Jazyk, Mena, Otvoriť menu, Váš košík, Všetky
kategórie, Zoznam prianí_ — no English.

## Deliberately left in English

| where                           | why                                                            |
| ------------------------------- | -------------------------------------------------------------- |
| US/CA model withdrawal forms    | approved legal copy                                            |
| `src/app/not-found.tsx`         | no market context by construction — its own comment says so    |
| `src/app/page.tsx`              | a developer configuration error, not a customer surface        |
| `nav/components/search-bar.tsx` | **no importers at all** — dead code, worth deleting separately |

The English sweep went from 26 candidate strings across 14 files to 13 across 6, and
every one of the 13 is in the list above.

## The purchase journey, walked

With `MAKY_FITMENT_PROVIDER=fixture`, in a real browser against a real build:

| step                 | result                                                        |
| -------------------- | ------------------------------------------------------------- |
| PDP → add to cart    | badge **0 → 1**                                               |
| `/sk/cart`           | the line item, its name, _Odstrániť_, _Prejsť k pokladni_     |
| switch to `/de/cart` | **empty — 0 Artikel**                                         |
| back to `/sk/cart`   | the item is still there                                       |
| `/checkout`          | renders, Slovak, three steps: _Informácie · Doprava · Platba_ |

**The empty German cart is correct, not a bug.** Carts are per channel — the checkout
id is stored per market (`checkoutId-<kanál>`), and prices, currency and availability
all differ. A cart that followed the visitor across markets would carry a Slovak price
into a German checkout. Switching back restores it.

## Gates

| Gate                    | Result                                                      |
| ----------------------- | ----------------------------------------------------------- |
| `tsc --noEmit`          | clean                                                       |
| `eslint`                | 0 errors, the same 6 pre-existing warnings                  |
| `vitest run`            | **1796 passed**, 9 skipped                                  |
| i18n parity             | 12 locales, **674 keys, identical**                         |
| `pnpm build`            | exit 0, with the prebuild hook                              |
| `check:nav`             | 6 categories resolve, indexable, no slug collision          |
| Header links            | 12/12 markets, **0 broken**                                 |
| Regression vs `b7d55d8` | **96/96 identical** on every field                          |
| Viewport                | 360 px and 1280 px on the changed pages, no sideways scroll |

> The regression extractor strips `<header>` to isolate page content, so it is blind to
> the nav change by design. That change was verified separately by resolving every
> header link on every market — which is the stronger check for it anyway.

### Falsified

| deliberate defect                                          | result                |
| ---------------------------------------------------------- | --------------------- |
| remove the category-link exemption (the menu-emptying bug) | **1 red**             |
| remove the market gate                                     | **1 red** — see below |

The market gate falsification came back **green the first time**. The only case
exercised was `/poradna`, and `cmsRouteAvailable` checks the market again itself, so
removing the outer gate changed nothing. The gate is load-bearing for **static**
routes, which had no case at all. I added one; it now goes red. A falsification that
passes is a finding about the test, not a clean bill of health.

## Still open

- **The rest of M3.** Configurator year/generation/roof-type flow, the garage's
  test-versus-save distinction and removal, PDP set/BOM and stock wording,
  wishlist/newsletter truthfulness. This pass covered navigation, search, account/auth
  and the add-to-cart → cart → checkout spine.
- **The RAV4 regression scenario** needs a supplied fitment fixture; the committed one
  does not contain it.
- **`nav/components/search-bar.tsx` is dead code** — two English strings in a file
  nothing imports.
- **React hydration warnings** (#418/#419) appear on several pages in the console. Not
  investigated; pre-existing, and present on the base build too.
- **D**, Payload provider E2E, Saleor, Returns, CFM — unchanged owners.

## How to reproduce

```bash
export NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/
export NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur
export NEXT_PUBLIC_STOREFRONT_URL=https://maky.store
pnpm build
MAKY_FITMENT_PROVIDER=fixture node_modules/.bin/next start -p 3457   # never -H 127.0.0.1
```

The configurator needs `MAKY_FITMENT_PROVIDER=fixture` or it is correctly empty.
Search takes `?query=`, not `?q=`. Local test runs are not GitHub CI.
