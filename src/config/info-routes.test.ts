import { describe, expect, it } from "vitest";
import {
	INFO_ROUTES,
	infoRouteFor,
	internalizeInfoPath,
	localizeInfoPath,
	type InfoMarket,
} from "./info-routes";

const MARKETS: readonly InfoMarket[] = [
	"sk",
	"cz",
	"de",
	"at",
	"pl",
	"hu",
	"it",
	"fr",
	"es",
	"ro",
	"us",
	"ca",
];
const INTERNAL_PATHS = [
	"/cookies",
	"/doprava-a-platba",
	"/kontakt",
	"/obchodne-podmienky",
	"/ochrana-osobnych-udajov",
	"/odstupenie-od-zmluvy",
	"/odstupenie-od-zmluvy/vzorovy-formular",
	"/reklamacie-a-vratenie",
];

describe("informational route identities and public spellings", () => {
	it("covers the eight existing routes and all twelve market prefixes", () => {
		expect(INFO_ROUTES.map((route) => route.internalPath)).toEqual(INTERNAL_PATHS);
		for (const route of INFO_ROUTES) {
			expect(Object.keys(route.paths)).toEqual(MARKETS);
		}
	});

	it("keeps every Slovak URL unchanged", () => {
		for (const route of INFO_ROUTES) {
			expect(route.paths.sk).toBe(route.internalPath);
			expect(localizeInfoPath("sk", route.internalPath)).toBe(route.internalPath);
		}
	});

	it.each(MARKETS)("has unique ASCII public paths and a reversible mapping in %s", (market) => {
		const paths = INFO_ROUTES.map((route) => route.paths[market]);
		expect(new Set(paths).size).toBe(INTERNAL_PATHS.length);
		for (const route of INFO_ROUTES) {
			const publicPath = route.paths[market];
			expect(publicPath).toMatch(/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/);
			expect(infoRouteFor(market, route.internalPath)).toEqual({
				internalPath: route.internalPath,
				publicPath,
			});
			expect(infoRouteFor(market, publicPath)).toEqual({
				internalPath: route.internalPath,
				publicPath,
			});
			expect(localizeInfoPath(market, route.internalPath)).toBe(publicPath);
			expect(localizeInfoPath(market, publicPath)).toBe(publicPath);
			expect(internalizeInfoPath(market, publicPath)).toBe(route.internalPath);
			expect(internalizeInfoPath(market, route.internalPath)).toBe(route.internalPath);
		}
	});

	it.each(["us", "ca"])("uses English information URLs in %s", (market) => {
		expect(INTERNAL_PATHS.map((path) => localizeInfoPath(market, path))).toEqual([
			"/cookies",
			"/shipping-and-payment",
			"/contact",
			"/terms-and-conditions",
			"/privacy-policy",
			"/cancellations-and-returns",
			"/cancellations-and-returns/form",
			"/returns-and-complaints",
		]);
	});

	it("keeps German and Austrian terminology distinct without changing contact or cookies", () => {
		expect(localizeInfoPath("de", "/doprava-a-platba")).toBe("/versand-und-zahlung");
		expect(localizeInfoPath("de", "/obchodne-podmienky")).toBe("/agb");
		expect(localizeInfoPath("de", "/ochrana-osobnych-udajov")).toBe("/datenschutz");
		expect(localizeInfoPath("de", "/odstupenie-od-zmluvy")).toBe("/widerruf");
		expect(localizeInfoPath("at", "/odstupenie-od-zmluvy")).toBe("/ruecktritt");
		expect(localizeInfoPath("de", "/odstupenie-od-zmluvy/vzorovy-formular")).toBe("/widerruf/musterformular");
		expect(localizeInfoPath("at", "/odstupenie-od-zmluvy/vzorovy-formular")).toBe(
			"/ruecktritt/musterformular",
		);
		for (const market of ["de", "at"]) {
			expect(localizeInfoPath(market, "/kontakt")).toBe("/kontakt");
			expect(localizeInfoPath(market, "/cookies")).toBe("/cookies");
		}
	});
});

describe("exact path and market boundaries", () => {
	it.each(["unknown", "constructor", "toString", "__proto__", "US", "en", "us-usd"])(
		"leaves unknown market %s to its caller",
		(market) => {
			expect(infoRouteFor(market, "/kontakt")).toBeNull();
			expect(localizeInfoPath(market, "/kontakt?x=1#form")).toBe("/kontakt?x=1#form");
			expect(internalizeInfoPath(market, "/contact.rsc")).toBe("/contact.rsc");
		},
	);

	it.each([
		["us", "/versand-und-zahlung"],
		["de", "/shipping-and-payment"],
		["de", "/contact"],
		["de", "/ruecktritt"],
		["at", "/widerruf/musterformular"],
		["sk", "/cancellations-and-returns/form"],
		["cz", "/odstapienie-od-umowy"],
	])("does not recognize another market's spelling: %s %s", (market, path) => {
		expect(infoRouteFor(market, path)).toBeNull();
		expect(localizeInfoPath(market, path)).toBe(path);
		expect(internalizeInfoPath(market, path)).toBe(path);
	});

	it.each(["/kontakt/", "/kontakt?x=1", "/contact#form", "/contact.rsc"])(
		"requires an undecorated full pathname for infoRouteFor: %s",
		(path) => {
			expect(infoRouteFor("us", path)).toBeNull();
		},
	);

	it.each([
		"",
		"/",
		"kontakt",
		"/unknown",
		"/constructor",
		"/__proto__",
		"/kontakt-details",
		"/contact-us",
		"/contact.html",
		"/contact/anything",
		"/contact//",
		"/odstupenie-od-zmluvy/unknown",
		"/odstupenie-od-zmluvy/vzorovy-formular/extra",
		"/cancellations-and-returns/other",
		"/cancellations-and-returns/form-extra",
		"/cancellations-and-returns/form/extra",
		"/kontakt/_segments/not-transport",
		"/kontakt/segments/x.rsc",
		"/kontakt.json/child",
		"/kontakt/child/_segments/x.segment.rsc",
		"/us/kontakt",
		"https://maky.store/us/kontakt",
	])("leaves unrelated paths and lookalikes unchanged: %s", (path) => {
		expect(infoRouteFor("us", path)).toBeNull();
		expect(localizeInfoPath("us", path)).toBe(path);
		expect(internalizeInfoPath("us", path)).toBe(path);
	});
});

describe("URL and Next transport suffix preservation", () => {
	it.each([
		["us", "/kontakt", "/contact"],
		["de", "/doprava-a-platba", "/versand-und-zahlung"],
		["us", "/odstupenie-od-zmluvy/vzorovy-formular", "/cancellations-and-returns/form"],
		["at", "/odstupenie-od-zmluvy/vzorovy-formular", "/ruecktritt/musterformular"],
		["sk", "/odstupenie-od-zmluvy/vzorovy-formular", "/odstupenie-od-zmluvy/vzorovy-formular"],
	])("preserves suffixes on %s %s in both directions", (market, internalPath, publicPath) => {
		for (const suffix of [
			"/",
			"?utm_source=mail&next=%2Fcontact#form",
			"#form?literal=query",
			"/?x=1#form",
			".rsc?_rsc=abc",
			".json?x=%2F#form",
			"/_segments/x.segment.rsc",
			"/segments/x.segment.rsc?_rsc=abc",
			"/_segments/parent/child.segment.rsc",
			"/_segments/x.segment.rsc/?x=1#form",
		]) {
			expect(localizeInfoPath(market, `${internalPath}${suffix}`)).toBe(`${publicPath}${suffix}`);
			expect(localizeInfoPath(market, `${publicPath}${suffix}`)).toBe(`${publicPath}${suffix}`);
			expect(internalizeInfoPath(market, `${publicPath}${suffix}`)).toBe(`${internalPath}${suffix}`);
			expect(internalizeInfoPath(market, `${internalPath}${suffix}`)).toBe(`${internalPath}${suffix}`);
		}
	});
});
