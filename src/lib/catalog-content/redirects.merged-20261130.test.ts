import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { categorySegment } from "@/config/category-routes";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { proxy } from "@/proxy";
import { catalogLanguageForMarket } from "./language";
import { CATALOG_REDIRECTS, catalogRedirectTarget } from "./redirects";

/**
 * The four generation pages CFM retires with the fitment list of the week of 2026-11-30 (CFM message of
 * 2026-11-27, 11 corrections to overlapping generations): four pages in each of the twelve markets, 48 pairs.
 *
 * Three have one successor, which has a page of its own: Kamiq NW4 -> NW, Patriot MK -> MK74, Rexton Y250 ->
 * Y200. The fourth, the Mazda 3 Hatchback label "2003-2013", is split between BK (2003-2009) and BL
 * (2009-2013): a link cannot choose between them, so it goes to the MODEL page, which lists both. That is the
 * same answer the storefront gives a saved car and the page-level fallback gives (`retired-ids.ts`,
 * `successorOf`): never a pick by name.
 *
 * The addresses are the ones the live site served on 2026-11-27 (sk: 200 for all four, with their own h1),
 * typed in here and NOT derived from `redirects.json`. The pages stay in CFM's export until M confirms the
 * 301, so the redirect has to be live before CFM withdraws them.
 */
const PAGES: readonly (readonly [from: string, to: string])[] = [
	["skoda/kamiq/nw4", "skoda/kamiq/nw"],
	["jeep/patriot/mk", "jeep/patriot/mk74"],
	["kgm/rexton/y250", "kgm/rexton/y200"],
	["mazda/3-hatchback/2003-2013", "mazda/3-hatchback"],
];

/** Pages that stay as they are, and must never be answered with a redirect. */
const STAY = [
	"skoda/kamiq",
	"skoda/kamiq/nw",
	"jeep/patriot",
	"jeep/patriot/mk74",
	"kgm/rexton",
	"kgm/rexton/y200",
	"mazda/3-hatchback",
	"mazda/3-hatchback/bk",
	"mazda/3-hatchback/bl",
	"mazda/3-hatchback/bm",
] as const;

const MARKETS = Object.keys(CHANNEL_MAP).filter((market) => catalogLanguageForMarket(market));

const category = (market: string) => categorySegment(market, "stresne-nosice");
const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));
const pathnameOf = (res: Response) => {
	const location = res.headers.get("location");
	return location ? new URL(location).pathname : null;
};

describe("the four generation pages of the 2026-11-30 fitment list", () => {
	it("are four pages in twelve markets, 48 pairs", () => {
		expect(PAGES).toHaveLength(4);
		expect(MARKETS).toHaveLength(12);
		expect(PAGES.length * MARKETS.length).toBe(48);
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

	it("hold exactly four rows per language", () => {
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

	it("are 301 at the edge in every market, straight to the successor (the model page for the split Mazda), and never a second hop", async () => {
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
		const [from, to] = PAGES[0]!;
		const res = await proxy(req(`/de/${category("de")}/${from}?utm_source=newsletter`));
		expect(new URL(res.headers.get("location")!).search).toBe("?utm_source=newsletter");
		const rsc = await proxy(req(`/de/${category("de")}/${from}.rsc`));
		expect(rsc.status).toBe(301);
		expect(pathnameOf(rsc)).toBe(`/de/${category("de")}/${to}`);
	});

	it("leave the successors, the model pages and the sibling generations alone", async () => {
		for (const market of MARKETS) {
			for (const page of STAY) {
				const path = `/${market}/${category(market)}/${page}`;
				expect(catalogRedirectTarget(market, `/${category(market)}/${page}`), path).toBeNull();
				expect((await proxy(req(path))).status, path).not.toBe(301);
			}
		}
	});
});
