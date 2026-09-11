import { OperationTypeNode, parse } from "graphql";

/**
 * Is this GraphQL document a READ or a WRITE?
 *
 * One classifier, used by two decisions that must never disagree: whether the
 * production write guard refuses the request (`src/lib/saleor/write-policy.ts`)
 * and whether `fetchWithRetry` may replay it. A document classified as a read in
 * one place and a write in the other would either leak a write past the guard or
 * replay a non-idempotent mutation.
 *
 * ## Why not a regular expression
 *
 * This used to be `/^\s*mutation\b/m`, which tests for the WORD `mutation` at the
 * start of a line rather than for the operation's TYPE. Reproduced locally, that
 * is wrong in both directions:
 *
 *     ,mutation Test { __typename }                                → read  (WRONG)
 *     fragment T on Mutation { __typename } mutation Test { ...T } → read  (WRONG)
 *     query Q {\n  mutation\n}                                     → write (WRONG)
 *
 * The first two are valid GraphQL — the spec treats commas as ignored tokens, and
 * a document may carry fragments alongside its operation — so a mutation written
 * either way would have been handed the full retry budget and let past the guard.
 * The third is a plain query with a field called `mutation`, which lost its
 * retries for no reason.
 *
 * So the decision is taken from the parsed document. The parser is the `graphql`
 * package the project already depends on for codegen; no new dependency, and no
 * second dialect of "what counts as a mutation".
 *
 * ## What an unclear document counts as
 *
 * A WRITE. If the source does not parse, or parses to no executable operation at
 * all, we cannot show it is safe — and the two callers fail in opposite
 * directions, so "assume read" would both open the guard and re-enable replay.
 * Refusing to send an unparseable document costs nothing: the server would have
 * rejected it anyway.
 */
export type OperationKind = "read" | "write";

/**
 * Documents are module-level constants, so this memoises a small fixed set. The
 * cap only matters if a caller ever builds query strings dynamically; it bounds
 * the map instead of letting it grow with traffic.
 */
const MAX_CACHED = 512;
const cache = new Map<string, OperationKind>();

function classify(source: string): OperationKind {
	let document;
	try {
		document = parse(source);
	} catch {
		return "write"; // unparseable — see above
	}

	let sawOperation = false;
	for (const definition of document.definitions) {
		if (definition.kind !== "OperationDefinition") continue;
		sawOperation = true;
		if (definition.operation === OperationTypeNode.MUTATION) return "write";
	}

	// Fragments only, or an empty document: nothing executable, nothing proven.
	return sawOperation ? "read" : "write";
}

export function classifyOperation(source: string): OperationKind {
	const hit = cache.get(source);
	if (hit !== undefined) return hit;

	const kind = classify(source);
	if (cache.size >= MAX_CACHED) cache.clear();
	cache.set(source, kind);
	return kind;
}

/** True when the document contains a mutation, or cannot be shown not to. */
export function isWriteOperation(source: string): boolean {
	return classifyOperation(source) === "write";
}
