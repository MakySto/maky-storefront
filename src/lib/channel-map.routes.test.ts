import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { categoryRouteTable } from "@/config/category-routes";
import { CATEGORY_SLUGS } from "@/config/categories";
import { __forgetStockedBrands, isKnownAbsentBrand, publishStockedBrands } from "@/lib/brands/stocked-slugs";
import { proxy } from "@/proxy";
import {
	CHANNEL_MAP,
	ROUTE_CHILD_WORDS,
	ROUTE_WORDS,
	internalMarketPath,
	localizeMarketPath,
	marketHref,
	marketSwitchHref,
	routeForWord,
	routeWord,
	routeWordsOf,
} from "./channel-map";
import { marketHasRoute } from "./route-policy";
import { MARKET_ROOT_SEGMENTS } from "./routing.generated";

/**
 * A market's pages under that market's own words (audit of the live store 2026-11-27, S5).
 *
 * Until then the eleven foreign markets showed the Slovak directory names: `/de/doprava-a-platba`,
 * `/us/obchodne-podmienky`, `/at/oblubene`. The table in `channel-map.ts` now names each of them per
 * market; this file holds the table to its rules and the proxy to serving it.
 */

const MARKETS = Object.keys(CHANNEL_MAP);
const FOREIGN = MARKETS.filter((market) => market !== "sk");
const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));

describe("the table of words", () => {
	it("names only routes that exist, and Slovakia keeps every directory name except the cart's", () => {
		for (const internal of Object.keys(ROUTE_WORDS)) {
			expect(MARKET_ROOT_SEGMENTS.has(internal), internal).toBe(true);
			if (internal !== "cart") expect(routeWord("sk", internal), internal).toBe(internal);
		}
		for (const key of Object.keys(ROUTE_CHILD_WORDS)) {
			expect(ROUTE_WORDS[key.split("/")[0]!], key).toBeDefined();
		}
	});

	it("is written for known markets, in lower-case ASCII with hyphens", () => {
		for (const table of [ROUTE_WORDS, ROUTE_CHILD_WORDS]) {
			for (const [internal, words] of Object.entries(table)) {
				for (const [market, word] of Object.entries(words)) {
					expect(MARKETS, `${internal} names the market ${market}`).toContain(market);
					expect(word, `${internal} in ${market}`).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
				}
			}
		}
	});

	it("gives every foreign market its own word for the Slovak phrases", () => {
		// A phrase only Slovak (and sometimes Czech) has. `kontakt`, `znacky` and the cart are also the
		// Czech, German or Polish word, so they are not in this list.
		for (const internal of [
			"doprava-a-platba",
			"reklamacie-a-vratenie",
			"odstupenie-od-zmluvy",
			"oblubene",
		]) {
			for (const market of FOREIGN) {
				if (internal === "doprava-a-platba" && market === "cz") continue;
				expect(routeWord(market, internal), `${market} ${internal}`).not.toBe(internal);
			}
		}
		for (const market of FOREIGN) {
			expect(routeWord(market, "obchodne-podmienky"), market).not.toBe("obchodne-podmienky");
			expect(routeWord(market, "ochrana-osobnych-udajov"), market).not.toBe("ochrana-osobnych-udajov");
		}
		for (const market of ["de", "at", "pl", "hu", "it", "fr", "es", "ro", "us", "ca"]) {
			expect(routeWord(market, "znacky"), market).not.toBe("znacky");
		}
	});

	it("never gives a market a word that is a route directory, a category root, or two routes at once", () => {
		const floor = new Set<string>(CATEGORY_SLUGS);
		for (const market of MARKETS) {
			const words = routeWordsOf(market);
			expect(new Set(words).size, `${market} uses a word twice`).toBe(words.length);
			const categoryRoots = new Set(
				categoryRouteTable()
					.filter((row) => row.market === market)
					.map((row) => row.segment),
			);
			expect(categoryRoots.size, `${market} has category roots to compare with`).toBeGreaterThan(0);
			for (const word of words) {
				expect(MARKET_ROOT_SEGMENTS.has(word), `${market}/${word} is a route directory`).toBe(false);
				expect(MARKETS, `${market}/${word} is a market`).not.toContain(word);
				expect(floor.has(word), `${market}/${word} is a category slug`).toBe(false);
				expect(categoryRoots.has(word), `${market}/${word} is a category root there`).toBe(false);
			}
		}
	});

	it("means one route wherever a word appears, so the switcher can read a path without its market", () => {
		const meaning = new Map<string, string>();
		for (const market of MARKETS) {
			for (const word of routeWordsOf(market)) {
				const internal = routeForWord(market, word)!;
				expect(meaning.get(word) ?? internal, `${word} in ${market}`).toBe(internal);
				meaning.set(word, internal);
			}
		}
	});
});

describe("a path in one market's words", () => {
	it("is built from the directory names by every link", () => {
		expect(marketHref("de-eur", "/doprava-a-platba")).toBe("/de/versand-und-zahlung");
		expect(marketHref("us-usd", "/znacky/thule")).toBe("/us/brands/thule");
		expect(marketHref("fr-eur", "/kontakt#quote=abc")).toBe("/fr/contact#quote=abc");
		expect(marketHref("at-eur", "/odstupenie-od-zmluvy")).toBe("/at/ruecktrittsrecht");
		expect(marketHref("de-eur", "/odstupenie-od-zmluvy")).toBe("/de/widerrufsrecht");
		expect(marketHref("pl-pln", "/oblubene?x=1")).toBe("/pl/ulubione?x=1");
		// Slovakia, and a market whose word is the same, are left as they are.
		expect(marketHref("sk-eur", "/doprava-a-platba")).toBe("/sk/doprava-a-platba");
		expect(marketHref("de-eur", "/kontakt")).toBe("/de/kontakt");
		expect(marketHref("cz-czk", "/znacky/thule")).toBe("/cz/znacky/thule");
	});

	it("translates the page below a route too, and only where the table names it", () => {
		expect(localizeMarketPath("de", "/odstupenie-od-zmluvy/vzorovy-formular")).toBe(
			"/widerrufsrecht/musterformular",
		);
		expect(localizeMarketPath("cz", "/odstupenie-od-zmluvy/vzorovy-formular")).toBe(
			"/odstoupeni-od-smlouvy/vzorovy-formular",
		);
		expect(localizeMarketPath("sk", "/odstupenie-od-zmluvy/vzorovy-formular")).toBe(
			"/odstupenie-od-zmluvy/vzorovy-formular",
		);
		// A maker's slug is not a page of the table, whatever it is called.
		expect(localizeMarketPath("de", "/znacky/vzorovy-formular")).toBe("/marken/vzorovy-formular");
	});

	it("touches whole segments only, and nothing that is not a route", () => {
		expect(localizeMarketPath("de", "/kontaktgrill-thule")).toBe("/kontaktgrill-thule");
		expect(localizeMarketPath("us", "/znacky-na-aute")).toBe("/znacky-na-aute");
		expect(localizeMarketPath("us", "/stresne-nosice/znacky")).toBe("/stresne-nosice/znacky");
		expect(localizeMarketPath("us", "/znacky.rsc?_rsc=1")).toBe("/brands.rsc?_rsc=1");
		expect(localizeMarketPath("us", "")).toBe("");
		expect(localizeMarketPath("us", "/")).toBe("/");
	});

	it("reads back to the directory names, for that market's words and no other's", () => {
		for (const market of MARKETS) {
			for (const internal of Object.keys(ROUTE_WORDS)) {
				const path = `/${internal}/x?y=1#z`;
				expect(internalMarketPath(market, localizeMarketPath(market, path)), `${market} ${path}`).toBe(path);
			}
			const form = "/odstupenie-od-zmluvy/vzorovy-formular";
			expect(internalMarketPath(market, localizeMarketPath(market, form)), market).toBe(form);
		}
		// Germany's word is not Austria's, and a foreign word is nothing in Slovakia.
		expect(internalMarketPath("at", "/widerrufsrecht")).toBe("/widerrufsrecht");
		expect(internalMarketPath("sk", "/brands")).toBe("/brands");
		// The directory name where the market has another word is an old address, not this market's.
		expect(internalMarketPath("de", "/doprava-a-platba")).toBe("/doprava-a-platba");
	});

	it("moves with the market switcher to the target market's words", () => {
		expect(marketSwitchHref("fr", "/versand-und-zahlung", "de")).toBe("/fr/livraison-et-paiement");
		expect(marketSwitchHref("sk", "/brands/thule?page=2", "us")).toBe("/sk/znacky/thule?page=2");
		expect(marketSwitchHref("de", "/odstupenie-od-zmluvy/vzorovy-formular", "sk")).toBe(
			"/de/widerrufsrecht/musterformular",
		);
		expect(marketSwitchHref("at", "/widerrufsrecht/musterformular", "de")).toBe(
			"/at/ruecktrittsrecht/musterformular",
		);
		// Without the market it came from, as the cart has always been read.
		expect(marketSwitchHref("cz", "/warenkorb")).toBe("/cz/kosik");
		expect(marketSwitchHref("pl", "/marken/thule")).toBe("/pl/marki/thule");
		expect(marketSwitchHref("de", "/kontakt")).toBe("/de/kontakt");
	});
});

describe("the proxy serves the market's word and retires the Slovak one", () => {
	const PAGES = Object.keys(ROUTE_WORDS).filter((internal) => internal !== "cart");

	for (const market of FOREIGN) {
		it(`${market}: every page answers under its word, and the directory name redirects there once`, async () => {
			const channel = CHANNEL_MAP[market]!.saleorSlug;
			for (const internal of PAGES) {
				expect(marketHasRoute(market, internal), `${market} ${internal}`).toBe(true);
				const word = routeWord(market, internal);

				const served = await proxy(req(`/${market}/${word}`));
				expect(served.status, `/${market}/${word}`).toBeLessThan(300);
				expect(served.headers.get("x-middleware-rewrite"), `/${market}/${word}`).toMatch(
					new RegExp(`/${channel}/${internal}$`),
				);
				expect(served.headers.get("x-channel")).toBe(channel);

				if (word === internal) continue;
				const old = await proxy(req(`/${market}/${internal}?utm=x`));
				expect(old.status, `/${market}/${internal}`).toBe(308);
				expect(new URL(old.headers.get("location")!).pathname).toBe(`/${market}/${word}`);
				expect(new URL(old.headers.get("location")!).search).toBe("?utm=x");
			}
		});
	}

	it("keeps Slovakia exactly as it was", async () => {
		for (const internal of PAGES) {
			const res = await proxy(req(`/sk/${internal}`));
			expect(res.status, internal).toBeLessThan(300);
			expect(res.headers.get("x-middleware-rewrite"), internal).toMatch(new RegExp(`/sk-eur/${internal}$`));
		}
	});

	it("carries what is below the page, and Next's suffixes, through both the redirect and the rewrite", async () => {
		const maker = await proxy(req("/us/brands/thule"));
		expect(maker.headers.get("x-middleware-rewrite")).toMatch(/\/us-usd\/znacky\/thule$/);

		const oldMaker = await proxy(req("/us/znacky/thule"));
		expect(oldMaker.status).toBe(308);
		expect(new URL(oldMaker.headers.get("location")!).pathname).toBe("/us/brands/thule");

		const form = await proxy(req("/de/widerrufsrecht/musterformular"));
		expect(form.headers.get("x-middleware-rewrite")).toMatch(
			/\/de-eur\/odstupenie-od-zmluvy\/vzorovy-formular$/,
		);
		const oldForm = await proxy(req("/de/odstupenie-od-zmluvy/vzorovy-formular"));
		expect(oldForm.status).toBe(308);
		expect(new URL(oldForm.headers.get("location")!).pathname).toBe("/de/widerrufsrecht/musterformular");

		expect((await proxy(req("/de/marken.rsc"))).headers.get("x-middleware-rewrite")).toMatch(
			/\/de-eur\/znacky\.rsc$/,
		);
		expect(
			(await proxy(req("/de/marken/thule/_segments/x.segment.rsc"))).headers.get("x-middleware-rewrite"),
		).toMatch(/\/de-eur\/znacky\/thule\/_segments\/x\.segment\.rsc$/);
	});

	it("does not serve one market's word in another", async () => {
		// Germany's word in Austria, and an English word in Slovakia: neither is that market's page.
		for (const path of ["/at/widerrufsrecht", "/sk/brands", "/de/brands"]) {
			const res = await proxy(req(path));
			expect(res.headers.get("x-middleware-rewrite") ?? "", path).not.toMatch(
				/\/(odstupenie-od-zmluvy|znacky)$/,
			);
		}
	});
});

describe("a maker the market does not sell", () => {
	afterEach(() => __forgetStockedBrands());

	it("is a 404 once the server has counted that market's makers, under either word", async () => {
		publishStockedBrands("us-usd", ["thule", "yakima"]);
		publishStockedBrands("sk-eur", ["thule", "menabo"]);

		for (const path of ["/us/brands/neexistuje", "/us/brands/menabo", "/sk/znacky/yakima"]) {
			const res = await proxy(req(path));
			expect(res.status, path).toBe(404);
			expect(res.headers.get("x-robots-tag"), path).toBe("noindex");
		}
		for (const path of [
			"/us/brands/thule",
			"/us/brands/yakima",
			"/sk/znacky/menabo",
			"/us/brands",
			"/sk/znacky",
		]) {
			expect((await proxy(req(path))).status, path).toBeLessThan(300);
		}
		// The old address of a maker goes to the new one first; the 404 is said there.
		expect((await proxy(req("/us/znacky/neexistuje"))).status).toBe(308);
	});

	it("is left to the page while the list is not known", async () => {
		// A fresh process, or a Saleor that has not answered: unknown is not absent.
		expect((await proxy(req("/de/marken/neexistuje"))).status).toBeLessThan(300);
		expect((await proxy(req("/sk/znacky/neexistuje"))).status).toBeLessThan(300);
		expect(isKnownAbsentBrand("de-eur", "neexistuje")).toBe(false);
	});
});
