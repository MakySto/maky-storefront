import { draftMode } from "next/headers";
import { connection, NextResponse, type NextRequest } from "next/server";
import { CMS_PREVIEW_COOKIE, cmsPreviewCookieOptions } from "@/lib/cms/preview-cookies";
import { CMS_PREVIEW_RESPONSE_HEADERS, safePreviewReturnPath } from "@/lib/cms/preview-response";

/**
 * `GET /api/cms/preview/exit?path=/cz/o-nas` — "Ukončiť náhľad"
 * (`__fixtures__/provider-v3/preview-v1.md`, step 5).
 *
 * Turns Draft Mode off, deletes the preview cookie and sends the editor back to the same page
 * without the preview. `path` must be a same-origin, root-relative path; anything else goes
 * to `/`, so this can never be used as an open redirect.
 *
 * GET because it is reached from a plain link on the preview banner. The banner uses an
 * `<a>`, never a prefetching `<Link>`, so nothing leaves the preview by accident.
 *
 * `await connection()` first, and it is load-bearing: under Cache Components a GET handler is
 * prerendered at build time unless it stops at request data, and switching Draft Mode off
 * inside a prerender is an error ("used draftMode().disable() without first calling
 * `await connection()`"). This makes the handler request-time only, as it must be.
 */
export async function GET(request: NextRequest): Promise<Response> {
	await connection();
	(await draftMode()).disable();

	const response = new NextResponse(null, {
		status: 303,
		headers: {
			location: safePreviewReturnPath(request.nextUrl.searchParams.get("path")),
			...CMS_PREVIEW_RESPONSE_HEADERS,
		},
	});
	response.cookies.set(CMS_PREVIEW_COOKIE, "", cmsPreviewCookieOptions(0));
	return response;
}
