# Retired vehicle ids: how the storefront reads a merge of duplicate generations

14 Oct 2026. Owner: storefront (M). Producer: CFM 4.5, which merged duplicate vehicle generations
(99 generations into the 87 that remain, 14 summary labels dissolved into 2 to 3 generations each, model
`Up!` into `Up`; plan file `retired_public_ids.json`, schema `cfm-retired-public-vehicle-ids/1`).

## The problem

A merged row's public id (`veh:gn:…`) leaves the fitment dataset, and shoppers still hold it: in the
`maky-garage` cookie (public ids only) and in bookmarks of the vehicle page. Without help the garage says
"choose again" and the page answers 404.

## The contract

The map ships **inside the dataset**, top-level key `retiredVehicleIds`, so it is covered by `datasetHash`
and arrives at the same instant as the dataset that dropped the ids:

```json
{
	"retiredVehicleIds": {
		"schema": "cfm-retired-public-vehicle-ids/1",
		"generations": { "veh:gn:old": "veh:gn:remaining" },
		"generations_split": { "veh:gn:label": ["veh:gn:a", "veh:gn:b"] },
		"models": { "veh:md:old": "veh:md:remaining" }
	}
}
```

An entry may lead a shopper from a retired id to a live one. It never overrides a live id, and it is
believed only as far as the dataset in hand confirms it (`src/lib/fitment/retired-ids.ts`): a key that is
live is ignored, a target that is not live drops the entry, chains are followed to a live id (6 hops, a
loop is dropped), and a split needs two or more live candidates of one model, all of them. A missing or
partly wrong map costs a shopper one extra choice, never a wrong car. The validator only warns.

## What happens to a shopper

| Saved car            | Result                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| generation merged    | moved silently to the remaining generation; make and model from it; roof, body, doors kept if still offered; a year the remaining generation was never built in is asked again |
| label dissolved      | the car's year decides if it falls in exactly one candidate's window, otherwise the garage asks the shopper (2 to 3 options); never decided by a name                          |
| model merged         | rewritten silently                                                                                                                                                             |
| unknown id           | as before: header, configurator, PDP and cart treat it as "no car"; the garage keeps and flags it                                                                              |
| old vehicle page URL | permanent redirect to the remaining generation's page, or for a dissolved label to the model page                                                                              |

Compatibility is never carried over; the resolver answers it for the car the shopper ends up with.

All readers (header, home, garage, configurator, PDP, PLP filter, cart line) go through
`readGarage`/`readActiveSelection`, which run `canonicalGarage` (`src/lib/garage/retired.ts`); the garage
actions read the same canonical payload, so the indexes the UI shows are the indexes the actions change,
and a write heals the cookie.

## What the running process says

`/api/fitment/status` (public tier) carries `dataset.retiredIds` = `{ moved, split, models, dropped }`: how many
entries of the loaded dataset's map the process believes, and how many it drops as wrong. A dataset without a
map shows zeros. After CFM issues the dataset, `dropped` must be 0 and the counts must match the producer's
plan (99 / 14 / 1 for the first wave).

## Producer acceptance

`M_DELTA_OLD=<live.json> M_DELTA_NEW=<new.json> npx vitest run src/lib/fitment/retired-ids.check.test.ts`
(skipped without the two paths). It passes only if the new dataset validates and carries the map, every
entry is believed (0 dropped), and every generation or model the live dataset has and the new one lacks is
explained by the map.

## Not measured

- The status code of the page-level redirect on production (may be a client-side redirect with 200). A real
  301 needs old to new path pairs in `redirects.json`.
- A real dataset with the map: so far only the producer's plan file as fixture
  (`src/lib/fitment/fixtures/retired-public-ids-20261014.json`) and synthetic datasets.
- The cart does not store the vehicle in a line yet (SF-4). When it does, it must store public ids and read
  them through `canonicalGarage`.

## Order

The web code must be live before CFM writes the merge or issues the dataset; an older build ignores the new
key (the validator ignores unknown fields) and would send shoppers to "choose again".

## Stránky zlúčených generácií: skutočné 301 (18. 10. 2026)

Starý odkaz na stránku auta rieši `redirects.json` v `src/proxy.ts`, pred vykreslením, a to je skutočné HTTP 301. Page-úroveň (`retired-page.ts`) zostáva záloha pre stránku, ktorá v tabuľke nie je; v PPR sa tam stav odošle až po hlavičkách (200 s meta refresh alebo noindex; zmerané na produkcii 18. 10. 2026: 200 s `__next-page-redirect` a `NEXT_REDIRECT` 308 v tele, nie 301). Pre 12 stránok z odpovede CFM 4.5 z 18. 10. (144 dvojíc) tabuľka platí, takže hrana má prednosť pred mäkkým 404. Zoznam a pravidlo cesty sú v `redirects.merged-generations.test.ts`. Cieľ je stránka, ktorú web naozaj vykreslí (uzol s publikovanou stránkou); ak ju zostávajúci uzol nemá, odkaz ide o úroveň vyššie, nie na stránku, ktorú trasa nevykreslí.

## Fitment list of the week of 2026-11-30 (27. 11. 2026)

CFM corrects 11 overlapping generations. What the storefront does with each part, checked on a copy of
`3.0.0-full-20261022.2` with the four changes applied (`retired-ids.check.test.ts`: 0 dropped, nothing unexplained,
no set lost) and on the live site on 2026-11-27 (the four pages answer 200 and are indexed in sk):

| Change                                                                          | Web                                                                                                                                             |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Kamiq NW4 to NW, Patriot MK to MK74, Rexton Y250 to Y200 (`generations`)        | saved car moves silently; a year the successor was never built in is asked again; old page 301 to the successor (`redirects.json`)              |
| Mazda 3 Hatchback "2003-2013" split between BK and BL (`generations_split`)     | saved car settled by its year where one window holds it (2003-2008 BK, 2010-2013 BL), asked in 2009 and outside; old page 301 to the model page |
| End year of A6 Avant C8, Q3 F3, C5 Aircross (2025), Caddy 2K, Caddy Maxi (2015) | a saved car whose year is now past the end is ASKED again (`retired.ts`, live branch), nothing is moved by the year alone                       |
| Names C84 and SB, addresses unchanged                                           | read from the dataset at once; page titles follow the content release                                                                           |

**The map is cumulative.** Live on 2026-11-27 (`/api/fitment/status`, dataset `3.1.0-full-20261119.1`): `retiredIds`
moved 87, split 14, models 1, dropped 0. The new dataset must show moved 90, split 15, models 1, dropped 0. Anything
else means an earlier entry was lost.

**Order.** The four 301 rows (48 pairs, `redirects.merged-20261130.test.ts`) and the garage rule must be live BEFORE
CFM withdraws the four pages, and are best live before the candidate is approved; a page withdrawn without the 301
answers not-found. The 21 duplicated products are redirected from `product-redirects.json` (old slug to the kept
slug, per market; `scripts/ops/product-redirects-from-table.mjs`) and need CFM's table of pairs; the proxy redirects
only when Saleor says the old slug is gone and the new one exists, so the table can be deployed before CFM withdraws them.

**The 21 duplicated sets (CFM's table, 27. 11. 2026).** `karty-presmerovania-20261127.csv` (sha256 `5c56ce6f…1896`,
columns `trh,stary_slug,novy_slug`, all `sk-eur`): 8 Patriot MK to MK74, 9 Kamiq NW4 to NW, 4 Mazda 3 Hatchback to BL,
merged into `product-redirects.json` (release `…+zoznam-aut-20261130`, the script now takes a channel slug in the market
column and `--merge`s into what the file holds). CFM unpublishes the old sets in sk-eur (`isPublished` and
`visibleInListings` false) and keeps the slug. That is enough: the proxy asks Saleor without a token and in the market's
channel, as a shopper does, and Saleor answers null for a product not published there
(`proxy.product-redirects.test.ts`). The old address then answers 301 to the twin as soon as the product event reaches
`/api/revalidate`, and within the 5 minutes an existence answer is kept at the latest.

**Years of a set are the window as far as the car was built.** CFM keeps a set maker's window when it moves a
generation's years (point 4 of its reply, 27. 11. 2026). The decision already answered as the intersection would (the
selector and the garage accept only years of production, and for those the two windows answer alike:
`production-window.test.ts`), but the product page, the "Pre ktoré vozidlá" list and every card printed the window as
given: a Santa Fe TM built until 2023 with a Thule window 2021-2024 (59 such rows in the export of 2026-10-22), and
after this list "od 2018" for a Q3 F3 that ends in 2025. They now print `windowWithinProduction` (`contract.ts`): cut
to the years of production, never widened, a cut boundary without its month. A window that shares no year with its car
is printed as given and is a data fault the validator reports.
