import { CATEGORY_ROUTE_PREFIX, CATEGORY_SLUGS } from "@/config/categories";
import { categoryRouteTable } from "@/config/category-routes";

import { CART_SEGMENT_BY_MARKET, CHANNEL_MAP } from "./channel-map";

/**
 * Where a server action goes when it does not pass through `proxy.ts`.
 *
 * A server action POST is not routed by the proxy (its matcher skips every request that carries a
 * `Next-Action` header, see `proxy.ts`): Next clones the body of a request the proxy matches, and that
 * clone loses the first action of a freshly started process under load ("Unexpected end of form",
 * a 500 on add to cart, 8 of 8 runs on the control build; 0 of 3 once the proxy was skipped).
 *
 * What the proxy would have done for such a request is only a URL rewrite - market prefix to Saleor
 * channel, the localized cart word to `cart`, a category root to `categories/<root>` - and that is
 * written down here as Next `rewrites()`, which run after the middleware step and need no body clone.
 * Everything else the proxy does (redirects, the existence gate, cookies, response headers) belongs to
 * a page load and is not wanted on an action. The two request headers that the rendering reads from the
 * proxy (`x-locale`, `x-market`) are recovered in `config/locale.server.ts` instead.
 *
 * `proxy.action-rewrites.test.ts` runs the proxy and these rules over every market and proves that they
 * name the same destination. `next.config.js` cannot import TypeScript, so the rules are committed as
 * `action-rewrites.generated.json`; the same test fails when that file drifts from this builder
 * (`pnpm generate:action-rewrites`).
 */
export interface ActionRewrite {
	source: string;
	has: [{ type: "header"; key: "next-action"; value: string }];
	destination: string;
}

/**
 * The `value` is not decoration. A `has` header condition without one makes Next capture the header's value as a
 * rewrite parameter (`nextaction`), and a parameter the destination does not use is appended to its query string:
 * the page rendered after an action would see `?nextaction=<action id>` in its `searchParams`, and a listing
 * that rebuilds its links from them would carry it into pagination and filters. With a value that has no named
 * group, the condition is still "an action header is present" and nothing is captured
 * (`proxy.action-rewrites.test.ts` reads the query Next would hand to the page).
 */
const HAS_ACTION: ActionRewrite["has"] = [{ type: "header", key: "next-action", value: ".+" }];

/** The category root spellings a market serves under its own prefix: the base slugs and its localized ones. */
export function categoryRootsFor(market: string): string[] {
	const roots = new Set<string>(CATEGORY_SLUGS);
	for (const row of categoryRouteTable()) {
		if (row.market === market) roots.add(row.segment);
	}
	return [...roots].sort();
}

export function buildActionRewrites(): ActionRewrite[] {
	const rules: ActionRewrite[] = [];
	for (const [market, config] of Object.entries(CHANNEL_MAP)) {
		const channel = config.saleorSlug;
		const cart = CART_SEGMENT_BY_MARKET[market] ?? "cart";

		// `/de/warenkorb` -> `/de-eur/cart`. Exactly two segments, as in the proxy; a market whose public
		// word is already `cart` needs no rule of its own.
		if (cart !== "cart") {
			rules.push({ source: `/${market}/${cart}`, has: HAS_ACTION, destination: `/${channel}/cart` });
		}

		// `/de/dachtraeger/...` -> `/de-eur/categories/dachtraeger/...`. The root keeps its own spelling.
		rules.push({
			source: `/${market}/:root(${categoryRootsFor(market).join("|")})/:rest*`,
			has: HAS_ACTION,
			destination: `/${channel}/${CATEGORY_ROUTE_PREFIX}/:root/:rest*`,
		});

		// Everything else below the market is served by the channel's own tree.
		rules.push({ source: `/${market}/:path*`, has: HAS_ACTION, destination: `/${channel}/:path*` });
	}
	return rules;
}
