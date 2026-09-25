import "server-only";
import { cookies, draftMode } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { CMS_PREVIEW_COOKIE, isCmsPreviewTokenShape } from "./preview-cookies";

/**
 * Whether this render is a CMS draft preview, and with which token.
 *
 * Both halves are required (`__fixtures__/provider-v3/preview-v1.md`, step 4): Next's Draft
 * Mode — whose cookie Next itself checks against the build's secret preview id — AND the
 * preview cookie holding the token. The token is then resolved by the CMS on every load, so
 * neither cookie alone, nor both together without a token the CMS accepts, shows a draft.
 *
 * `cookies()` is read only once Draft Mode is known to be on. That is load-bearing: without
 * Draft Mode this route prerenders (`draftMode()` answers "off" at build time and marks
 * nothing dynamic), and a `cookies()` call on that path would make every published CMS page
 * a per-request render. With Draft Mode on, Next already renders the request dynamically and
 * serves it `private, no-cache, no-store`, so reading the cookie costs nothing more.
 *
 * Outside a request — a unit test calling a page function directly — Next throws; that
 * counts as "no preview", which is the published path. Next's own control-flow errors are
 * rethrown untouched.
 */
export interface CmsPreviewSession {
	readonly token: string;
}

export async function readCmsPreviewSession(): Promise<CmsPreviewSession | null> {
	try {
		if (!(await draftMode()).isEnabled) return null;
		const token = (await cookies()).get(CMS_PREVIEW_COOKIE)?.value;
		return isCmsPreviewTokenShape(token) ? { token } : null;
	} catch (error) {
		unstable_rethrow(error);
		return null;
	}
}

/**
 * Draft Mode alone, for the document shell: analytics stay off for the whole of a preview
 * session (`preview-v1.md`, „Súkromie a cache“). Same tolerance as above.
 */
export async function isDraftModeEnabled(): Promise<boolean> {
	try {
		return (await draftMode()).isEnabled;
	} catch (error) {
		unstable_rethrow(error);
		return false;
	}
}
