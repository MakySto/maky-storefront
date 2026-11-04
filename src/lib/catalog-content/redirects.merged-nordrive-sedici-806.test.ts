import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { categorySegment } from "@/config/category-routes";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { proxy } from "@/proxy";
import { catalogLanguageForMarket } from "./language";
import { CATALOG_REDIRECTS, catalogRedirectTarget } from "./redirects";

/**
 * The two generation pages CFM retires when it moves the 23 Nordrive sets of Fiat Sedici (10) and Peugeot 806 (13)
 * onto the right cars (CFM 4.5, 2026-10-30, thread "Roky aut"): two pages in each of the twelve markets, 24 pairs,
 * the third batch after the twelve of 2026-10-18 and the 96 of 2026-10-22.
 *
 * The list is typed in from their message, not derived from `redirects.json`. The target generations have no page
 * of their own, so each pair goes one level up, to the model page the vehicle route renders.
 */
const PAGES: readonly (readonly [from: string, to: string])[] = [
	["fiat/sedici/2006", "fiat/sedici"],
	["peugeot/806/1994-2002", "peugeot/806"],
];

/** Pages that stay as they are, and must never be answered with a redirect. */
const STAY = [
	"fiat/sedici",
	"peugeot/806",
	"nissan/navara-pick-up/d23",
	"citroen/grand-c4-spacetourer/3a",
] as const;

const MARKETS = Object.keys(CHANNEL_MAP).filter((market) => catalogLanguageForMarket(market));

const category = (market: string) => categorySegment(market, "stresne-nosice");
const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));
const pathnameOf = (res: Response) => {
	const location = res.headers.get("location");
	return location ? new URL(location).pathname : null;
};

describe("the merged Sedici and Peugeot 806 generation pages", () => {
	it("are two pages in twelve markets, 24 pairs", () => {
		expect(PAGES).toHaveLength(2);
		expect(MARKETS).toHaveLength(12);
		expect(PAGES.length * MARKETS.length).toBe(24);
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

	it("hold exactly two rows per language", () => {
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

	it("are 301 at the edge in every market, straight to the model page, and never a second hop", async () => {
		for (const market of MARKETS) {
			for (const [from, to] of PAGES) {
				const path = `/${market}/${category(market)}/${from}`;
				const res = await proxy(req(path));
				expect(res.status, path).toBe(301);
				expect(pathnameOf(res), path).toBe(`/${market}/${category(market)}/${to}`);
				const target = `/${market}/${category(market)}/${to}`;
				expect((await proxy(req(target))).status, target).not.toBe(301);
			}
		}
	});

	it("are one hop too from the Slovak spelling, and keep the query string and the .rsc request", async () => {
		for (const market of MARKETS.filter((m) => category(m) !== "stresne-nosice")) {
			for (const [from, to] of PAGES) {
				const res = await proxy(req(`/${market}/stresne-nosice/${from}`));
				expect(res.status, `${market} ${from}`).toBe(301);
				expect(pathnameOf(res)).toBe(`/${market}/${category(market)}/${to}`);
			}
		}
		const [from, to] = PAGES[1]!;
		const res = await proxy(req(`/de/${category("de")}/${from}?utm_source=newsletter`));
		expect(new URL(res.headers.get("location")!).search).toBe("?utm_source=newsletter");
		const rsc = await proxy(req(`/de/${category("de")}/${from}.rsc`));
		expect(rsc.status).toBe(301);
		expect(pathnameOf(rsc)).toBe(`/de/${category("de")}/${to}`);
	});

	it("leave the model pages and the sibling generations alone", async () => {
		for (const market of MARKETS) {
			for (const page of STAY) {
				const path = `/${market}/${category(market)}/${page}`;
				expect(catalogRedirectTarget(market, `/${category(market)}/${page}`), path).toBeNull();
				expect((await proxy(req(path))).status, path).not.toBe(301);
			}
		}
	});
});
