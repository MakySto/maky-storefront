import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { categorySegment } from "@/config/category-routes";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { proxy } from "@/proxy";
import { catalogLanguageForMarket } from "./language";
import { CATALOG_REDIRECTS, catalogRedirectTarget } from "./redirects";

/**
 * Two vehicle pages that the table once retired and CFM published again on 2026-11-08.
 *
 * `volkswagen/up` (the model page, CFM page 616) was in the twelve of 2026-10-18 and `nissan/navara-pick-up/d40`
 * (the generation page, CFM page 984) in the eight of 2026-10-22. Both were retired in CFM's working state only:
 * the release never carried the retirement, and on 2026-11-08 CFM pointed the pages at the new nodes (model 8290
 * for Up, generation 13792 for Navara D40, which also made `volkswagen/up/aa`) and published them in content
 * release revision 72, with `state` published and `indexable` true.
 *
 * A row in this table wins over everything: the proxy answers a 301 before any page renders, the vehicle route
 * leaves the node out of its tiles, `vehicleHref` gives no link and the sitemap skips it (all four ask
 * `catalogRedirectTarget`). With the two rows still in, the pages answered 301 to the brand and to the model
 * page for as long as the table said so, and Navara and VW showed no D40 or Up tile, although the data was right.
 *
 * What stays retired is the old VW Up! generation page, `volkswagen/up/up` (`redirects.merged-generations.test.ts`).
 * It goes to the brand, as CFM asked; the nearest live address is now the Up model page, a retarget for a later
 * change that CFM can ask for.
 */
const LIVE = ["volkswagen/up", "nissan/navara-pick-up/d40"] as const;
const NEW_BELOW_UP = "volkswagen/up/aa";
const STILL_RETIRED = ["volkswagen/up/up", "volkswagen"] as const;

const MARKETS = Object.keys(CHANNEL_MAP).filter((market) => catalogLanguageForMarket(market));

const category = (market: string) => categorySegment(market, "stresne-nosice");
const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));

describe("the republished VW Up and Navara D40 pages", () => {
	it("are in the table in no language, under any category spelling the table knows", () => {
		const languages = Object.keys(CATALOG_REDIRECTS.exact);
		expect(languages).toHaveLength(10);
		for (const language of languages) {
			const sources = Object.keys(CATALOG_REDIRECTS.exact[language] ?? {});
			for (const page of LIVE) {
				expect(
					sources.filter((from) => from.endsWith(`/${page}`)),
					`${language} ${page}`,
				).toEqual([]);
			}
		}
	});

	it("are nobody's redirect target either, so nobody is sent to a page the table would then move again", () => {
		for (const language of Object.keys(CATALOG_REDIRECTS.exact)) {
			const targets = new Set(Object.values(CATALOG_REDIRECTS.exact[language] ?? {}));
			for (const page of LIVE) {
				expect(
					[...targets].filter((to) => to.endsWith(`/${page}`)),
					`${language} ${page}`,
				).toEqual([]);
			}
		}
	});

	it("have no redirect in any market, in the market's own category", () => {
		for (const market of MARKETS) {
			for (const page of [...LIVE, NEW_BELOW_UP]) {
				expect(catalogRedirectTarget(market, `/${category(market)}/${page}`), `${market} ${page}`).toBeNull();
			}
		}
	});

	it("are not answered with a 301 at the edge in any market", async () => {
		for (const market of MARKETS) {
			for (const page of [...LIVE, NEW_BELOW_UP]) {
				const path = `/${market}/${category(market)}/${page}`;
				const res = await proxy(req(path));
				expect(res.status, path).not.toBe(301);
				expect(res.headers.get("location"), path).toBeNull();
			}
		}
	});

	it("do not change the page that stays retired: the old VW Up! generation still goes to the brand", async () => {
		const [from, to] = STILL_RETIRED;
		for (const market of MARKETS) {
			expect(catalogRedirectTarget(market, `/${category(market)}/${from}`), market).toBe(
				`/${category(market)}/${to}`,
			);
			const res = await proxy(req(`/${market}/${category(market)}/${from}`));
			expect(res.status, market).toBe(301);
			expect(new URL(res.headers.get("location")!).pathname, market).toBe(
				`/${market}/${category(market)}/${to}`,
			);
		}
	});
});
