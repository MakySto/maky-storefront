import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { categorySegment } from "@/config/category-routes";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { proxy } from "@/proxy";
import { catalogLanguageForMarket } from "./language";
import { CATALOG_REDIRECTS, catalogRedirectTarget } from "./redirects";

/**
 * The eight generation pages CFM retires when it moves the Nordrive sets of eight merged cars onto
 * the cars of the same model (CFM 4.5, 2026-10-22, points 1 and 4): eight pages in each of the twelve
 * markets, 96 pairs, the second batch after the twelve of 2026-10-18 (`redirects.merged-generations.test.ts`).
 *
 * The list below is typed in from their message and is NOT derived from `redirects.json`, so the JSON is
 * checked against what CFM sent, not against itself. Each side is `brand/model/generation` or
 * `brand/model` without the category: the category is the market's own root, which this test asks the
 * storefront (`categorySegment`) rather than repeating.
 *
 * None of the eight has a successor generation with a page of its own (the surviving generation has no
 * page in the export), so every pair goes one level up, to the model page, which the vehicle route
 * renders. Sedici and Peugeot 806 stay in this batch: their generation pages are retired in the third batch
 * (`redirects.merged-nordrive-z26.test.ts`), the model pages stay.
 */
const PAGES: readonly (readonly [from: string, to: string])[] = [
	["citroen/c4-cactus/2014-2018", "citroen/c4-cactus"],
	["citroen/c4-spacetourer/2018", "citroen/c4-spacetourer"],
	["dacia/bigster/2025", "dacia/bigster"],
	["nissan/navara-pick-up/d40", "nissan/navara-pick-up"],
	["opel/antara/2006-2011", "opel/antara"],
	["opel/crossland-x/2021", "opel/crossland-x"],
	["renault/kadjar/2015-2022", "renault/kadjar"],
	["lancia/zeta/1994-2003", "lancia/zeta"],
];

/** Pages that stay as they are, and must never be answered with a redirect. */
const STAY = [
	"fiat/sedici",
	"peugeot/806",
	"nissan/navara-pick-up/d23",
	"citroen/grand-c4-spacetourer/3a",
] as const;

const MARKETS = Object.keys(CHANNEL_MAP).filter((market) => catalogLanguageForMarket(market));

/** CFM's own example for the Slovak market, as they wrote it. */
const CFM_EXAMPLE = {
	from: "/sk/stresne-nosice/citroen/c4-cactus/2014-2018",
	to: "/sk/stresne-nosice/citroen/c4-cactus",
};

const category = (market: string) => categorySegment(market, "stresne-nosice");
const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));
const pathnameOf = (res: Response) => {
	const location = res.headers.get("location");
	return location ? new URL(location).pathname : null;
};

describe("the merged Nordrive generation pages", () => {
	it("are eight pages in twelve markets, 96 pairs", () => {
		expect(PAGES).toHaveLength(8);
		expect(MARKETS).toHaveLength(12);
		expect(PAGES.length * MARKETS.length).toBe(96);
	});

	it("agree with the one example CFM wrote out", () => {
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

	it("are all the table holds for them: no entry beyond the 80 language rows", () => {
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

	it("leave Sedici, Peugeot 806 and the sibling generations alone", async () => {
		for (const market of MARKETS) {
			for (const page of STAY) {
				const path = `/${market}/${category(market)}/${page}`;
				expect(catalogRedirectTarget(market, `/${category(market)}/${page}`), path).toBeNull();
				const res = await proxy(req(path));
				expect(res.status, path).not.toBe(301);
			}
		}
	});
});
