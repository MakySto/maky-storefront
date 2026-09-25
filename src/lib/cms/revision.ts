import { type CmsPage } from "./page-schema";

/**
 * The revision marker every page rendered from a CMS document carries in its `<head>`
 * (pages contract v3 §3, `__fixtures__/provider-v3/pages-content.md`):
 *
 *     <meta name="maky-cms-revision" content="pages:<document id>@<updatedAt>">
 *
 * The CMS reads it back after a publish to confirm that the public page shows the new
 * version, or no version at all after an unpublish (`revalidation-event-v2.md`). It carries
 * nothing secret: an id and a timestamp the CMS already has.
 *
 * Only a document that was actually rendered gets one. A bootstrap, a "temporarily
 * unavailable" page and a 404 have none — which is exactly what lets the CMS tell an
 * absent document from a stale one.
 */
export const CMS_REVISION_META_NAME = "maky-cms-revision";

/** Next's `Metadata.other` entry, or `undefined` when the document has no `updatedAt`. */
export function cmsRevisionMetadata(
	page: Pick<CmsPage, "id" | "updatedAt">,
): Record<typeof CMS_REVISION_META_NAME, string> | undefined {
	if (!page.updatedAt) return undefined;
	return { [CMS_REVISION_META_NAME]: `pages:${page.id}@${page.updatedAt}` };
}
