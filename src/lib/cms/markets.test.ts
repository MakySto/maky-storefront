import { describe, expect, it } from "vitest";

import { cmsCollectionTag, cmsGlobalTag, cmsPageTag } from "./cache-tags";
import {
	isVisibleInMarket,
	marketForChannel,
	payloadLocaleForChannel,
	payloadLocaleForMarket,
} from "./markets";

describe("marketForChannel", () => {
	it("maps the Saleor slug, which is what [channel] actually holds at runtime", () => {
		// src/proxy.ts rewrites /sk/... to /sk-eur/..., so the route param is the Saleor slug.
		expect(marketForChannel("sk-eur")).toBe("SK");
		expect(marketForChannel("cz-czk")).toBe("CZ");
		expect(marketForChannel("us-usd")).toBe("US");
	});

	it("also accepts the friendly slug, so callers need not know which side of the rewrite they are on", () => {
		expect(marketForChannel("sk")).toBe("SK");
		expect(marketForChannel("at")).toBe("AT");
	});

	it("returns null for an unknown channel", () => {
		expect(marketForChannel("gb-gbp")).toBeNull();
		expect(marketForChannel("gb")).toBeNull();
		expect(marketForChannel("")).toBeNull();
		expect(marketForChannel("000.php")).toBeNull();
	});
});

describe("payloadLocaleForMarket — ten Payload locales for twelve markets", () => {
	it("collapses the two markets that share German", () => {
		expect(payloadLocaleForMarket("DE")).toBe("de");
		expect(payloadLocaleForMarket("AT")).toBe("de");
	});

	it("collapses the two markets that share English", () => {
		expect(payloadLocaleForMarket("US")).toBe("en");
		expect(payloadLocaleForMarket("CA")).toBe("en");
	});

	it("maps Czech to cs, not cz", () => {
		// The market code is CZ but the Payload locale is the language code.
		expect(payloadLocaleForMarket("CZ")).toBe("cs");
	});

	it("covers every market with one of the ten locales", () => {
		const markets = ["SK", "CZ", "PL", "HU", "RO", "AT", "DE", "IT", "FR", "ES", "US", "CA"] as const;
		const locales = new Set(markets.map(payloadLocaleForMarket));
		expect(markets).toHaveLength(12);
		expect(locales.size).toBe(10);
	});
});

describe("payloadLocaleForChannel", () => {
	it("goes straight from the route param to the CMS locale", () => {
		expect(payloadLocaleForChannel("sk-eur")).toBe("sk");
		expect(payloadLocaleForChannel("at-eur")).toBe("de");
		expect(payloadLocaleForChannel("ca-cad")).toBe("en");
	});

	it("returns null for an unknown channel", () => {
		expect(payloadLocaleForChannel("nope")).toBeNull();
	});
});

describe("isVisibleInMarket", () => {
	it("treats null and [] as all markets — the admin UI produces both", () => {
		expect(isVisibleInMarket(null, "SK")).toBe(true);
		expect(isVisibleInMarket(undefined, "SK")).toBe(true);
		expect(isVisibleInMarket([], "SK")).toBe(true);
		expect(isVisibleInMarket([], "US")).toBe(true);
	});

	it("restricts to the listed markets", () => {
		// The live o-nas document carries ["SK"] at both page and block level.
		expect(isVisibleInMarket(["SK"], "SK")).toBe(true);
		expect(isVisibleInMarket(["SK"], "CZ")).toBe(false);
		expect(isVisibleInMarket(["SK", "CZ"], "CZ")).toBe(true);
	});

	it("fails closed when the market cannot be resolved", () => {
		expect(isVisibleInMarket(["SK"], null)).toBe(false);
		// …but unrestricted content is still shown, since there is nothing to restrict.
		expect(isVisibleInMarket(null, null)).toBe(true);
	});
});

describe("cache tags", () => {
	it("namespaces CMS tags so they cannot collide with the Saleor tags", () => {
		expect(cmsPageTag("o-nas")).toBe("cms:page:o-nas");
		expect(cmsGlobalTag("site-settings")).toBe("cms:global:site-settings");
		expect(cmsCollectionTag("pages")).toBe("cms:collection:pages");
	});

	it("refuses a slug that is not slug-shaped, rather than minting a junk tag", () => {
		expect(cmsPageTag("")).toBeNull();
		expect(cmsPageTag("   ")).toBeNull();
		expect(cmsPageTag("a b")).toBeNull();
		expect(cmsPageTag("a/b")).toBeNull();
		expect(cmsPageTag("a\nb")).toBeNull();
		expect(cmsPageTag("x".repeat(201))).toBeNull();
	});

	it("trims incidental whitespace", () => {
		expect(cmsPageTag("  o-nas  ")).toBe("cms:page:o-nas");
	});
});
