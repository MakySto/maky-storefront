import "server-only";
import { cmsCollectionTag, cmsPageTag } from "./cache-tags";
import { readCmsConnection } from "./env";
import { type PayloadLocale } from "./markets";
import { parsePagesResponse, type CmsPage } from "./page-schema";

/**
 * Server-side reader for Payload CMS.
 *
 * Network shape:
 *
 *   Next.js server ──CF-Access service token──▶ Cloudflare Access ──▶ Payload REST
 *
 * The browser never talks to cms.maky.store. The service token opens the network
 * boundary only; Payload's own access rules still decide which documents an
 * anonymous caller may read, and an anonymous caller sees published documents
 * only — verified against production, including with `draft=true` forced on.
 *
 * No Payload `Authorization` header is sent. Adding one would escalate this reader
 * from "anonymous, published-only" to whatever that credential can see, which is
 * exactly the blast radius we do not want behind a public route.
 */

/** How long the Data Cache holds a page if no webhook arrives. Insurance, not the mechanism. */
const FALLBACK_REVALIDATE_SECONDS = 900;

export type CmsPageOutcome =
	/** A published document, validated. */
	| { readonly status: "found"; readonly page: CmsPage }
	/** The CMS answered authoritatively: no such published page. Do not use a fallback. */
	| { readonly status: "not-found" }
	/** Upstream fault or contract break. Render the code fallback. */
	| { readonly status: "error"; readonly reason: string };

function logCmsError(event: string, detail: Record<string, unknown>): void {
	// Structured single line, no secrets — only status codes, slugs and reasons.
	console.error(`[cms] ${event}`, JSON.stringify(detail));
}

/**
 * Fetch one published page by slug.
 *
 * Contract, matching the CMS provider exactly:
 *
 *   GET {base}/api/pages
 *     ?where[slug][equals]={slug}
 *     &where[_status][equals]=published
 *     &locale={locale}
 *     &depth=1
 *     &limit=1
 *
 * `depth=1` populates upload and relationship fields one level deep, which is
 * enough for media URLs and for the slug of an internally linked document.
 */
export async function fetchCmsPage(slug: string, locale: PayloadLocale): Promise<CmsPageOutcome> {
	const pageTag = cmsPageTag(slug);
	const collectionTag = cmsCollectionTag("pages");
	if (!pageTag || !collectionTag) {
		return { status: "error", reason: "invalid slug for cache tag" };
	}

	const connection = readCmsConnection();
	if (!connection) {
		logCmsError("not-configured", {
			slug,
			missing: "PAYLOAD_CMS_URL / PAYLOAD_CF_ACCESS_CLIENT_ID / SECRET",
		});
		return { status: "error", reason: "cms not configured" };
	}

	const url = new URL(`${connection.baseUrl}/api/pages`);
	url.searchParams.set("where[slug][equals]", slug);
	url.searchParams.set("where[_status][equals]", "published");
	url.searchParams.set("locale", locale);
	url.searchParams.set("depth", "1");
	url.searchParams.set("limit", "1");

	let response: Response;
	try {
		response = await fetch(url, {
			headers: {
				"CF-Access-Client-Id": connection.accessClientId,
				"CF-Access-Client-Secret": connection.accessClientSecret,
				accept: "application/json",
			},
			// Cloudflare Access refuses with a 302 to an HTML login page — NOT a 401,
			// despite the app's "Return 401" setting (measured: both a missing and a
			// bogus token produce `302 text/html`). Following that redirect would hand
			// us a 200 HTML page to JSON.parse, so redirects are never followed and any
			// 3xx is an upstream fault.
			redirect: "manual",
			signal: AbortSignal.timeout(connection.timeoutMs),
			next: { tags: [pageTag, collectionTag], revalidate: FALLBACK_REVALIDATE_SECONDS },
		});
	} catch (error) {
		const timedOut = error instanceof Error && error.name === "TimeoutError";
		const reason = timedOut ? `timeout after ${connection.timeoutMs}ms` : "network error";
		logCmsError("fetch-failed", { slug, locale, reason });
		return { status: "error", reason };
	}

	if (!response.ok) {
		// 302 => Access rejected the token. 401/403 => Access with "Return 401" enabled.
		// 5xx => Payload itself is unwell. All are upstream faults, never "not found".
		logCmsError("upstream-status", { slug, locale, httpStatus: response.status });
		return { status: "error", reason: `upstream HTTP ${response.status}` };
	}

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) {
		logCmsError("upstream-content-type", { slug, locale, contentType });
		return { status: "error", reason: `unexpected content-type ${contentType}` };
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		logCmsError("malformed-json", { slug, locale });
		return { status: "error", reason: "malformed json" };
	}

	const parsed = parsePagesResponse(body);

	if (parsed.status === "invalid") {
		logCmsError("contract-violation", { slug, locale, reason: parsed.reason });
		return { status: "error", reason: parsed.reason };
	}

	if (parsed.status === "empty") {
		return { status: "not-found" };
	}

	return { status: "found", page: parsed.page };
}
