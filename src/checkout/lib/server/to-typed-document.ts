import "server-only";

import { type DocumentNode, print } from "graphql";

import { TypedDocumentString } from "@/gql/graphql";

/**
 * Bridge checkout codegen documents to the storefront GraphQL server helpers.
 *
 * The checkout module's codegen emits `graphql-tag` `DocumentNode`s (for the urql client);
 * MAKY's server executors (`executePublicGraphQL`/`executeAuthenticatedGraphQL`) take a
 * `TypedDocumentString` (a client-preset string document).
 *
 * We serialise the AST with graphql's `print` rather than reusing `document.loc.source.body`:
 * graphql-tag builds the raw source by concatenating interpolated fragment sources WITHOUT
 * de-duplicating them, so a fragment reused across a query (e.g. `Money`, pulled in by several
 * other fragments) appears multiple times in `loc.source.body`. Sending that string to Saleor
 * fails validation with `There can only be one fragment named "…"`. graphql-tag already
 * de-duplicates the parsed `definitions`, so printing the AST yields a valid single-copy query.
 * `dedupeFragments` is a defensive keep-first pass by fragment name, in case a future graphql-tag
 * stops de-duping its `definitions`.
 */
function dedupeFragments(document: DocumentNode): DocumentNode {
	const seen = new Set<string>();
	const definitions = document.definitions.filter((definition) => {
		if (definition.kind !== "FragmentDefinition") {
			return true;
		}
		const name = definition.name.value;
		if (seen.has(name)) {
			return false;
		}
		seen.add(name);
		return true;
	});

	return { ...document, definitions };
}

export function toTypedDocument<TResult, TVariables>(document: DocumentNode) {
	const body = print(dedupeFragments(document));
	if (!body) {
		throw new Error("toTypedDocument: printed an empty document");
	}
	return new TypedDocumentString<TResult, TVariables>(body);
}
