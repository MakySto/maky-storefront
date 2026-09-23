import { unstable_rethrow } from "next/navigation";
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
 * The `digest` an `UpstreamUnavailableError` carries: `MAKY_UPSTREAM_UNAVAILABLE;<type>;<0|1>`.
 *
 * Why a digest and not the class: in a production build an error thrown inside a
 * `"use cache"` function does not reach the caller as itself. The cache runs in its own React
 * server environment, the rejection is serialised into the entry's stream, and the caller gets a
 * NEW plain `Error` whose message is React's production placeholder ("The specific message is
 * omitted in production builds"). `instanceof UpstreamUnavailableError` is therefore always
 * false there, and it was: with Saleor failing, the product page lost its title, robots tag
 * and canonical and the `[upstream-error]` line never appeared — measured on a production
 * build, 2026-09-23. Next does keep an error's OWN `digest` across that boundary
 * (`create-error-handler.js`: "If the error already has a digest, respect the original
 * digest"), so the classification rides on it. Only the type and the retry flag: a digest
 * can reach the browser if some future caller does not catch it, and Saleor's message
 * should not. The full message is still logged server-side by Next itself.
 */
const UPSTREAM_DIGEST_PREFIX = "MAKY_UPSTREAM_UNAVAILABLE";

const ERROR_TYPES: readonly GraphQLErrorType[] = ["network", "http", "graphql", "validation", "blocked"];

function upstreamDigest(outcome: UpstreamError): string {
	return `${UPSTREAM_DIGEST_PREFIX};${outcome.type};${outcome.retryable ? 1 : 0}`;
}

function parseUpstreamDigest(digest: unknown): { type: GraphQLErrorType; retryable: boolean } | null {
	if (typeof digest !== "string") return null;
	const [prefix, type, retryable] = digest.split(";");
	if (prefix !== UPSTREAM_DIGEST_PREFIX) return null;
	const known = ERROR_TYPES.find((candidate) => candidate === type);
	return known ? { type: known, retryable: retryable === "1" } : null;
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
	readonly digest: string;

	constructor(outcome: UpstreamError) {
		super(outcome.message);
		this.name = "UpstreamUnavailableError";
		this.type = outcome.type;
		this.retryable = outcome.retryable;
		this.digest = upstreamDigest(outcome);
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
 * What a rejection from a cached resolver means: always a fault, never an answer.
 *
 * A cached resolver resolves with the two authoritative answers and rejects for everything
 * else — so a rejection, whatever it looks like by the time it arrives, is by construction
 * "we could not find out". That is the only reading that survives production, where the
 * rejection arrives as an anonymous `Error` (see `UPSTREAM_DIGEST_PREFIX`). The digest, when
 * it is ours, only restores the detail for the log line.
 */
export function upstreamErrorFromRejection(error: unknown): UpstreamError {
	const digest =
		typeof error === "object" && error !== null ? (error as { digest?: unknown }).digest : undefined;
	const known = parseUpstreamDigest(digest);
	if (known) {
		return {
			status: "upstream-error",
			type: known.type,
			retryable: known.retryable,
			message:
				error instanceof UpstreamUnavailableError
					? error.message
					: `upstream unavailable (${String(digest)})`,
		};
	}
	return {
		status: "upstream-error",
		type: "network",
		retryable: true,
		message: `cached resolver rejected${typeof digest === "string" ? ` (digest ${digest})` : ""}: ${
			error instanceof Error ? error.message : String(error)
		}`,
	};
}

/**
 * Wrap the call to a cached resolver. Turns the rejection back into an outcome, so
 * callers keep a total union to switch on instead of a try/catch.
 *
 * ANY rejection becomes `upstream-error`. This used to test `instanceof
 * UpstreamUnavailableError` and rethrow everything else, which is exactly right in vitest and
 * always wrong in production (see `UPSTREAM_DIGEST_PREFIX`): every Saleor fault was rethrown,
 * out of `generateMetadata` as well, and the product page lost its title, robots tag and
 * canonical whenever any one market failed to answer.
 *
 * Next's own control flow — `notFound()`, `redirect()`, a prerender bailout — is not a fault
 * and is handed back to Next untouched; `unstable_rethrow` recognises those by their digests,
 * which survive the cache boundary for the same reason ours does.
 */
export async function catchUpstreamError<T>(
	run: () => Promise<AuthoritativeOutcome<T>>,
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
