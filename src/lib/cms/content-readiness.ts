import type { CmsBlock } from "./blocks";
import { nodeChildren, nodeText, type LexicalDocument } from "./lexical";

/**
 * Whether a published document actually carries a body for THIS market.
 *
 * `parsePagesResponse` filters `layout[]` by market and then reports `ok` whatever is
 * left — including nothing. `fetchCmsPage` translates that to `found`, and the route
 * rendered a page consisting of an `<h1>` and the company block: a finished-looking
 * page with no content, a valid navigation target, a sitemap entry and an hreflang
 * alternate. P's provider contract calls that state `content-not-ready` and says it
 * must not be any of those things.
 *
 * It is reachable exactly when a document is allowed in a market at page level but its
 * only body block is scoped to another market — which is the normal shape of the two
 * shared-locale pairs. DE and AT both read Payload locale `de`, so a document carrying
 * only the Austrian paragraph answers a German request with a page-level "yes" and no
 * German text. Same for US/CA on `en`. P supplies four synthetic fixtures for exactly
 * these four cases.
 *
 * ## Why this is per route and not in the parser
 *
 * An empty filtered layout is not wrong in general — only wrong against a contract
 * that promised a body. `o-nas` has such a contract; nothing else here does yet.
 * Putting the rule in `parsePagesResponse` would impose it on every CMS page that
 * exists or ever will, which is a bigger claim than the evidence supports.
 */

/**
 * Slugs whose provider contract requires a market-specific body.
 *
 * `poradna` is deliberately absent. It shares this factory with `o-nas`, and opening
 * one must not quietly change the other — the same reason its market list is separate.
 * It gains an entry when its own contract states one.
 */
const REQUIRES_MARKET_BODY: ReadonlySet<string> = new Set(["o-nas"]);

export function requiresMarketBody(slug: string): boolean {
	return REQUIRES_MARKET_BODY.has(slug);
}

/** Any non-whitespace text anywhere in a Lexical document. */
function hasText(document: LexicalDocument): boolean {
	const walk = (node: Parameters<typeof nodeChildren>[0]): boolean => {
		if (nodeText(node).trim().length > 0) return true;
		return nodeChildren(node).some(walk);
	};
	return walk(document.root);
}

/**
 * A supported `richText` block with a non-empty body survived the market filter.
 *
 * `richText` specifically, per the contract — a page whose only surviving block is an
 * image or a CTA has chrome, not a body.
 */
export function hasMarketBody(layout: readonly CmsBlock[]): boolean {
	return layout.some((block) => block.blockType === "richText" && hasText(block.content));
}

/**
 * Whether a `found` document is actually ready to serve for this slug.
 *
 * Routes with no body contract are always ready; there is nothing to be unready about.
 */
export function isContentReady(slug: string, layout: readonly CmsBlock[]): boolean {
	return !requiresMarketBody(slug) || hasMarketBody(layout);
}
