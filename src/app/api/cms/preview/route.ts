import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { CHANNEL_MAP, marketHref } from "@/lib/channel-map";
import { isPreviewTokenRefusal, resolveCmsPreview } from "@/lib/cms/client";
import { friendlyMarketFor } from "@/lib/cms/markets";
import {
	CMS_PREVIEW_COOKIE,
	CMS_PREVIEW_MAX_AGE_SECONDS,
	cmsPreviewCookieOptions,
	isCmsPreviewTokenShape,
} from "@/lib/cms/preview-cookies";
import { CMS_PREVIEW_RESPONSE_HEADERS, cmsPreviewFailureResponse } from "@/lib/cms/preview-response";

/**
 * `POST /api/cms/preview` — where the CMS's "Náhľad" button lands
 * (`__fixtures__/provider-v3/preview-v1.md`, step 3).
 *
 * The CMS answers the editor with a page that auto-submits a form here, so the token travels
 * in a POST body and never in a URL, an access log, analytics or a `Referer`. This handler:
 *
 *   1. reads `token` from the form (or from a JSON body), and nothing from inside it — the
 *      token is opaque to the storefront;
 *   2. asks the CMS to resolve it (`resolveCmsPreview`: Cloudflare Access + the
 *      `preview-reader` API key, `no-store`);
 *   3. on success turns on Next's Draft Mode, stores the token in the HttpOnly
 *      `maky-cms-preview` cookie for exactly as long as the token lives, and answers `303`
 *      to the previewed page in its market, e.g. `/cz/o-nas`;
 *   4. on any failure answers a small Slovak page with `noindex` and `no-store`, sets no
 *      cookie and redirects nowhere.
 *
 * The token is never logged and never echoed. Only POST is exported, so every other method
 * is a 405 from Next itself.
 */

/** A form with one token in it is a few kilobytes at most. */
const MAX_BODY_BYTES = 16 * 1024;

/** Payload slugs are `[a-z0-9-]`; the redirect is only built from one. */
const PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function readToken(request: NextRequest): Promise<string | null> {
	const length = Number(request.headers.get("content-length") ?? "0");
	if (Number.isFinite(length) && length > MAX_BODY_BYTES) return null;

	const contentType = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
	try {
		if (contentType === "application/x-www-form-urlencoded") {
			const token = new URLSearchParams(await request.text()).get("token");
			return isCmsPreviewTokenShape(token) ? token : null;
		}
		if (contentType === "application/json") {
			const body: unknown = await request.json();
			const token =
				typeof body === "object" && body !== null && !Array.isArray(body)
					? (body as Record<string, unknown>).token
					: null;
			return isCmsPreviewTokenShape(token) ? token : null;
		}
	} catch {
		return null;
	}
	return null;
}

function refuse(reason: string, failure: "invalid" | "not-configured", status: number): Response {
	console.warn("[cms-preview] refused", JSON.stringify({ reason, status }));
	return cmsPreviewFailureResponse(failure, status);
}

export async function POST(request: NextRequest): Promise<Response> {
	const token = await readToken(request);
	if (!token) return refuse("missing or malformed token", "invalid", 400);

	const outcome = await resolveCmsPreview(token);
	switch (outcome.status) {
		case "not-configured":
			return refuse("preview not configured on the storefront", "not-configured", 503);
		case "rejected":
			// A refused token is the editor's to re-open; a refused identity is configuration.
			return isPreviewTokenRefusal(outcome)
				? refuse(`resolve refused (${outcome.code ?? outcome.httpStatus})`, "invalid", outcome.httpStatus)
				: refuse(`resolve refused (${outcome.code ?? outcome.httpStatus})`, "not-configured", 503);
		case "error":
			return refuse(`resolve failed: ${outcome.reason}`, "invalid", 502);
	}

	const { preview } = outcome;
	const secondsLeft = Math.floor((Date.parse(preview.expiresAt) - Date.now()) / 1000);
	if (!(secondsLeft > 0)) return refuse("token already expired", "invalid", 401);

	const friendly = friendlyMarketFor(preview.market);
	const channel = friendly ? CHANNEL_MAP[friendly]?.saleorSlug : undefined;
	if (!channel || !PAGE_SLUG.test(preview.slug))
		return refuse("no storefront route for the target", "invalid", 400);

	(await draftMode()).enable();

	// Relative, so the answer never depends on which Host a proxy in front of Next forwarded.
	const response = new NextResponse(null, {
		status: 303,
		headers: { location: marketHref(channel, `/${preview.slug}`), ...CMS_PREVIEW_RESPONSE_HEADERS },
	});
	response.cookies.set(
		CMS_PREVIEW_COOKIE,
		token,
		cmsPreviewCookieOptions(Math.min(secondsLeft, CMS_PREVIEW_MAX_AGE_SECONDS)),
	);

	console.log(
		"[cms-preview] started",
		JSON.stringify({
			documentId: preview.id,
			versionId: preview.versionId,
			market: preview.market,
			slug: preview.slug,
		}),
	);
	return response;
}
