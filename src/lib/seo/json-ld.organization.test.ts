import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companyInfo } from "@/config/company";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { marketHasRoute } from "@/lib/route-policy";
import {
	RETURNS_PAGE_PATH,
	buildOrganizationJsonLd,
	buildProductJsonLd,
	buildWebSiteJsonLd,
	organizationId,
} from "./json-ld";

/**
 * The shop's own markup: who sells, where the returns page is, how long delivery takes.
 *
 * Almost every assertion here is about something the markup must NOT say. Google reads an
 * Organization's return and shipping policy as the default for every product it has not been
 * told otherwise about, so a guessed fee, a free-shipping zero or a 30-day window would be
 * repeated beside nine thousand listings. The owner's decisions of 2026-09-22 are pinned
 * literally below, not read back from the builder, so a change to one of them has to change
 * this file too.
 */

const ORIGIN = "https://maky.store";
const MARKETS = Object.keys(CHANNEL_MAP);
const channelOf = (market: string) => CHANNEL_MAP[market]!.saleorSlug;

beforeEach(() => {
	// `getBaseUrl()` reads this per call; production sets it to the public origin.
	vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", ORIGIN);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

type Json = Record<string, unknown>;
const organization = (market: string) => buildOrganizationJsonLd(channelOf(market)) as unknown as Json;
const returnPolicy = (market: string) => organization(market).hasMerchantReturnPolicy as Json;
const shippingConditions = (market: string) =>
	(organization(market).hasShippingService as { shippingConditions: Json[] }).shippingConditions;
const destinationsOf = (condition: Json) =>
	(condition.shippingDestination as Json[]).map((region) => region.addressCountry as string);

describe("the shop is one entity, identified the same way everywhere", () => {
	it.each(MARKETS)("%s: OnlineStore at the organisation's @id, named MAKY.STORE", (market) => {
		expect(organization(market)).toMatchObject({
			"@context": "https://schema.org",
			"@type": "OnlineStore",
			"@id": "https://maky.store/#organization",
			name: "MAKY.STORE",
			url: "https://maky.store/",
		});
	});

	it.each(MARKETS)("%s: the WebSite names the organisation as publisher, by @id", (market) => {
		const site = buildWebSiteJsonLd(channelOf(market)) as unknown as Json;
		expect(site).toEqual({
			"@context": "https://schema.org",
			"@type": "WebSite",
			"@id": "https://maky.store/#website",
			name: "MAKY.STORE",
			url: "https://maky.store/",
			inLanguage: CHANNEL_MAP[market]!.locale,
			publisher: { "@id": organization(market)["@id"] },
		});
	});

	it("declares each market's own language, not Slovak everywhere", () => {
		const languages = MARKETS.map((market) => (buildWebSiteJsonLd(channelOf(market)) as Json).inLanguage);
		expect(languages).toEqual([
			"sk-SK",
			"cs-CZ",
			"de-DE",
			"de-AT",
			"pl-PL",
			"hu-HU",
			"it-IT",
			"fr-FR",
			"es-ES",
			"ro-RO",
			"en-US",
			"en-CA",
		]);
	});

	it("carries no SearchAction — Google retired the sitelinks search box", () => {
		expect(JSON.stringify(buildWebSiteJsonLd("sk-eur"))).not.toContain("potentialAction");
		expect(JSON.stringify(buildWebSiteJsonLd("sk-eur"))).not.toContain("SearchAction");
	});

	it("a product's seller is a reference to the same node, not a second organisation", () => {
		const single = buildProductJsonLd({
			name: "Nosič",
			price: { amount: 147, currency: "EUR" },
		}) as unknown as Json;
		expect((single.offers as Json).seller).toEqual({
			"@type": "Organization",
			"@id": "https://maky.store/#organization",
			name: "MAKY.STORE",
		});

		const group = buildProductJsonLd({
			name: "Box",
			variants: [
				{ sku: "A1", price: { amount: 100, currency: "EUR" } },
				{ sku: "A2", price: { amount: 120, currency: "EUR" } },
			],
		}) as unknown as { hasVariant: { offers: Json }[] };
		for (const variant of group.hasVariant) {
			expect(variant.offers.seller).toMatchObject({ "@id": organizationId() });
		}
		expect(organizationId()).toBe(organization("sk")["@id"]);
	});

	it("says nothing for a channel that is not a market", () => {
		expect(buildOrganizationJsonLd("xx-eur")).toBeNull();
		expect(buildWebSiteJsonLd("xx-eur")).toBeNull();
	});

	it("accepts the friendly market slug as well as the Saleor channel", () => {
		expect(buildOrganizationJsonLd("sk")).toEqual(buildOrganizationJsonLd("sk-eur"));
	});
});

describe("every identifying value comes from company.ts", () => {
	it("legal name, e-mail, phone and tax identifiers", () => {
		expect(organization("sk")).toMatchObject({
			legalName: companyInfo.legalName,
			email: companyInfo.email,
			telephone: companyInfo.phone,
			vatID: companyInfo.icDph,
			taxID: companyInfo.dic,
		});
		// And those are the values the owner signed off — so a wrong entry in company.ts
		// cannot pass merely by being copied faithfully.
		expect(organization("sk")).toMatchObject({
			legalName: "MAKY.STORE s. r. o.",
			vatID: "SK2122890660",
			taxID: "2122890660",
		});
	});

	it("the registered office as a PostalAddress", () => {
		expect(organization("sk").address).toEqual({
			"@type": "PostalAddress",
			streetAddress: companyInfo.street,
			postalCode: companyInfo.postalCode,
			addressLocality: companyInfo.locality,
			addressCountry: companyInfo.countryCode,
		});
		expect(organization("sk").address).toMatchObject({
			streetAddress: "Lermontovova 911/3",
			postalCode: "811 05",
			addressLocality: "Bratislava-Staré Mesto",
			addressCountry: "SK",
		});
	});

	it("the builder restates none of them", () => {
		const source = readFileSync(path.join(process.cwd(), "src/lib/seo/json-ld.ts"), "utf8");
		for (const literal of [
			companyInfo.legalName,
			companyInfo.street,
			companyInfo.postalCode,
			companyInfo.locality,
			companyInfo.email,
			companyInfo.phone,
			companyInfo.icDph,
			companyInfo.dic,
		]) {
			expect(source, literal).not.toContain(literal);
		}
	});

	it("the logo is a raster in public/ that meets Google's 112×112 minimum", () => {
		const logo = organization("sk").logo as string;
		expect(logo).toBe("https://maky.store/android-chrome-512x512.png");

		const png = readFileSync(path.join(process.cwd(), "public", new URL(logo).pathname));
		expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
		const width = png.readUInt32BE(16);
		const height = png.readUInt32BE(20);
		expect(width).toBeGreaterThanOrEqual(112);
		expect(height).toBeGreaterThanOrEqual(112);
		expect(width).toBe(height);
	});
});

describe("the return policy states the statutory window and nothing unconfirmed", () => {
	it("applies to exactly the twelve countries the shop sells to", () => {
		expect(returnPolicy("sk").applicableCountry).toEqual([
			"SK",
			"CZ",
			"DE",
			"AT",
			"PL",
			"HU",
			"IT",
			"FR",
			"ES",
			"RO",
			"US",
			"CA",
		]);
	});

	it.each(MARKETS)("%s: a finite 14-day window, linked to that market's own returns page", (market) => {
		expect(returnPolicy(market)).toEqual({
			"@type": "MerchantReturnPolicy",
			applicableCountry: expect.any(Array),
			returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
			// NOT 30: the extension is for signed-in registered customers only.
			merchantReturnDays: 14,
			merchantReturnLink: `https://maky.store/${market}/reklamacie-a-vratenie`,
		});
		// The link is a page this market actually serves — not a 404 with a return policy on it.
		expect(marketHasRoute(market, RETURNS_PAGE_PATH.slice(1))).toBe(true);
	});

	it("names no fee, no method, no return-shipping amount and no refund terms", () => {
		const policy = JSON.stringify(returnPolicy("sk"));
		for (const key of [
			"returnFees",
			"returnMethod",
			"returnShippingFeesAmount",
			"returnLabelSource",
			"customerRemorseReturnFees",
			"customerRemorseReturnShippingFeesAmount",
			"itemDefectReturnFees",
			"itemDefectReturnShippingFeesAmount",
			"restockingFee",
			"refundType",
		]) {
			expect(policy).not.toContain(`"${key}"`);
		}
	});
});

describe("the shipping policy states delivery times and never a price", () => {
	it("has no shipping rate anywhere — not a price, not a zero, not a percentage", () => {
		for (const market of MARKETS) {
			const markup = JSON.stringify(organization(market));
			expect(markup).not.toContain("shippingRate");
			expect(markup).not.toContain("MonetaryAmount");
			expect(markup).not.toContain("ShippingRateSettings");
			expect(markup).not.toContain("orderValue");
			expect(markup).not.toContain("doesNotShip");
		}
	});

	it("EU markets: 5–10 working days", () => {
		const [eu] = shippingConditions("sk");
		expect(destinationsOf(eu!)).toEqual(["SK", "CZ", "DE", "AT", "PL", "HU", "IT", "FR", "ES", "RO"]);
		expect(eu!.transitTime).toEqual({
			"@type": "ServicePeriod",
			duration: { "@type": "QuantitativeValue", minValue: 5, maxValue: 10, unitCode: "DAY" },
			businessDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
		});
	});

	it("US and Canada: 7–14 working days", () => {
		const [, northAmerica] = shippingConditions("sk");
		expect(destinationsOf(northAmerica!)).toEqual(["US", "CA"]);
		expect(northAmerica!.transitTime).toMatchObject({
			duration: { minValue: 7, maxValue: 14, unitCode: "DAY" },
		});
	});

	it("is a delivery service with exactly those two conditions, and names no carrier", () => {
		const service = organization("sk").hasShippingService as Json;
		expect(service["@type"]).toBe("ShippingService");
		expect(service.fulfillmentType).toBe("FulfillmentTypeDelivery");
		expect(shippingConditions("sk")).toHaveLength(2);
		const markup = JSON.stringify(service);
		expect(markup).not.toMatch(/fedex|slovensk/i);
	});

	it("every country the shop sells to has exactly one delivery window", () => {
		// A thirteenth market must get a decision, not a neighbour's promise.
		const listed = shippingConditions("sk").flatMap(destinationsOf);
		const countries = Object.values(CHANNEL_MAP).map((config) => config.country);
		expect([...listed].sort()).toEqual([...countries].sort());
	});

	it.each(MARKETS)("%s: the markup promises the same window as the badge beside every price", (market) => {
		// `common.onDemand` is what the customer reads ("dodanie 5–10 pracovných dní"). Two
		// statements of one promise, in two places: this is what keeps them one promise.
		const { country, locale } = CHANNEL_MAP[market]!;
		const condition = shippingConditions(market).find((c) => destinationsOf(c).includes(country))!;
		const { minValue, maxValue } = (condition.transitTime as { duration: Json }).duration;

		const messages = JSON.parse(
			readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8"),
		) as { common: { onDemand: string } };
		const numbers = messages.common.onDemand.match(/\d+/g)?.map(Number);
		expect(numbers, messages.common.onDemand).toEqual([minValue, maxValue]);
	});
});
