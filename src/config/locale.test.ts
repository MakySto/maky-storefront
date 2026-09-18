import { describe, expect, it } from "vitest";

import { CHANNEL_MAP } from "@/lib/channel-map";
import { catalogLanguageForMarket } from "@/lib/catalog-content/language";
import { getLocaleConfigByLocale } from "./locale";

/**
 * The Saleor language a market asks for is the code CFM writes for that market.
 *
 * COMMERCE-2 exact-locale contract v2 (`docs/contracts/commerce2/exact-locale-contract.json`):
 * nine languages are rendered from source, and two markets read a REGIONAL record seeded from
 * one of them — Austria `DE_AT` (from `DE`), Canada `EN_CA` (from `EN`). The United States
 * reads plain `EN`: CFM writes no `EN_US`, and asking for a code nobody writes makes the
 * exact-locale boundary refuse every product in that market — which is what the code did
 * before 41cc44e, when the United States asked for `EN_US`.
 *
 * The CFM catalogue CONTENT (vehicle pages) is a separate artifact, one per language: Austria
 * still reads `de` there and Canada `en`. That is why the two are pinned side by side below.
 */
const languageOf = (market: string) =>
	getLocaleConfigByLocale(CHANNEL_MAP[market].locale).graphqlLanguageCode as string;

const REGIONAL: Record<string, string> = { at: "DE_AT", ca: "EN_CA" };

describe("market → Saleor editorial language", () => {
	it("is the market's catalogue language, except where a regional record is agreed", () => {
		for (const market of Object.keys(CHANNEL_MAP)) {
			const catalogue = catalogLanguageForMarket(market)?.toUpperCase();
			const expected = REGIONAL[market] ?? catalogue;
			expect(languageOf(market), market).toBe(expected);
			// A regional code is always a region OF the catalogue language it shares pages with.
			expect(languageOf(market).split("_")[0], market).toBe(catalogue);
		}
	});

	it("gives Austria and Canada their own record, and keeps the United States on EN", () => {
		expect(languageOf("de")).toBe("DE");
		expect(languageOf("at")).toBe("DE_AT");
		expect(languageOf("us")).toBe("EN");
		expect(languageOf("ca")).toBe("EN_CA");
	});

	it("keeps the catalogue CONTENT language of the regional markets on the shared artifact", () => {
		expect(catalogLanguageForMarket("at")).toBe("de");
		expect(catalogLanguageForMarket("ca")).toBe("en");
	});
});
