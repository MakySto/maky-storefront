import "server-only";

import { TypedDocumentString } from "@/gql/graphql";

/** Structural shape of a `graphql-tag` document — carries the original query string. */
type GqlTaggedDocument = { loc?: { source?: { body?: string } } };

/**
 * Bridge checkout codegen documents to the storefront GraphQL server helpers.
 *
 * The checkout module's codegen emits `graphql-tag` documents (for the urql client);
 * MAKY's server executors (`executePublicGraphQL`/`executeAuthenticatedGraphQL`) take a
 * `TypedDocumentString` (client-preset string document). `graphql-tag` preserves the raw
 * query on `loc.source.body`, so we reuse it as the string document — no `graphql`
 * dependency and no codegen split are needed to run checkout documents server-side.
 */
export function toTypedDocument<TResult, TVariables>(document: GqlTaggedDocument) {
	const body = document.loc?.source?.body;
	if (!body) {
		throw new Error("toTypedDocument: expected a graphql-tag document with loc.source.body");
	}
	return new TypedDocumentString<TResult, TVariables>(body);
}
