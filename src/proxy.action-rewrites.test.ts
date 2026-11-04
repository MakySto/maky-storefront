import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { prepareDestination } from "next/dist/shared/lib/router/utils/prepare-destination";
import { afterEach, describe, expect, it } from "vitest";
import { CATEGORY_SLUGS, LIVE_CATEGORY_SLUGS_KEY } from "./config/categories";
import { categoryRouteTable } from "./config/category-routes";
import { buildActionRewrites, categoryRootsFor } from "./lib/action-rewrites";
import { CART_SEGMENT_BY_MARKET, CHANNEL_MAP } from "./lib/channel-map";
import { config, proxy } from "./proxy";

/**
 * A server action POST skips `proxy.ts` (its matcher excludes a request with a `Next-Action` header) and is
 * routed by the generated `rewrites()` of `next.config.js` instead. These tests are why that is safe:
 * the proxy and the rewrites are run over the same paths in every market and have to name the same page.
 */

const FILE = join(process.cwd(), "src/lib/action-rewrites.generated.json");

describe("action rewrites file", () => {
	it("is what the builder produces (pnpm generate:action-rewrites)", () => {
		const rules = buildActionRewrites();
		if (process.env.UPDATE_ACTION_REWRITES === "1") {
			writeFileSync(FILE, JSON.stringify(rules, null, "\t") + "\n");
		}
		expect(JSON.parse(readFileSync(FILE, "utf8"))).toEqual(rules);
	});

	it("only ever applies to a request that carries a Next-Action header", () => {
		for (const rule of buildActionRewrites()) {
			expect(rule.has).toEqual([{ type: "header", key: "next-action" }]);
		}
	});
});

/** What Next does with one rewrite: the first rule whose source matches. */
function rewritten(pathname: string): string | null {
	for (const rule of buildActionRewrites()) {
		const params = getPathMatch(rule.source, { removeUnnamedParams: true, strict: true })(pathname);
		if (!params) continue;
		const prepared = prepareDestination({
			appendParamsToQuery: false,
			destination: rule.destination,
			params: params as Record<string, string | string[]>,
			query: {},
		});
		return prepared.parsedDestination.pathname;
	}
	return null;
}

const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));

/** The pathname the proxy rewrites `path` to, or null when it redirects, 404s or passes the request on. */
async function proxied(path: string): Promise<string | null> {
	const res = await proxy(req(path));
	const to = res.headers.get("x-middleware-rewrite");
	if (!to) return null;
	const pathname = new URL(to).pathname;
	return pathname === "/_not-found" ? null : pathname;
}

describe("the rewrites name the page the proxy names", () => {
	const markets = Object.keys(CHANNEL_MAP);

	it("covers the market home, the cart in its own word, and the plain pages", async () => {
		for (const market of markets) {
			const channel = CHANNEL_MAP[market]!.saleorSlug;
			const cart = CART_SEGMENT_BY_MARKET[market]!;
			const paths = [
				`/${market}`,
				`/${market}/${cart}`,
				`/${market}/znacky`,
				`/${market}/znacky/thule`,
				`/${market}/account`,
			];
			for (const path of paths) {
				const expected = await proxied(path);
				expect(expected, path).not.toBeNull();
				expect(rewritten(path), path).toBe(expected);
			}
			// The cart really is the shared internal route, whatever the public word.
			expect(rewritten(`/${market}/${cart}`)).toBe(`/${channel}/cart`);
		}
	});

	// The rewrites are a fixed table; the proxy also learns category slugs from Saleor while it runs
	// (`isCategorySlug`). A slug that Saleor has not published yet - the renamed Kargo root - is a plain page to
	// the proxy and a category root to the table, which is harmless: no page is served at that address yet.
	// Here Saleor "has published" every root, so that the two can be compared on all of them.
	const live = globalThis as typeof globalThis & { [LIVE_CATEGORY_SLUGS_KEY]?: ReadonlySet<string> };
	afterEach(() => {
		delete live[LIVE_CATEGORY_SLUGS_KEY];
	});

	it("covers every category root of every market, and the pages below it", async () => {
		live[LIVE_CATEGORY_SLUGS_KEY] = new Set(markets.flatMap((m) => categoryRootsFor(m)));
		let compared = 0;
		const redirected: string[] = [];
		for (const market of markets) {
			for (const root of categoryRootsFor(market)) {
				for (const path of [
					`/${market}/${root}`,
					`/${market}/${root}/bmw`,
					`/${market}/${root}/bmw/x5/g05`,
				]) {
					const expected = await proxied(path);
					// The proxy answers some category addresses with a redirect (a retired or borrowed route of
					// that market). A redirect is a page-load decision: no page is shown at that address, so no
					// action is ever sent from it. Everything it does rewrite has to be rewritten the same way.
					if (expected === null) {
						redirected.push(path);
						continue;
					}
					expect(expected, path).toMatch(
						new RegExp(`^/${CHANNEL_MAP[market]!.saleorSlug}/categories/${root}(/|$)`),
					);
					expect(rewritten(path), path).toBe(expected);
					compared++;
				}
			}
		}
		expect(compared).toBeGreaterThan(markets.length * 30);
		expect(redirected.length).toBeLessThan(compared / 4);
	});

	it("knows the roots the proxy knows: every base slug and every localized segment", () => {
		for (const market of markets) {
			const roots = new Set(categoryRootsFor(market));
			for (const slug of CATEGORY_SLUGS) expect(roots.has(slug), `${market}/${slug}`).toBe(true);
			for (const row of categoryRouteTable().filter((r) => r.market === market)) {
				expect(roots.has(row.segment), row.path).toBe(true);
			}
		}
	});

	it("leaves a root of another market's language to the plain rule, as the proxy does", async () => {
		// `/cz/dachtraeger` is not a category in Czechia: the proxy serves it as a plain page and so do the rewrites.
		const path = "/cz/dachtraeger";
		expect(await proxied(path)).toBe("/cz-czk/dachtraeger");
		expect(rewritten(path)).toBe("/cz-czk/dachtraeger");
	});

	it("does not touch anything outside a market: checkout, API and Next's own paths", () => {
		for (const path of [
			"/",
			"/checkout",
			"/checkout/complete",
			"/api/revalidate",
			"/_next/static/x.js",
			"/sk-eur/cart",
		]) {
			expect(rewritten(path), path).toBeNull();
		}
	});
});

describe("the proxy matcher", () => {
	const [entry] = config.matcher as unknown as Array<{
		source: string;
		missing: Array<{ type: string; key: string }>;
	}>;

	it("skips a request that carries a Next-Action header, and only that", () => {
		expect(config.matcher).toHaveLength(1);
		expect(entry.missing).toEqual([{ type: "header", key: "next-action" }]);
	});

	it("still matches every page path it matched before", () => {
		const source = new RegExp(`^${entry.source}$`);
		for (const path of [
			"/",
			"/sk",
			"/sk/kosik",
			"/checkout",
			"/checkout/complete",
			"/admin.php",
			"/logo.svg",
		]) {
			expect(source.test(path), path).toBe(true);
		}
		for (const path of ["/api/revalidate", "/_next/static/x.js"]) {
			expect(source.test(path), path).toBe(false);
		}
	});
});
