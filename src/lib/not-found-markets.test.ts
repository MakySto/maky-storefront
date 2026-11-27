import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";
import {
	NOT_FOUND_BLOCK_ATTRIBUTE,
	NOT_FOUND_DEFAULT_BLOCK,
	NOT_FOUND_MARKET_ATTRIBUTE,
	NOT_FOUND_MARKET_CSS,
	NOT_FOUND_MARKET_SCRIPT,
	NOT_FOUND_MARKETS,
} from "./not-found-markets";

/**
 * The static 404 in the language of the market.
 *
 * Found on the live store on 2026-11-27: `/de/gibt-es-nicht`, `/sk/neexistuje` and the same in
 * the other ten markets answered a correct 404 with an English "Page Not Found", no logo and a
 * "Go Home" link to `/`. The page is static (it has to be, `src/proxy.ts`), so it now carries a
 * block per market and a script that picks one from the address.
 */

/** Runs the inline script against an address and reports what it did to `<html>`. */
function runScript(pathname: string): { market: string | null; lang: string } {
	const attributes = new Map<string, string>();
	const documentElement = {
		lang: "",
		setAttribute(name: string, value: string) {
			attributes.set(name, value);
		},
	};
	new Function("location", "document", NOT_FOUND_MARKET_SCRIPT)({ pathname }, { documentElement });
	return { market: attributes.get(NOT_FOUND_MARKET_ATTRIBUTE) ?? null, lang: documentElement.lang };
}

describe("the 404 copy of each market", () => {
	it("has a row for every market, in its own language", () => {
		expect(NOT_FOUND_MARKETS.map(({ market }) => market)).toEqual(Object.keys(CHANNEL_MAP));
		for (const entry of NOT_FOUND_MARKETS) {
			expect(entry.locale, entry.market).toBe(CHANNEL_MAP[entry.market]!.locale);
			for (const text of [
				entry.title,
				entry.description,
				entry.homeLabel,
				entry.productsLabel,
				entry.searchLabel,
				entry.searchPlaceholder,
				entry.searchAriaLabel,
			]) {
				expect(text.trim().length, entry.market).toBeGreaterThan(0);
			}
		}
	});

	it("says it in Slovak, German, Polish, not in English, outside the English markets", () => {
		const titles = Object.fromEntries(NOT_FOUND_MARKETS.map(({ market, title }) => [market, title]));
		expect(titles.sk).toBe("Stránka nenájdená");
		expect(titles.de).toBe("Seite nicht gefunden");
		expect(titles.at).toBe("Seite nicht gefunden");
		expect(titles.pl).toBe("Strona nie znaleziona");
		for (const { market, title } of NOT_FOUND_MARKETS) {
			if (market === "us" || market === "ca") continue;
			expect(title.toLowerCase(), market).not.toContain("page not found");
		}
	});

	it("keeps every link inside the market", () => {
		for (const entry of NOT_FOUND_MARKETS) {
			expect(entry.homeHref).toBe(`/${entry.market}`);
			expect(entry.productsHref).toBe(`/${entry.market}/products`);
			expect(entry.searchAction).toBe(`/${entry.market}/search`);
		}
	});
});

describe("the script that picks the block", () => {
	it("marks the document with the market of the address and with its language", () => {
		expect(runScript("/de/gibt-es-nicht")).toEqual({ market: "de", lang: "de-DE" });
		expect(runScript("/at/gibt-es-nicht")).toEqual({ market: "at", lang: "de-AT" });
		expect(runScript("/sk/neexistuje/a/hlbsie")).toEqual({ market: "sk", lang: "sk-SK" });
		expect(runScript("/ca")).toEqual({ market: "ca", lang: "en-CA" });
	});

	it("leaves an address with no market alone", () => {
		for (const pathname of [
			"/",
			"/wishlist",
			"/admin.php",
			"/SK/x",
			"/constructor/x",
			"/__proto__/x",
			"/skx/y",
		]) {
			expect(runScript(pathname), pathname).toEqual({ market: null, lang: "" });
		}
	});
});

describe("the rules that show one block", () => {
	it("hides every block, then shows the default one or the market's", () => {
		expect(NOT_FOUND_MARKET_CSS).toContain(`[${NOT_FOUND_BLOCK_ATTRIBUTE}]{display:none}`);
		expect(NOT_FOUND_MARKET_CSS).toContain(
			`html:not([${NOT_FOUND_MARKET_ATTRIBUTE}]) [${NOT_FOUND_BLOCK_ATTRIBUTE}="${NOT_FOUND_DEFAULT_BLOCK}"]{display:block}`,
		);
		for (const { market } of NOT_FOUND_MARKETS) {
			expect(NOT_FOUND_MARKET_CSS).toContain(
				`html[${NOT_FOUND_MARKET_ATTRIBUTE}="${market}"] [${NOT_FOUND_BLOCK_ATTRIBUTE}="${market}"]{display:block}`,
			);
		}
	});
});

describe("the page", () => {
	const source = fs.readFileSync(path.join(process.cwd(), "src/app/not-found.tsx"), "utf8");

	it("renders the script before the blocks, and a block per market", () => {
		const script = source.indexOf("NOT_FOUND_MARKET_SCRIPT }}");
		const firstBlock = source.indexOf("<NotFoundBlock");
		expect(script).toBeGreaterThan(-1);
		expect(firstBlock).toBeGreaterThan(script);
		expect(source).toMatch(/NOT_FOUND_MARKETS\.map\(\(entry\) => \(\s*<NotFoundBlock/);
	});

	it("stays static: no request data, no translations read at request time", () => {
		expect(source).not.toMatch(/next-intl|next\/headers|cookies\(|headers\(|useParams|"use client"/);
	});
});
