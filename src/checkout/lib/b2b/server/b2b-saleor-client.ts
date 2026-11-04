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
	/**
	 * `invalid`: Saleor refused the DOCUMENT (HTTP 400 with GraphQL errors) — it does not validate against that
	 * endpoint's schema, so nothing in it was executed. `graphql`: it was executed and answered with errors.
	 */
	kind: "no-token" | "blocked" | "network" | "http" | "graphql" | "invalid";
	statusCode?: number;
	/** Saleor's message, kept server-side for diagnostics (never contains the token). */
	message: string;
	/** For `invalid`: Saleor's validation messages (schema names only, e.g. `Cannot query field "x" on type "Y".`). */
	messages?: string[];
};

export type B2bAppResult<T> = { ok: true; data: T } | { ok: false; error: B2bAppCallError };

/** Test seam: replaces the transport. */
type Executor = <Result, Variables>(
	document: TypedDocumentString<Result, Variables>,
	options: {
		variables: Variables;
		headers: HeadersInit;
		cache: RequestCache;
		signal?: AbortSignal;
		operationName?: string;
	},
) => Promise<GraphQLResult<Result>>;

let executorOverride: Executor | null = null;
let publicExecutorOverride: Executor | null = null;

export function setB2bAppExecutorForTests(executor: Executor | null): void {
	executorOverride = executor;
}

export function setB2bPublicExecutorForTests(executor: Executor | null): void {
	publicExecutorOverride = executor;
}

/**
 * Saleor answers a document that does not validate against its schema with HTTP 400 and the GraphQL errors (the
 * transport hands them over as the response text). Those messages say which name the endpoint does not know.
 */
function invalidDocumentMessages(statusCode: number | undefined, message: string): string[] | null {
	if (statusCode !== 400) return null;
	const start = message.indexOf("{");
	if (start < 0) return null;
	try {
		const body = JSON.parse(message.slice(start)) as { errors?: Array<{ message?: unknown }> };
		const messages = (body.errors ?? [])
			.map((error) => (typeof error?.message === "string" ? error.message : ""))
			.filter(Boolean);
		return messages.length ? messages.slice(0, 8).map((text) => text.slice(0, 200)) : null;
	} catch {
		return null;
	}
}

function reduceError(error: { type: string; message: string; statusCode?: number }): B2bAppCallError {
	const { type, message, statusCode } = error;
	if (type === "http") {
		const messages = invalidDocumentMessages(statusCode, message);
		if (messages)
			return { kind: "invalid", statusCode, message: messages.join(" | ").slice(0, 500), messages };
	}
	const kind: B2bAppCallError["kind"] =
		type === "blocked"
			? "blocked"
			: type === "http"
				? "http"
				: type === "graphql" || type === "validation"
					? "graphql"
					: "network";
	return { kind, statusCode, message: message.slice(0, 500) };
}

const defaultExecutor: Executor = (doc, opts) =>
	// The generic options type of the transport is conditional on `Variables`; the B2B documents always declare
	// their variables, so this cast only bridges the generic, not the shape.
	executePublicGraphQL(doc as never, opts as never) as never;

export async function executeB2bAppGraphQL<Result, Variables>(
	document: TypedDocumentString<Result, Variables>,
	variables: Variables,
	options: { signal?: AbortSignal; operationName?: string } = {},
): Promise<B2bAppResult<Result>> {
	const token = b2bAppToken();
	if (!token) return { ok: false, error: { kind: "no-token", message: "SALEOR_B2B_APP_TOKEN is not set" } };

	const run: Executor = executorOverride ?? defaultExecutor;
	const result = await run(document, {
		variables,
		headers: { Authorization: `Bearer ${token}` },
		cache: "no-store",
		signal: options.signal,
		...(options.operationName ? { operationName: options.operationName } : {}),
	});

	if (result.ok) return { ok: true, data: result.data };
	return { ok: false, error: reduceError(result.error) };
}

/**
 * A B2B read WITHOUT the token: `checkout.b2bTaxState` is public like every other field of the checkout (the
 * checkout id is the credential, contract §4). So the state can be read, and stated, also when the app's access is
 * not ready; only the attestation write needs the app.
 */
export async function executeB2bPublicGraphQL<Result, Variables>(
	document: TypedDocumentString<Result, Variables>,
	variables: Variables,
	options: { signal?: AbortSignal } = {},
): Promise<B2bAppResult<Result>> {
	const run: Executor = publicExecutorOverride ?? defaultExecutor;
	const result = await run(document, { variables, headers: {}, cache: "no-store", signal: options.signal });
	if (result.ok) return { ok: true, data: result.data };
	return { ok: false, error: reduceError(result.error) };
}
