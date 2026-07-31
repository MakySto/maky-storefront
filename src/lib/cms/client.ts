import "server-only";
import { cmsCollectionTag, cmsPageTag } from "./cache-tags";
import { readCmsConnection } from "./env";
import { type MarketCode, type PayloadLocale } from "./markets";
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
	/** A published candidate exists, but the requested market is authoritatively excluded. */
	| { readonly status: "market-mismatch"; readonly documentId: string; readonly markets: readonly string[] }
	/** Upstream fault or contract break. Render the code fallback. */
	| { readonly status: "error"; readonly reason: string };

function logCmsError(event: string, detail: Record<string, unknown>): void {
	// Structured single line, no secrets — only status codes, slugs and reasons.
	console.error(`[cms] ${event}`, JSON.stringify(detail));
}

/**
 * Confirmation that a document really came from the CMS.
 *
 * This exists because of a property of the pilot that is easy to miss: once the
 * duplicate company paragraph is removed from Payload, the four remaining paragraphs
 * of `o-nas` are character-for-character identical to `o-nas-static.tsx`. Verified
 * against the live document, not assumed. So the CMS path and the bootstrap path
 * render byte-identical HTML, and a silent fallback — a rotated Cloudflare service
 * token, `PAYLOAD_*` missing from the process environment, Payload down — would look
 * exactly like success. Possibly for months.
 *
 * Errors were already logged; success was not, so there was no positive signal to
 * grep for. `updatedAt` is the useful part: it says WHICH revision is live, which
 * turns "did my edit land?" into a fact instead of an eyeball comparison.
 *
 *   pm2 logs maky-storefront --nostream | grep '\[cms\]'
 *
 * ## What this line does NOT mean
 *
 * It is a **consumer-read** log, not an origin-fetch counter. It runs after every
 * `fetchCmsPage()` call, whether Next's patched `fetch` went to the network or answered
 * from the Data Cache — and the route calls `fetchCmsPage()` twice per request, once from
 * `generateMetadata` and once from the page component. So **two lines per HTTP request is
 * the healthy steady state**, not evidence of two round trips.
 *
 * This was got wrong once, on the cutover day: the doubled lines were read as "the page is
 * not cached at all", which is a conclusion this log is structurally incapable of
 * supporting. Measuring it properly means counting arrivals at the other end. Done at the
 * deployed SHA against a mock Payload with a request counter: five page requests produced
 * ten of these lines and **zero** origin requests. The cache works.
 */
function logCmsServed(detail: Record<string, unknown>): void {
	console.log("[cms] served", JSON.stringify(detail));
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
 *     &fallback-locale=none
 *     &depth=1
 *     &limit=1
 *
 * `depth=1` populates upload and relationship fields one level deep, which is
 * enough for media URLs and for the slug of an internally linked document.
 */
export async function fetchCmsPage(
	slug: string,
	locale: PayloadLocale,
	market?: MarketCode,
): Promise<CmsPageOutcome> {
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
	// Without this Payload falls back to another locale when the requested one has no
	// translation, so a market with no Slovak copy would quietly be served someone else's
	// language instead of an authoritative "not here". Invisible on the SK-only pilot,
	// which is exactly why it survived to here; the v2 contract names it in the canonical
	// request and M.2's whole point is proving the reader is not hard-wired to one page.
	url.searchParams.set("fallback-locale", "none");
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

	const parsed = parsePagesResponse(body, market);

	if (parsed.status === "invalid") {
		// One line, carrying everything needed to find the offending document in Payload:
		// its id and slug, plus the block or node type that made it unrenderable.
		const { reason, documentId, blockType, nodeType } = parsed.violation;
		logCmsError("contract-violation", {
			slug,
			locale,
			reason,
			documentId,
			documentSlug: parsed.violation.slug,
			blockType,
			nodeType,
		});
		return { status: "error", reason };
	}

	if (parsed.status === "empty") {
		logCmsServed({ slug, locale, outcome: "not-found" });
		return { status: "not-found" };
	}

	const parsedSlug = parsed.status === "ok" ? parsed.page.slug : parsed.slug;
	const parsedDocumentId = parsed.status === "ok" ? parsed.page.id : parsed.documentId;
	if (parsedSlug !== slug) {
		logCmsError("contract-violation", {
			slug,
			locale,
			reason: "response carried a different slug than the one requested",
			documentId: parsedDocumentId,
			documentSlug: parsedSlug,
			blockType: null,
			nodeType: null,
		});
		return { status: "error", reason: `slug mismatch: asked for ${slug}, got ${parsedSlug}` };
	}

	if (parsed.status === "market-mismatch") {
		logCmsServed({
			slug,
			locale,
			market,
			outcome: "market-mismatch",
			documentId: parsed.documentId,
			markets: parsed.markets,
		});
		return {
			status: "market-mismatch",
			documentId: parsed.documentId,
			markets: parsed.markets,
		};
	}

	logCmsServed({
		slug,
		locale,
		outcome: "found",
		documentId: parsed.page.id,
		updatedAt: parsed.page.updatedAt,
		blocks: parsed.page.layout.length,
	});

	return { status: "found", page: parsed.page };
}
