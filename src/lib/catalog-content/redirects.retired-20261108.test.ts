import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { categorySegment } from "@/config/category-routes";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { proxy } from "@/proxy";
import { catalogLanguageForMarket } from "./language";
import { CATALOG_REDIRECTS, catalogRedirectTarget } from "./redirects";

/**
 * The six vehicle pages the 2026-11-08 content release (3.0.0-full-20261107.1, the one that split
 * the Transporter generations) retired: their ids are gone from the dataset and the map inside it
 * leads each to a MODEL (`veh:md:`), a dissolved summary label whose cars are now spread over the
 * generations of one model.
 *
 * Until they were in the table these six answered 200 with `noindex` and a client-side redirect in
 * the body (`NEXT_REDIRECT`): the vehicle page redirects from inside its Suspense boundary, after the
 * response status has already gone out, so a search engine saw a page that says "noindex" instead of
 * a move. CFM saw it the morning after (2026-11-08) and asked for a clean 301. In the table they are
 * answered at the edge like the others, straight to the model page the page-level redirect chose.
 *
 * The list is typed in from the release (page by page, the successor read with the repository's own
 * `successorOf` and tree), NOT derived from `redirects.json`, so the JSON is checked against what the
 * release says and not against itself. Each side is `brand/model[/generation]` without the category,
 * which is the market's own root and is asked of the storefront (`categorySegment`).
 */
const PAGES: readonly (readonly [from: string, to: string])[] = [
	["subaru/xv/2012-2023", "subaru/xv"],
	["dacia/duster/2010-2024", "dacia/duster"],
	["ford/kuga/2008-2019", "ford/kuga"],
	["volkswagen/passat-variant/b5", "volkswagen/passat-variant"],
	["volkswagen/touareg/2002-2018", "volkswagen/touareg"],
	["ford/mondeo-kombi/1993-2007", "ford/mondeo-kombi"],
];

const MARKETS = Object.keys(CHANNEL_MAP).filter((market) => catalogLanguageForMarket(market));

const category = (market: string) => categorySegment(market, "stresne-nosice");
const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));
const pathnameOf = (res: Response) => {
	const location = res.headers.get("location");
	return location ? new URL(location).pathname : null;
};

describe("the six pages the 2026-11-08 release retired", () => {
	it("are six pages in twelve markets", () => {
		expect(PAGES).toHaveLength(6);
		expect(MARKETS).toHaveLength(12);
	});

	it("are answered in the table, in the market's own category, with the model page", () => {
		for (const market of MARKETS) {
			for (const [from, to] of PAGES) {
				expect(catalogRedirectTarget(market, `/${category(market)}/${from}`), `${market} ${from}`).toBe(
					`/${category(market)}/${to}`,
				);
			}
		}
	});

	it("are one row each in every language table", () => {
		const languages = new Set(MARKETS.map((market) => catalogLanguageForMarket(market)!));
		expect(languages.size).toBe(10);
		for (const language of languages) {
			const segment = category(MARKETS.find((market) => catalogLanguageForMarket(market) === language)!);
			const rows = Object.entries(CATALOG_REDIRECTS.exact[language] ?? {}).filter(([from]) =>
				PAGES.some(([page]) => from === `/${segment}/${page}`),
			);
			expect(rows, language).toHaveLength(PAGES.length);
		}
	});

	it("are 301 at the edge in every market, straight to the model page", async () => {
		for (const market of MARKETS) {
			for (const [from, to] of PAGES) {
				const path = `/${market}/${category(market)}/${from}`;
				const res = await proxy(req(path));
				expect(res.status, path).toBe(301);
				expect(pathnameOf(res), path).toBe(`/${market}/${category(market)}/${to}`);
			}
		}
	});

	it("never send anyone through a second hop", async () => {
		for (const market of MARKETS) {
			for (const [from, to] of PAGES) {
				const target = `/${market}/${category(market)}/${to}`;
				const again = await proxy(req(target));
				expect(again.status, target).not.toBe(301);
				expect(from, target).not.toBe(to);
			}
		}
	});

	it("are one hop too from the Slovak spelling every old link used", async () => {
		for (const market of MARKETS.filter((m) => category(m) !== "stresne-nosice")) {
			for (const [from, to] of PAGES) {
				const path = `/${market}/stresne-nosice/${from}`;
				const res = await proxy(req(path));
				expect(res.status, path).toBe(301);
				expect(pathnameOf(res), path).toBe(`/${market}/${category(market)}/${to}`);
			}
		}
	});

	it("keep the query string and answer the client router's .rsc request", async () => {
		const [from, to] = PAGES[0]!;
		const res = await proxy(req(`/de/${category("de")}/${from}?utm_source=newsletter`));
		expect(new URL(res.headers.get("location")!).search).toBe("?utm_source=newsletter");
		const rsc = await proxy(req(`/de/${category("de")}/${from}.rsc`));
		expect(rsc.status).toBe(301);
		expect(pathnameOf(rsc)).toBe(`/de/${category("de")}/${to}`);
	});

	it("do not touch the model pages they lead to, nor another generation of the same model", async () => {
		for (const path of [
			"/sk/stresne-nosice/subaru/xv",
			"/sk/stresne-nosice/volkswagen/touareg",
			"/sk/stresne-nosice/volkswagen/passat-variant",
			"/sk/stresne-nosice/ford/kuga/dm2",
			"/de/dachtraeger/dacia/duster",
		]) {
			const res = await proxy(req(path));
			expect(res.status, path).not.toBe(301);
		}
	});
});
