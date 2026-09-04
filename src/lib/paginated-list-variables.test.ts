import { describe, expect, it } from "vitest";
import {
	ProductListByCategoryDocument,
	ProductListByCollectionDocument,
	ProductListPaginatedDocument,
} from "@/gql/graphql";
import { getPaginatedListVariables } from "./utils";

/**
 * Every document that is handed `getPaginatedListVariables()` output must
 * declare all four pagination variables.
 *
 * GraphQL discards variables an operation does not declare, silently and
 * without an error. So a document that declares only `$first`/`$after` and is
 * given `{last, before}` does not paginate backwards — it sends
 * `products(first: null)`, and Saleor answers:
 *
 *     You must provide a `first` or `last` value to properly paginate
 *     the `products` connection.
 *
 * which rejects the listing's Suspense boundary. That was live on production
 * in Slovak on both the category and the collection listing: HTTP 200, hero
 * and chrome intact, product grid replaced by the error fallback.
 *
 * The assertion is deliberately structural rather than a fixture of today's
 * three documents' text, because the failure is invisible at build time — no
 * type error, no lint error, and `next build` passes.
 */
const PAGINATED_DOCUMENTS = {
	ProductListByCategory: ProductListByCategoryDocument,
	ProductListByCollection: ProductListByCollectionDocument,
	ProductListPaginated: ProductListPaginatedDocument,
};

describe("paginated list documents", () => {
	const directions = ["next", "prev"] as const;

	it.each(directions)("getPaginatedListVariables produces a %s window", (direction) => {
		const variables = getPaginatedListVariables({ params: { cursor: "WyJhIl0=", direction } });
		const keys = Object.keys(variables).sort();
		expect(keys).toEqual(direction === "prev" ? ["before", "last"] : ["after", "first"]);
	});

	it.each(Object.entries(PAGINATED_DOCUMENTS))("%s declares every pagination variable", (_name, doc) => {
		const source = String(doc);
		for (const variable of ["$first", "$after", "$last", "$before"]) {
			expect(source).toContain(`${variable}: `);
		}
	});

	it.each(Object.entries(PAGINATED_DOCUMENTS))("%s passes all four to products()", (_name, doc) => {
		const source = String(doc);
		const args = /products\(([^)]*)\)/.exec(source)?.[1] ?? "";
		for (const variable of ["$first", "$after", "$last", "$before"]) {
			expect(args).toContain(variable);
		}
	});
});
