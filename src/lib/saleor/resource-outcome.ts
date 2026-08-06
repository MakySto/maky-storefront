import type { GraphQLErrorType, GraphQLResult } from "@/lib/graphql";

/**
 * Whether a resource is absent, or whether we simply could not find out.
 *
 * `src/lib/graphql.ts` has always returned a proper discriminated result —
 * `{ok:false, error:{type, statusCode, isRetryable}}` — and every caller threw
 * that away one line later:
 *
 *     if (!result.ok) { console.error(...); return null; }
 *     return result.data.product;      // null here too
 *
 * So a timeout, a 5xx, a GraphQL error and Saleor authoritatively answering
 * `product: null` all arrived at the page as the same `null`, and the page called
 * `notFound()`. Today that only produces a soft 404, which is survivable. The
 * moment a real 404 is wired to the same signal, a thirty-second Saleor blip
 * becomes hours of real 404s on real, buyable products — and that is not
 * survivable, because a 404 is a removal signal and `noindex` is not.
 *
 * `src/lib/cms/client.ts` already models this correctly for Payload. This is the
 * same idea for Saleor.
 */
export type AuthoritativeOutcome<T> = { status: "found"; resource: T } | { status: "not-found" };

export type ResourceOutcome<T> =
	| AuthoritativeOutcome<T>
	| {
			status: "upstream-error";
			type: GraphQLErrorType;
			retryable: boolean;
			message: string;
	  };

/**
 * Map a transport result onto an outcome.
 *
 * The only branch that may produce `not-found` is a SUCCESSFUL response whose
 * payload says the resource is not there. Everything else is a fault.
 */
export type UpstreamError = Extract<ResourceOutcome<never>, { status: "upstream-error" }>;

/**
 * The `upstream-error` arm for a failure you have already narrowed by hand.
 *
 * For the listing components, which need the connection rather than the resource
 * and so cannot go through `toOutcome`, but must still log and throw rather than
 * calling notFound().
 */
export function upstreamError(result: Extract<GraphQLResult<unknown>, { ok: false }>): UpstreamError {
	return {
		status: "upstream-error",
		type: result.error.type,
		retryable: result.error.isRetryable ?? false,
		message: result.error.message,
	};
}

export function toOutcome<Data, Resource>(
	result: GraphQLResult<Data>,
	pick: (data: Data) => Resource | null | undefined,
): ResourceOutcome<Resource> {
	if (!result.ok) {
		return upstreamError(result);
	}

	// `executeGraphQL` can hand back `{ok:true, data:null}` when Saleor returns a
	// null payload with no `errors` key. That is a contract violation, not an
	// answer, and `pick()` would throw on it.
	if (result.data == null) {
		return {
			status: "upstream-error",
			type: "graphql",
			retryable: true,
			message: "the response carried no data and no errors",
		};
	}

	const resource = pick(result.data);
	return resource == null ? { status: "not-found" } : { status: "found", resource };
}

/**
 * Thrown out of a `"use cache"` function so the entry is never stored.
 *
 * Next does not cache a rejected promise — it re-runs the body on the next call.
 * Verified against this exact version rather than assumed; see
 * `resource-outcome.test.ts`. That property is the whole mechanism: it means an
 * upstream fault can be kept out of the cache without any new cache
 * infrastructure, which is what stops a blip from being remembered as an absence
 * for the length of a `cacheLife("minutes")` entry (revalidate 60 s, stale 300 s,
 * expire 3600 s).
 */
export class UpstreamUnavailableError extends Error {
	readonly type: GraphQLErrorType;
	readonly retryable: boolean;

	constructor(outcome: UpstreamError) {
		super(outcome.message);
		this.name = "UpstreamUnavailableError";
		this.type = outcome.type;
		this.retryable = outcome.retryable;
	}
}

/**
 * Call at the END of a `"use cache"` body. Returns `found` and `not-found`
 * unchanged — both are authoritative and worth caching — and throws on a fault.
 */
export function refuseToCacheUpstreamError<T>(outcome: ResourceOutcome<T>): AuthoritativeOutcome<T> {
	if (outcome.status === "upstream-error") {
		throw new UpstreamUnavailableError(outcome);
	}
	return outcome;
}

/**
 * Wrap the call to a cached resolver. Turns the throw back into an outcome, so
 * callers keep a total union to switch on instead of a try/catch.
 */
export async function catchUpstreamError<T>(
	run: () => Promise<AuthoritativeOutcome<T>>,
): Promise<ResourceOutcome<T>> {
	try {
		return await run();
	} catch (error) {
		if (error instanceof UpstreamUnavailableError) {
			return {
				status: "upstream-error",
				type: error.type,
				retryable: error.retryable,
				message: error.message,
			};
		}
		throw error;
	}
}

/**
 * The resource, or null — for the places that genuinely do not care why.
 *
 * Deliberately narrow. Reach for it only where an absent resource and a broken
 * upstream really do lead to the same rendering, and never where a status code or
 * a cache entry depends on the answer.
 */
export function resourceOrNull<T>(outcome: ResourceOutcome<T>): T | null {
	return outcome.status === "found" ? outcome.resource : null;
}

/** One structured log line per fault, so the gate's fail-open rate is measurable. */
export function logUpstreamError(
	scope: string,
	outcome: UpstreamError,
	context: Record<string, string>,
): void {
	console.error(
		`[upstream-error] ${JSON.stringify({
			scope,
			type: outcome.type,
			retryable: outcome.retryable,
			message: outcome.message,
			...context,
		})}`,
	);
}
