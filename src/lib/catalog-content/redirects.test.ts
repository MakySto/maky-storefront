import { afterEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_MAP, FRIENDLY_SLUGS } from "@/lib/channel-map";
import { catalogLanguageForMarket } from "./language";
import { CATALOG_REDIRECTS, catalogRedirectTarget } from "./redirects";

/**
 * The retired-page table, checked against itself. Whether it fits the catalogue it was
 * written for is `redirects.acceptance.test.ts`, which needs the artifacts.
 *
 * Every assertion walks the whole table rather than naming a page, so a release that retires
 * or re-targets pages changes `redirects.json` and nothing here.
 */

const MARKETS = Object.keys(CHANNEL_MAP);
const LANGUAGES = new Set(MARKETS.map((market) => catalogLanguageForMarket(market)));

type Move = { market: string; from: string; to: string };

/** A table's entries, fanned out to every market that reads its language. */
function fanOut(table: typeof CATALOG_REDIRECTS.exact): Move[] {
	return MARKETS.flatMap((market) =>
		Object.entries(table[catalogLanguageForMarket(market) ?? ""] ?? {}).map(([from, to]) => ({
			market,
			from,
			to,
		})),
	);
}

const EXACT = fanOut(CATALOG_REDIRECTS.exact);
const ROOTS = fanOut(CATALOG_REDIRECTS.roots);

/** A catalogue path as the artifacts spell it: lower-case segments, no trailing slash. */
const CATALOG_PATH = /^(\/[a-z0-9-]+)+$/;

describe("the retired-page table", () => {
	it("is not empty, so the walks below test something", () => {
		expect(EXACT.length).toBeGreaterThan(0);
	});

	it("is keyed only by languages some market reads", () => {
		for (const language of [
			...Object.keys(CATALOG_REDIRECTS.exact),
			...Object.keys(CATALOG_REDIRECTS.roots),
		]) {
			expect(LANGUAGES.has(language), language).toBe(true);
		}
	});

	it("spells every path the way the artifacts do, without a market prefix", () => {
		for (const path of [...EXACT, ...ROOTS].flatMap(({ from, to }) => [from, to])) {
			expect(path).toMatch(CATALOG_PATH);
			expect(FRIENDLY_SLUGS.has(path.split("/")[1]), path).toBe(false);
		}
	});

	it("answers each market with the table of the language it reads", () => {
		// `at` with the German entries, `ca` with the English ones: one entry, two markets.
		for (const { market, from, to } of EXACT) {
			expect(catalogRedirectTarget(market, from), `${market} ${from}`).toBe(to);
		}
	});

	it("never sends a path to itself, and never through a second hop", () => {
		for (const { market, from, to } of [...EXACT, ...ROOTS]) {
			expect(to, `${market} ${from}`).not.toBe(from);
			expect(catalogRedirectTarget(market, to), `${market} ${to} is itself redirected`).toBeNull();
		}
	});

	it("does not answer a path in a market whose language did not retire it", () => {
		for (const { market, from } of EXACT) {
			for (const other of MARKETS) {
				const language = catalogLanguageForMarket(other) ?? "";
				const retiredThere =
					from in (CATALOG_REDIRECTS.exact[language] ?? {}) ||
					Object.keys(CATALOG_REDIRECTS.roots[language] ?? {}).some(
						(root) => from === root || from.startsWith(`${root}/`),
					);
				if (retiredThere) continue;
				expect(catalogRedirectTarget(other, from), `${other} ${from} (retired in ${market})`).toBeNull();
			}
		}
	});

	it.skipIf(ROOTS.length === 0)(
		"moves a retired root with everything below it, and nothing beside it",
		() => {
			for (const { market, from, to } of ROOTS) {
				expect(catalogRedirectTarget(market, from)).toBe(to);
				expect(catalogRedirectTarget(market, `${from}/bmw/x3`)).toBe(`${to}/bmw/x3`);
				// Starting with the same letters is not being below the root.
				expect(catalogRedirectTarget(market, `${from}-2/bmw`)).toBeNull();
			}
		},
	);

	it("answers nothing for a Saleor channel or an unknown segment", () => {
		const [{ from }] = EXACT;
		expect(catalogRedirectTarget("sk-eur", from)).toBeNull();
		expect(catalogRedirectTarget("xx", from)).toBeNull();
	});
});

/**
 * The composition the live table never exercises: every page under Spain's old root that CFM
 * retired is also listed under that old root, so the exact entry answers first. A table that
 * forgot one must still not produce a chain.
 */
describe("the lookup, on a table of its own", () => {
	afterEach(() => {
		vi.doUnmock("./redirects.json");
		vi.resetModules();
	});

	it("lands a retired page under a retired root in one hop, and serves both markets of a language", async () => {
		vi.resetModules();
		vi.doMock("./redirects.json", () => ({
			default: {
				release: "test",
				source: "test",
				exact: { de: { "/neu/marke/modell/alt": "/neu/marke/modell" } },
				roots: { de: { "/alt": "/neu" } },
			},
		}));
		const { catalogRedirectTarget: lookup } = await import("./redirects");

		expect(lookup("de", "/alt/marke/modell/alt")).toBe("/neu/marke/modell");
		expect(lookup("at", "/alt/marke/modell/alt")).toBe("/neu/marke/modell");
		expect(lookup("de", "/alt/marke")).toBe("/neu/marke");
		expect(lookup("sk", "/alt/marke")).toBeNull();
	});
});
