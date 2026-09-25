/**
 * The two cookies a CMS draft preview runs on (`__fixtures__/provider-v3/preview-v1.md`), and
 * the response headers that keep a preview out of every cache and every index.
 *
 * No `server-only` here on purpose: the proxy reads these names too, and it runs before any
 * page. Nothing in this file is secret — the token's VALUE lives only in the cookie, set by
 * `/api/cms/preview`, and is never read by anything but the server.
 */

/** The signed preview token from the CMS, opaque to the storefront. HttpOnly. */
export const CMS_PREVIEW_COOKIE = "maky-cms-preview";

/**
 * Next's own Draft Mode cookie (`draftMode().enable()`), named here only so the proxy can see
 * that one is present. Next alone decides whether its value is genuine, by comparing it to the
 * build's preview id — a forged one never turns Draft Mode on. Pinned against Next's constant
 * in the tests.
 */
export const NEXT_DRAFT_MODE_COOKIE = "__prerender_bypass";

/** A preview is never indexed and never followed… */
export const CMS_PREVIEW_ROBOTS_HEADER = "noindex, nofollow";
/** …and never stored by a browser or a shared cache. */
export const CMS_PREVIEW_CACHE_CONTROL = "private, no-store";

/** The CMS issues tokens for at most thirty minutes (`manifest.json`: `tokenTtlSeconds`). */
export const CMS_PREVIEW_MAX_AGE_SECONDS = 30 * 60;

/**
 * Whether a request carries BOTH cookies. Presence only — this is the proxy's cheap
 * pre-check for letting a CMS route through; the page itself still requires Draft Mode to be
 * genuinely on and the CMS to accept the token on every load.
 */
export function hasCmsPreviewCookies(cookies: { get(name: string): { value: string } | undefined }): boolean {
	return Boolean(cookies.get(NEXT_DRAFT_MODE_COOKIE)?.value && cookies.get(CMS_PREVIEW_COOKIE)?.value);
}

/**
 * The shape a token must have before it is stored or forwarded. The storefront reads nothing
 * FROM the token; this only bounds what may be put into a cookie and a request body: the
 * base64url alphabet and its `.` separator, and a sane length.
 */
export function isCmsPreviewTokenShape(value: unknown): value is string {
	return typeof value === "string" && /^[A-Za-z0-9_.~+/=-]{16,4096}$/.test(value);
}

/** Attributes of the preview cookie; `maxAge: 0` deletes it. */
export function cmsPreviewCookieOptions(maxAge: number) {
	return { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge } as const;
}
