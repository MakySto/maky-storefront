import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResourceOutcome } from "@/lib/saleor/resource-outcome";

/**
 * The PDP's counterparts — its hreflang cluster and the market switcher's targets — are asked
 * by the product's BASE slug in every other live market, and each comes back at that market's
 * own slug. Asking by the URL slug found nothing as soon as the URL was a translated one.
 */
async function counterpartsWith(markets: string, lookupTable: Record<string, Record<string, string>>) {
	vi.resetModules();
	vi.stubEnv("MAKY_LIVE_MARKETS", markets);
	const { productCounterparts } = await import("./product-counterparts");
	const asked: [string, string][] = [];
	const lookup = async (slug: string, channel: string): Promise<ResourceOutcome<{ slug: string }>> => {
		asked.push([slug, channel]);
		const found = lookupTable[channel]?.[slug];
		return found ? { status: "found", resource: { slug: found } } : { status: "not-found" };
	};
	return { productCounterparts, lookup, asked };
}

afterEach(() => vi.unstubAllEnvs());

const BASE = "stresny-nosic-nordrive-helio-black-2004-2007";
const TABLE = {
	"sk-eur": { [BASE]: BASE },
	"cz-czk": { [BASE]: "stresni-nosic-nordrive-helio-black-cfmp-1" },
	"at-eur": { [BASE]: "dachtraeger-nordrive-helio-black-at-cfmp-1" },
};

describe("productCounterparts", () => {
	it("asks every other live market by the BASE slug and gets back that market's own slug", async () => {
		const { productCounterparts, lookup, asked } = await counterpartsWith("sk,cz,de,at", TABLE);

		const result = await productCounterparts(
			{ slug: "dachtrager-nordrive-helio-black-cfmp-1", baseSlug: BASE },
			"de-eur",
			lookup,
		);

		expect(asked).toEqual([
			[BASE, "sk-eur"],
			[BASE, "cz-czk"],
			[BASE, "at-eur"],
		]);
		expect(result).toEqual([
			{ market: "de", path: "/dachtrager-nordrive-helio-black-cfmp-1" },
			{ market: "sk", path: `/${BASE}` },
			{ market: "cz", path: "/stresni-nosic-nordrive-helio-black-cfmp-1" },
			{ market: "at", path: "/dachtraeger-nordrive-helio-black-at-cfmp-1" },
		]);
	});

	it("leaves out a live market where the product does not exist, and asks nothing with Slovakia alone live", async () => {
		const partial = await counterpartsWith("sk,cz,pl", TABLE);
		expect(
			(await partial.productCounterparts({ slug: BASE, baseSlug: BASE }, "sk-eur", partial.lookup)).map(
				(c) => c.market,
			),
		).toEqual(["sk", "cz"]);

		const alone = await counterpartsWith("sk", TABLE);
		expect(await alone.productCounterparts({ slug: BASE, baseSlug: BASE }, "sk-eur", alone.lookup)).toEqual([
			{ market: "sk", path: `/${BASE}` },
		]);
		expect(alone.asked).toEqual([]);
	});
});
