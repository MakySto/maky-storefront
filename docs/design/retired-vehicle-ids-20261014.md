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
