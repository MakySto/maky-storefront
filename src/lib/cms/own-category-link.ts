import { CATEGORY_ROUTE_PREFIX } from "@/config/categories";
import { categoryBaseSlug, categoryRootServes, categorySegment } from "@/config/category-routes";
import { FRIENDLY_SLUGS } from "@/lib/channel-map";
import { getBaseUrl } from "@/lib/seo/config";

/**
 * The address a CMS link to one of this shop's own categories carries (owner, 2026-11-15: no category address with
 * `/categories/` anywhere).
 *
 * A CMS link has to be absolute, since a relative one renders as its words (`CmsLink`, `renderLinkNode`), so an editor
 * who links a category of the shop writes the whole address in the form the category had when they wrote it. The
 * advice guide's "Vybrať strešný nosič" button was `https://maky.store/sk/categories/stresne-nosice`: it worked, the
 * retired form answers a permanent redirect (`proxy.ts`), and it still showed the retired segment in every page that
 * carried it. The link is rewritten where it is rendered, so no edit in the CMS is needed and none that comes later is
 * missed.
 *
 * Only a link to this shop's own origin in exactly the retired shape, `/{market}/categories/{slug}`, is touched, and
 * only where the root serves the category: the proxy's own condition for the redirect, so a link never points at a
 * root that answers "not found". Anything else, another site included, is returned as it came. Query and fragment stay.
 */
export function canonicalOwnCategoryHref(url: string, siteUrl: string = getBaseUrl()): string {
	let target: URL;
	try {
		target = new URL(url);
		if (target.origin !== new URL(siteUrl).origin) return url;
	} catch {
		return url;
	}

	const [market, prefix, slug, ...below] = target.pathname.split("/").filter(Boolean);
	if (
		!market ||
		!FRIENDLY_SLUGS.has(market) ||
		prefix !== CATEGORY_ROUTE_PREFIX ||
		!slug ||
		below.length > 0
	) {
		return url;
	}
	const base = categoryBaseSlug(market, slug);
	if (!categoryRootServes(market, base)) return url;

	target.pathname = `/${market}/${categorySegment(market, base)}`;
	return target.toString();
}
