import "server-only";

import type { TypedDocumentString } from "@/gql/graphql";
import { executePublicGraphQL, type GraphQLResult } from "@/lib/graphql";

import { b2bAppToken } from "./b2b-config";

/**
 * Saleor calls made AS the B2B app ("MAKY B2B checkout - production": MANAGE_TAXES + HANDLE_TAXES).
 *
 * Through the existing transport on purpose: `executeGraphQL` applies `saleorWriteDecision()` to every mutation, so
 * a worktree pointed at the production API still cannot write with this token, and the request queue, deadlines and
 * no-retry-on-mutation rules are the ones every other Saleor call obeys. The token is added as an explicit header
 * on these calls only — the public client and the customer-cookie path never carry it.
 *
 * Errors are reduced to a type and a code before they leave this module, so nothing that might echo a header or a
 * request reaches a browser, a log line or an analytics event.
 */

export type B2bAppCallError = {
	kind: "no-token" | "blocked" | "network" | "http" | "graphql";
	statusCode?: number;
	/** Saleor's message, kept server-side for diagnostics (never contains the token). */
	message: string;
};

export type B2bAppResult<T> = { ok: true; data: T } | { ok: false; error: B2bAppCallError };

/** Test seam: replaces the transport. */
type Executor = <Result, Variables>(
	document: TypedDocumentString<Result, Variables>,
	options: { variables: Variables; headers: HeadersInit; cache: RequestCache; signal?: AbortSignal },
) => Promise<GraphQLResult<Result>>;

let executorOverride: Executor | null = null;

export function setB2bAppExecutorForTests(executor: Executor | null): void {
	executorOverride = executor;
}

export async function executeB2bAppGraphQL<Result, Variables>(
	document: TypedDocumentString<Result, Variables>,
	variables: Variables,
	options: { signal?: AbortSignal } = {},
): Promise<B2bAppResult<Result>> {
	const token = b2bAppToken();
	if (!token) return { ok: false, error: { kind: "no-token", message: "SALEOR_B2B_APP_TOKEN is not set" } };

	const run: Executor =
		executorOverride ??
		((doc, opts) =>
			// The generic options type of the transport is conditional on `Variables`; the B2B documents always
			// declare their variables, so this cast only bridges the generic, not the shape.
			executePublicGraphQL(doc as never, opts as never) as never);

	const result = await run(document, {
		variables,
		headers: { Authorization: `Bearer ${token}` },
		cache: "no-store",
		signal: options.signal,
	});

	if (result.ok) return { ok: true, data: result.data };
	const { type, message, statusCode } = result.error;
	const kind: B2bAppCallError["kind"] =
		type === "blocked"
			? "blocked"
			: type === "http"
				? "http"
				: type === "graphql" || type === "validation"
					? "graphql"
					: "network";
	return { ok: false, error: { kind, statusCode, message: message.slice(0, 500) } };
}
