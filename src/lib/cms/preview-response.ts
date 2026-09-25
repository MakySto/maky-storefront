import { CMS_PREVIEW_CACHE_CONTROL, CMS_PREVIEW_ROBOTS_HEADER } from "./preview-cookies";
import { CMS_PREVIEW_COPY } from "./preview-copy";

/**
 * Headers every response of the preview endpoints carries (`preview-v1.md`): never cached,
 * never indexed, and no `Referer` onwards.
 */
export const CMS_PREVIEW_RESPONSE_HEADERS = {
	"cache-control": CMS_PREVIEW_CACHE_CONTROL,
	"x-robots-tag": CMS_PREVIEW_ROBOTS_HEADER,
	"referrer-policy": "no-referrer",
} as const;

export type CmsPreviewFailure = "invalid" | "not-configured";

/**
 * The small page `/api/cms/preview` answers with when a preview cannot start: no redirect,
 * no cookie, no layout, no analytics. Nothing from the request is echoed into it — least of
 * all the token.
 */
export function cmsPreviewFailureResponse(failure: CmsPreviewFailure, status: number): Response {
	const message = failure === "not-configured" ? CMS_PREVIEW_COPY.notConfigured : CMS_PREVIEW_COPY.invalid;
	const html = `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${CMS_PREVIEW_COPY.title} — MAKY.STORE</title>
</head>
<body style="font-family: system-ui, sans-serif; max-width: 36rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.5">
<h1 style="font-size: 1.25rem">${message}</h1>
<p>${CMS_PREVIEW_COPY.reopen}</p>
</body>
</html>
`;
	return new Response(html, {
		status,
		headers: { "content-type": "text/html; charset=utf-8", ...CMS_PREVIEW_RESPONSE_HEADERS },
	});
}

/**
 * Where "Ukončiť náhľad" goes back to: a path on this site, or `/`.
 *
 * Only a same-origin, root-relative path is accepted — no scheme, no host, no `//` or `/\`
 * that a browser would read as another host, no control characters. Anything else is `/`,
 * so the exit link can never be turned into an open redirect.
 */
export function safePreviewReturnPath(raw: string | null): string {
	if (!raw || raw.length > 2048 || !raw.startsWith("/") || /^\/[/\\]/.test(raw)) return "/";
	if (/[\\\u0000-\u001f\u007f]/.test(raw)) return "/";
	const base = "https://storefront.invalid";
	try {
		const url = new URL(raw, base);
		return url.origin === base ? `${url.pathname}${url.search}` : "/";
	} catch {
		return "/";
	}
}
