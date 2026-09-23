/**
 * The fallback for a page that cannot render anything before it has request-time data —
 * the withdrawal form, the Saleor pages and the vehicle pages.
 *
 * It draws nothing and holds one screen of height, and that is its whole job. The footer
 * is in the static shell; with a fallback of `null` it sat directly under the header in
 * the first frame, and the page then pushed it off-screen — a layout shift the size of
 * the footer (see `app/[channel]/(main)/layout.tsx`). A screen of height keeps it below
 * the fold, so arriving content moves nothing the visitor can see.
 */
export function RouteLoading() {
	return <div aria-hidden="true" className="min-h-dvh" />;
}
