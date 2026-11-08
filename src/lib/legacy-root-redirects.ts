/**
 * Old root-level addresses of the shop this domain was before the storefront (WooCommerce, products at
 * the root: `maky.store/<slug>`), and the one current page each of them lives at now.
 *
 * The registry that docs/design/seo-hard-404-analysis-20260806.md (C5) described as "ships EMPTY, the
 * architecture only". It stayed empty, and on 2026-11-07 Bing Webmaster Tools still listed old products
 * among the indexed pages while the address answered 404: the root gate in `src/proxy.ts` ("an unknown
 * first segment is a 404") is right and stays, and a page that moved needs its own explicit exit in
 * front of it.
 *
 * ## What an entry is, and what it is not
 *
 * - An EXACT address, spelled without the leading slash, and ONE target: the current canonical page of
 *   the same product, written as it is served (`/sk/<slug>`), so a visitor goes through one hop and
 *   never through a chain. A test refuses a target that is itself a source.
 * - Only products whose identity is established: the same manufacturer article number, EAN or SKU on
 *   both sides. A look-alike is not an entry. The old Spinder TX2 `S30005` has no entry because the
 *   catalogue holds an `S30011` (a different code, so a different product) and nothing says they are
 *   the same.
 * - There is NO rule here that turns an unknown address into a redirect: not "every unknown slug goes
 *   to /sk", not "every old product goes to the home page". That is the generator the root gate was
 *   written to close (/pilcicke-nohavice-… and its siblings stay 404 on purpose).
 *
 * ## Where it runs
 *
 * `src/proxy.ts`, immediately in front of the invalid-first-segment 404 and nowhere else, so an entry
 * can never take over a market, a category, a reserved prefix or a file the site serves: those are all
 * decided before a request reaches it. The redirect is permanent (301) and keeps the query string, as
 * the other product redirects do.
 *
 * ## Adding one
 *
 * 1. Take the address from Bing Webmaster Tools (Site Explorer → indexed or excluded → export) or from
 *    Search Console, not from memory.
 * 2. Find the current product by article number / EAN / SKU, never by name alone, and open it: 200, its
 *    own canonical.
 * 3. Add the line and say in the comment how the identity was established.
 *
 * No `server-only` and no I/O: the proxy imports this, and the proxy runs before every request.
 */
export const LEGACY_ROOT_REDIRECTS: Readonly<Record<string, string>> = {
	// Listed by Bing Webmaster Tools among the indexed pages on 2026-11-07. The Thule article number
	// 978100 is the end of the old slug and the SKU (TH978100) of the current product.
	"nosic-bicyklov-thule-epos-2-978100": "/sk/nosic-bicyklov-thule-epos-2-978-th978100",
};

const TABLE: ReadonlyMap<string, string> = new Map(Object.entries(LEGACY_ROOT_REDIRECTS));

/**
 * The current page for an old root-level address, or `null` when the address is not one of them.
 *
 * `pathname` is the request path as the proxy has it. A trailing slash, capitals and a percent-encoded
 * spelling are the same address as far as the old shop was concerned, so they are the same here; the
 * rest is exact. A path that cannot be decoded is not an entry.
 */
export function legacyRootRedirectTarget(pathname: string): string | null {
	let key = pathname.replace(/^\/+|\/+$/g, "");
	if (!key) return null;
	try {
		key = decodeURIComponent(key);
	} catch {
		return null;
	}
	return TABLE.get(key.toLowerCase()) ?? null;
}
