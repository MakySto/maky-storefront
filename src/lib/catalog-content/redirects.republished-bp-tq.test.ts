import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { categorySegment } from "@/config/category-routes";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { proxy } from "@/proxy";
import { catalogLanguageForMarket } from "./language";
import { CATALOG_REDIRECTS, catalogRedirectTarget } from "./redirects";

/**
 * Two generation pages that RELEASE-4 (2026-09-15) retired and CFM has published again.
 *
 * `subaru/legacy-kombi/bp` (CFM page 1121, node 13441) and `hyundai/h-1-van/tq` (CFM page 1348, node 14356)
 * were sent to `.../bh` and `.../a1`, which RELEASE-4 had created for the same cars. Since then both
 * generations are nodes of the live fitment dataset again, each with its own years (BP 2003 to 2009, TQ 2008 to
 * 2021; BH 1998 to 2003 and A1 1997 to 2007 are the generations before them), and both pages are published and
 * indexable with Slovak text in all ten languages' paths: the CFM server read of 2026-11-08 17:55 UTC found BP with
 * 14 products and TQ with 4, no CatalogPageUrlHistory row from BP to BH or from TQ to A1, and the live web
 * answering `301 .../bh` and `301 .../a1` while the model pages listed neither generation and the sitemap neither
 * address. M had flagged it on 2026-10-14 (`redirects.map-agreement.check.test.ts`) and again on 2026-10-18.
 *
 * A row in this table wins over everything: the proxy answers a 301 before any page renders, the vehicle route
 * leaves the node out of its tiles, `vehicleHref` gives no link and the sitemap skips it (all four ask
 * `catalogRedirectTarget`). So the rows leave, in every language and in both spellings the table carried (the
 * localized one and the Slovak one abroad), 40 in all. BH and A1 were never retired and stay ordinary pages.
 *
 * What the proxy does with the Slovak spelling abroad is not this table's business: it takes `/cz/stresne-nosice/…`
 * to `/cz/stresni-nosice/…` in one hop, as for every other vehicle page, and the localized page is served.
 */
const LIVE = ["subaru/legacy-kombi/bp", "hyundai/h-1-van/tq"] as const;
const NEIGHBOURS = ["subaru/legacy-kombi/bh", "hyundai/h-1-van/a1"] as const;

const MARKETS = Object.keys(CHANNEL_MAP).filter((market) => catalogLanguageForMarket(market));

const category = (market: string) => categorySegment(market, "stresne-nosice");
const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));

describe("the republished Subaru Legacy Kombi BP and Hyundai H-1 Van TQ pages", () => {
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

	it("have no redirect in any market, in the market's own category or in the Slovak spelling", () => {
		for (const market of MARKETS) {
			for (const page of LIVE) {
				for (const root of new Set([category(market), "stresne-nosice"])) {
					expect(catalogRedirectTarget(market, `/${root}/${page}`), `${market} /${root}/${page}`).toBeNull();
				}
			}
		}
	});

	it("are not answered with a 301 to BH or A1 at the edge: the localized page is served, the Slovak spelling abroad goes to it in one hop", async () => {
		for (const market of MARKETS) {
			for (const page of LIVE) {
				const localized = `/${market}/${category(market)}/${page}`;
				const served = await proxy(req(localized));
				expect(served.status, localized).not.toBe(301);
				expect(served.headers.get("location"), localized).toBeNull();

				const slovak = `/${market}/stresne-nosice/${page}`;
				const res = await proxy(req(slovak));
				if (category(market) === "stresne-nosice") {
					expect(res.status, slovak).not.toBe(301);
					expect(res.headers.get("location"), slovak).toBeNull();
				} else {
					expect(res.status, slovak).toBe(301);
					expect(new URL(res.headers.get("location")!).pathname, slovak).toBe(localized);
				}
			}
		}
	});

	it("leave the pages before them as they were: BH and A1 never had a row and have none now", () => {
		for (const market of MARKETS) {
			for (const page of NEIGHBOURS) {
				for (const root of new Set([category(market), "stresne-nosice"])) {
					expect(catalogRedirectTarget(market, `/${root}/${page}`), `${market} /${root}/${page}`).toBeNull();
				}
			}
		}
	});
});
