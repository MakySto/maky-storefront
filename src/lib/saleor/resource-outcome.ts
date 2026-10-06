import { unstable_rethrow } from "next/navigation";
import { rememberBriefly } from "@/lib/cache-fault";
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
			/** The deadline was spent in the local queue, not on Saleor (`GraphQLError.queueStarved`). */
			queueStarved?: true;
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
		...(result.error.queueStarved ? { queueStarved: true as const } : {}),
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
 * The body of a `"use cache"` function that answers with a `ResourceOutcome`.
 *
 * `found` and `not-found` are authoritative and are kept for the entry's life. A fault is handed
 * back as the `upstream-error` outcome it is and remembered for SECONDS (`@/lib/cache-fault`), so a
 * blip is not remembered as an absence for the length of a `cacheLife("minutes")` entry (revalidate
 * 60 s, stale 300 s, expire 3600 s) and the first prerender after it asks Saleor again.
 *
 * It is a value and not a throw. It used to be thrown out of the cache — Next stores a value and
 * does not store a rejection, which kept the fault out of the cache — but an error thrown out of a
 * `"use cache"` function also fails the static prerender it happens in, whether or not the caller
 * catches it, and the visitor whose request was being prerendered got a 500 on a page that could
 * have said "temporarily unavailable". See `@/lib/cache-fault` for the mechanism.
 *
 * Whatever the body throws besides Next's own control flow is taken for a fault as well, as
 * `catchUpstreamError` always took it: nothing leaves the cache as a throw.
 */
export async function cachedOutcome<T>(read: () => Promise<ResourceOutcome<T>>): Promise<ResourceOutcome<T>> {
	let outcome: ResourceOutcome<T>;
	try {
		outcome = await read();
	} catch (error) {
		unstable_rethrow(error);
		outcome = upstreamErrorFromRejection(error);
	}
	if (outcome.status === "upstream-error") rememberBriefly();
	return outcome;
}

/** What a read that threw means: always a fault, never an answer. */
export function upstreamErrorFromRejection(error: unknown): UpstreamError {
	return {
		status: "upstream-error",
		type: "network",
		retryable: true,
		message: `the read threw: ${error instanceof Error ? error.message : String(error)}`,
	};
}

/**
 * Wrap the call to a cached resolver. A cached resolver answers with an outcome (`cachedOutcome`)
 * and does not reject, so this is the safety net for what does reach it — the cache machinery
 * itself failing — and turns it into an outcome, so callers keep a total union to switch on
 * instead of a try/catch.
 *
 * ANY rejection becomes `upstream-error`. This used to test `instanceof UpstreamUnavailableError`
 * and rethrow everything else, which is right in vitest and was always wrong in production, where
 * an error thrown inside `"use cache"` reaches the caller as a new anonymous `Error`: every Saleor
 * fault was rethrown, out of `generateMetadata` as well, and the product page lost its title,
 * robots tag and canonical whenever any one market failed to answer.
 *
 * Next's own control flow — `notFound()`, `redirect()`, a prerender bailout — is not a fault and is
 * handed back to Next untouched.
 */
export async function catchUpstreamError<T>(
	run: () => Promise<ResourceOutcome<T>>,
): Promise<ResourceOutcome<T>> {
	try {
		return await run();
	} catch (error) {
		unstable_rethrow(error);
		return upstreamErrorFromRejection(error);
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
