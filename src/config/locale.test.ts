import { describe, expect, it } from "vitest";

import { CHANNEL_MAP } from "@/lib/channel-map";
import { catalogLanguageForMarket } from "@/lib/catalog-content/language";
import { getLocaleConfigByLocale } from "./locale";

/**
 * The Saleor language a market asks for is the language CFM writes — one per language.
 *
 * CFM publishes one translation per language (9 157 products × 9 languages) and the
 * catalogue content the same way, so the two languages a market reads must not disagree.
 * They did for US and CA: the product queries asked for `EN_US` and `EN_CA`, CFM writes
 * `EN`, and the exact-locale boundary would have refused every product in both markets.
 */
const languageOf = (market: string) =>
	getLocaleConfigByLocale(CHANNEL_MAP[market].locale).graphqlLanguageCode as string;

describe("market → Saleor editorial language", () => {
	it("is the CFM language of every market", () => {
		for (const market of Object.keys(CHANNEL_MAP)) {
			expect(languageOf(market), market).toBe(catalogLanguageForMarket(market)?.toUpperCase());
		}
	});

	it("shares one row between the markets of one language", () => {
		expect(languageOf("at")).toBe("DE");
		expect(languageOf("de")).toBe("DE");
		expect(languageOf("us")).toBe("EN");
		expect(languageOf("ca")).toBe("EN");
	});
});
