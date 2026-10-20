import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { categorySegment } from "@/config/category-routes";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { proxy } from "@/proxy";
import { catalogLanguageForMarket } from "./language";
import { CATALOG_REDIRECTS, catalogRedirectTarget } from "./redirects";

/**
 * The twelve vehicle pages CFM retires when it merges duplicate generations (CFM 4.5, 2026-10-18,
 * point 2 of their answer): twelve pages in each of the twelve markets, 144 pairs.
 *
 * The list below is typed in from their message and is NOT derived from `redirects.json`, so the
 * JSON is checked against what CFM sent, not against itself. Each side is `brand/model/generation`
 * without the category: the category is the market's own root, which this test asks the storefront
 * (`categorySegment`) rather than repeating, so a CFM spelling that differs from ours fails here.
 *
 * Eight pages have a successor generation with a page of its own. Four have none, and go one level
 * up: a model page for Lexus UX and KGM XLV, the brand page for Volkswagen. The VW Up model page does
 * not exist (the remaining model has no page in the export, and the vehicle route renders only a node
 * that has one), so the brand is the nearest live address.
 */
const PAGES: readonly (readonly [from: string, to: string])[] = [
	["renault/twingo/ii-open-air", "renault/twingo/iii"],
	["ford/tourneo-connect/gran-mk2-facelift", "ford/tourneo-connect/v408"],
	["dr-automobiles/dr-70/dr-70", "dr-automobiles/dr-70/dr-70-2024"],
	["ds-automobiles/ds7-crossback/ds-7", "ds-automobiles/ds7-crossback/x74"],
	["peugeot/rifter/rifter", "peugeot/rifter/k9"],
	["opel/combo/combo", "opel/combo/e"],
	["ds-automobiles/ds-4/ds-4", "ds-automobiles/ds-4/d41"],
	["cirelli/4/4", "cirelli/4/4-2025"],
	["lexus/ux/za1", "lexus/ux"],
	["kgm/xlv/2016-2021", "kgm/xlv"],
	["volkswagen/up/up", "volkswagen"],
	["volkswagen/up", "volkswagen"],
];

const MARKETS = Object.keys(CHANNEL_MAP).filter((market) => catalogLanguageForMarket(market));

/** CFM's own example for the Slovak market, as they wrote it. */
const CFM_EXAMPLE = {
	from: "/sk/stresne-nosice/renault/twingo/ii-open-air",
	to: "/sk/stresne-nosice/renault/twingo/iii",
};

const category = (market: string) => categorySegment(market, "stresne-nosice");
const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));
const pathnameOf = (res: Response) => {
	const location = res.headers.get("location");
	return location ? new URL(location).pathname : null;
};

describe("the merged-generation pages", () => {
	it("are twelve pages in twelve markets, 144 pairs", () => {
		expect(PAGES).toHaveLength(12);
		expect(MARKETS).toHaveLength(12);
		expect(PAGES.length * MARKETS.length).toBe(144);
	});

	it("agree with the one example CFM wrote out", () => {
		expect(category("sk")).toBe("stresne-nosice");
		expect(`/sk/${category("sk")}/${PAGES[0]![0]}`).toBe(CFM_EXAMPLE.from);
		expect(`/sk/${category("sk")}/${PAGES[0]![1]}`).toBe(CFM_EXAMPLE.to);
	});

	it("are answered in the table, in the market's own category", () => {
		for (const market of MARKETS) {
			for (const [from, to] of PAGES) {
				expect(catalogRedirectTarget(market, `/${category(market)}/${from}`), `${market} ${from}`).toBe(
					`/${category(market)}/${to}`,
				);
			}
		}
	});

	it("are all the table holds for them: no entry beyond the 120 language rows", () => {
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

	it("are 301 at the edge in every market, straight to the final page", async () => {
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

	it("do not touch the model and brand pages they lead to, nor a sibling generation", async () => {
		for (const path of [
			"/sk/stresne-nosice/volkswagen",
			"/sk/stresne-nosice/lexus/ux",
			"/sk/stresne-nosice/volkswagen/golf",
			"/sk/stresne-nosice/renault/twingo/ii",
			"/de/dachtraeger/opel/combo/d",
		]) {
			const res = await proxy(req(path));
			expect(res.status, path).not.toBe(301);
		}
	});
});
