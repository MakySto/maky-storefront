import "server-only";
import { cmsCollectionTag, cmsPageTag } from "./cache-tags";
import { readCmsConnection, readCmsPreviewApiKey, type CmsConnection } from "./env";
import {
	isMarketCode,
	isPayloadLocale,
	payloadLocaleForMarket,
	type MarketCode,
	type PayloadLocale,
} from "./markets";
import { parsePagesResponse, type CmsPage, type CmsParseWarning } from "./page-schema";

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
 * No Payload `Authorization` header is sent on a published read. Adding one would
 * escalate this reader from "anonymous, published-only" to whatever that credential can
 * see, which is exactly the blast radius we do not want behind a public route.
 *
 * The one exception is `resolveCmsPreview`, and it is built to stay one: a different
 * endpoint (`POST /api/pages/preview-resolve`), a different, narrow credential (the
 * `preview-reader` machine identity, `PAYLOAD_PREVIEW_API_KEY`) that can do nothing but
 * resolve a token the CMS itself signed, and no cache of any kind. Its answer only ever
 * reaches a draft-mode render.
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

/** The Cloudflare Access service token: it opens the network boundary and grants nothing. */
function accessHeaders(connection: CmsConnection): Record<string, string> {
	return {
		"CF-Access-Client-Id": connection.accessClientId,
		"CF-Access-Client-Secret": connection.accessClientSecret,
		accept: "application/json",
	};
}

function logCmsError(event: string, detail: Record<string, unknown>): void {
	// Structured single line, no secrets — only status codes, slugs and reasons.
	console.error(`[cms] ${event}`, JSON.stringify(detail));
}

function logCmsWarning(event: string, detail: Record<string, unknown>): void {
	// Structured single line for accepted content whose optional presentation degraded.
	console.warn(`[cms] ${event}`, JSON.stringify(detail));
}

/** Diagnostics are identifiers from the CMS; bound them so a log line stays a line. */
function clip(value: string | null): string | null {
	return value && value.length > 80 ? `${value.slice(0, 79)}…` : value;
}

/**
 * One line per degradation of an accepted document.
 *
 * A skipped block (pages contract v3 §1) gets its own event name, `[cms] block-skipped`, so
 * "which page is missing a block, and why" is one grep away. It carries the document, the
 * block's index and types and the reason — never the block's content.
 */
function logParseWarnings(
	warnings: readonly CmsParseWarning[],
	context: { slug: string; locale: PayloadLocale; documentId: string },
): void {
	for (const warning of warnings) {
		if (warning.code === "block-skipped") {
			logCmsWarning("block-skipped", {
				documentId: context.documentId,
				slug: context.slug,
				locale: context.locale,
				index: warning.index,
				blockType: clip(warning.blockType),
				nodeType: clip(warning.nodeType),
				reason: warning.reason,
			});
			continue;
		}
		logCmsWarning("content-degraded", { ...context, code: warning.code, reason: warning.reason });
	}
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
			headers: accessHeaders(connection),
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

	logParseWarnings(parsed.warnings, { slug, locale, documentId: parsed.page.id });

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

/**
 * What the CMS signed a preview token for (`preview` in the resolve response). The storefront
 * never reads the token itself; this is the CMS's own account of it.
 */
export interface CmsPreviewTarget {
	readonly collection: "pages";
	readonly id: string;
	readonly versionId: string;
	readonly market: MarketCode;
	readonly locale: PayloadLocale;
	readonly slug: string;
	/** ISO timestamp. The token — and so the preview cookie — ends here. */
	readonly expiresAt: string;
}

/** The draft, as far as this market is concerned. */
export type CmsPreviewContent =
	/** Renderable, parsed by the same parser as a published page. */
	| { readonly kind: "page"; readonly page: CmsPage }
	/** The document's markets exclude the token's market: the published page would 404. */
	| { readonly kind: "not-in-market" }
	/** The draft breaks the page contract; the published page would take its fallback. */
	| { readonly kind: "invalid"; readonly reason: string };

export type CmsPreviewOutcome =
	| { readonly status: "resolved"; readonly preview: CmsPreviewTarget; readonly content: CmsPreviewContent }
	/** No CMS connection or no `PAYLOAD_PREVIEW_API_KEY`: preview is switched off. */
	| { readonly status: "not-configured" }
	/** The CMS refused: an invalid or expired token, an unavailable document, a wrong identity. */
	| { readonly status: "rejected"; readonly httpStatus: number; readonly code: string | null }
	/** Network fault or an answer outside the contract. */
	| { readonly status: "error"; readonly reason: string };

/**
 * Whether a refusal is about the TOKEN — invalid, expired, its document or version gone —
 * which the editor fixes by opening the preview again. Anything else the CMS refuses (no
 * identity, the wrong identity, preview switched off) is configuration, and must say so
 * rather than send the editor round in circles.
 */
export function isPreviewTokenRefusal(refusal: {
	readonly httpStatus: number;
	readonly code: string | null;
}): boolean {
	return refusal.code?.startsWith("PREVIEW_TOKEN_") === true || refusal.httpStatus === 404;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

/** `preview` from the resolve response, or `null` when it is not the contract's shape. */
function readPreviewTarget(value: unknown): CmsPreviewTarget | null {
	if (!isRecord(value) || value.collection !== "pages") return null;
	const id = nonEmptyString(value.id);
	const versionId = nonEmptyString(value.versionId);
	const slug = nonEmptyString(value.slug);
	const expiresAt = nonEmptyString(value.expiresAt);
	const { market, locale } = value;
	if (!id || !versionId || !slug || !expiresAt || Number.isNaN(Date.parse(expiresAt))) return null;
	// The token's language is the market's language (DE/AT → de, US/CA → en); anything else
	// would render one market's draft in another market's words.
	if (!isMarketCode(market) || !isPayloadLocale(locale) || payloadLocaleForMarket(market) !== locale)
		return null;
	return { collection: "pages", id, versionId, market, locale, slug, expiresAt };
}

/** Machine-readable `code` of a refusal (`resolve.errors.json`), bounded for the log. */
async function readRefusalCode(response: Response): Promise<string | null> {
	try {
		const body: unknown = await response.json();
		const code = isRecord(body) ? body.code : null;
		return typeof code === "string" && /^[A-Z0-9_]{1,64}$/.test(code) ? code : null;
	} catch {
		return null;
	}
}

/**
 * Resolve a signed preview token into the exact draft version it names.
 *
 *   POST {base}/api/pages/preview-resolve
 *   CF-Access-Client-Id / -Secret                   the network boundary, as for every read
 *   Authorization: service-accounts API-Key <key>   the `preview-reader` identity
 *   { "token": "…" }
 *
 * `cache: "no-store"` and no `next.tags`/`revalidate`, and it is never called from a
 * `"use cache"` scope: a draft must not reach the Data Cache, where a published render could
 * find it. Redirects are not followed, exactly as for published reads — Cloudflare Access
 * refuses with a 302 to its login page.
 *
 * The token is never logged, and neither is the key. Log lines carry statuses, codes and
 * document ids only.
 */
export async function resolveCmsPreview(token: string): Promise<CmsPreviewOutcome> {
	const connection = readCmsConnection();
	const apiKey = readCmsPreviewApiKey();
	if (!connection || !apiKey) {
		logCmsError("preview-not-configured", {
			missing: [
				...(connection ? [] : ["PAYLOAD_CMS_URL / PAYLOAD_CF_ACCESS_CLIENT_ID / SECRET"]),
				...(apiKey ? [] : ["PAYLOAD_PREVIEW_API_KEY"]),
			],
		});
		return { status: "not-configured" };
	}

	let response: Response;
	try {
		response = await fetch(`${connection.baseUrl}/api/pages/preview-resolve`, {
			method: "POST",
			headers: {
				...accessHeaders(connection),
				authorization: `service-accounts API-Key ${apiKey}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ token }),
			cache: "no-store",
			redirect: "manual",
			signal: AbortSignal.timeout(connection.timeoutMs),
		});
	} catch (error) {
		const timedOut = error instanceof Error && error.name === "TimeoutError";
		const reason = timedOut ? `timeout after ${connection.timeoutMs}ms` : "network error";
		logCmsError("preview-fetch-failed", { reason });
		return { status: "error", reason };
	}

	// 401/403/404 are the CMS's answers about the token, the identity or the document
	// (`resolve.errors.json`); 503 is preview switched off on the CMS side.
	if ([401, 403, 404, 503].includes(response.status)) {
		const code = await readRefusalCode(response);
		logCmsWarning("preview-rejected", { httpStatus: response.status, code });
		return { status: "rejected", httpStatus: response.status, code };
	}

	if (!response.ok) {
		logCmsError("preview-upstream-status", { httpStatus: response.status });
		return { status: "error", reason: `upstream HTTP ${response.status}` };
	}

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) {
		logCmsError("preview-upstream-content-type", { contentType });
		return { status: "error", reason: `unexpected content-type ${contentType}` };
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		logCmsError("preview-malformed-json", {});
		return { status: "error", reason: "malformed json" };
	}

	const preview = isRecord(body) && body.ok === true ? readPreviewTarget(body.preview) : null;
	if (!preview) {
		logCmsError("preview-contract-violation", { reason: "response carried no valid preview target" });
		return { status: "error", reason: "no valid preview target" };
	}

	const detail = {
		documentId: preview.id,
		versionId: preview.versionId,
		market: preview.market,
		slug: preview.slug,
	};
	const parsed = parsePagesResponse(body, preview.market, { allowDraft: true });

	if (parsed.status === "empty") {
		logCmsError("preview-contract-violation", { ...detail, reason: "docs is empty" });
		return { status: "error", reason: "resolve returned no document" };
	}

	// docs[0] must be the document the token names; anything else is not this preview.
	const parsedId =
		parsed.status === "ok" ? parsed.page.id : parsed.status === "market-mismatch" ? parsed.documentId : null;
	const parsedSlug =
		parsed.status === "ok" ? parsed.page.slug : parsed.status === "market-mismatch" ? parsed.slug : null;
	if (parsed.status !== "invalid" && (parsedId !== preview.id || parsedSlug !== preview.slug)) {
		logCmsError("preview-contract-violation", { ...detail, reason: "docs[0] is not the previewed document" });
		return { status: "error", reason: "resolve returned another document" };
	}

	if (parsed.status === "market-mismatch") {
		logCmsServedPreview({ ...detail, outcome: "not-in-market" });
		return { status: "resolved", preview, content: { kind: "not-in-market" } };
	}

	if (parsed.status === "invalid") {
		const { reason, blockType, nodeType } = parsed.violation;
		logCmsError("preview-contract-violation", { ...detail, reason, blockType, nodeType });
		return { status: "resolved", preview, content: { kind: "invalid", reason } };
	}

	logParseWarnings(parsed.warnings, { slug: preview.slug, locale: preview.locale, documentId: preview.id });
	logCmsServedPreview({ ...detail, outcome: "found", updatedAt: parsed.page.updatedAt });
	return { status: "resolved", preview, content: { kind: "page", page: parsed.page } };
}

/** The preview counterpart of `[cms] served`: which draft version an editor was shown. */
function logCmsServedPreview(detail: Record<string, unknown>): void {
	console.log("[cms] preview-served", JSON.stringify(detail));
}
