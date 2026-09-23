import { afterEach, describe, expect, it, vi } from "vitest";

import type { PresenceMap } from "@/lib/saleor/product-presence";
import type { ResourceOutcome } from "@/lib/saleor/resource-outcome";

/**
 * The PDP's counterparts — its hreflang cluster and the market switcher's targets — come from
 * ONE presence answer per product, asked by product id, and each market comes back at that
 * market's own slug. A fault is not an answer about any market: the page names only itself.
 */
async function counterpartsWith(markets: string, answer: ResourceOutcome<PresenceMap>) {
	vi.resetModules();
	vi.stubEnv("MAKY_LIVE_MARKETS", markets);
	const { productCounterparts } = await import("./product-counterparts");
	const asked: [string, string][] = [];
	const presence = async (productId: string, baseSlug: string) => {
		asked.push([productId, baseSlug]);
		return answer;
	};
	return { productCounterparts, presence, asked };
}

afterEach(() => vi.unstubAllEnvs());

const ID = "UHJvZHVjdDox";
const BASE = "stresny-nosic-nordrive-helio-black-2004-2007";
const PRESENCE: ResourceOutcome<PresenceMap> = {
	status: "found",
	resource: {
		sk: { status: "found", slug: BASE },
		cz: { status: "found", slug: "stresni-nosic-nordrive-helio-black-cfmp-1" },
		de: { status: "found", slug: "dachtrager-nordrive-helio-black-cfmp-1" },
		at: { status: "found", slug: "dachtraeger-nordrive-helio-black-at-cfmp-1" },
		pl: { status: "not-found" },
	},
};

describe("productCounterparts", () => {
	it("asks the presence query once, by product id, and returns each market at its own slug", async () => {
		const { productCounterparts, presence, asked } = await counterpartsWith("sk,cz,de,at", PRESENCE);

		const result = await productCounterparts(
			{ id: ID, slug: "dachtrager-nordrive-helio-black-cfmp-1", baseSlug: BASE },
			"de-eur",
			presence,
		);

		expect(asked).toEqual([[ID, BASE]]);
		expect(result).toEqual([
			{ market: "de", path: "/dachtrager-nordrive-helio-black-cfmp-1" },
			{ market: "sk", path: `/${BASE}` },
			{ market: "cz", path: "/stresni-nosic-nordrive-helio-black-cfmp-1" },
			{ market: "at", path: "/dachtraeger-nordrive-helio-black-at-cfmp-1" },
		]);
	});

	it("leaves out a live market where the product is not, and asks nothing with Slovakia alone live", async () => {
		const partial = await counterpartsWith("sk,cz,pl", PRESENCE);
		expect(
			(
				await partial.productCounterparts({ id: ID, slug: BASE, baseSlug: BASE }, "sk-eur", partial.presence)
			).map((c) => c.market),
		).toEqual(["sk", "cz"]);

		const alone = await counterpartsWith("sk", PRESENCE);
		expect(
			await alone.productCounterparts({ id: ID, slug: BASE, baseSlug: BASE }, "sk-eur", alone.presence),
		).toEqual([{ market: "sk", path: `/${BASE}` }]);
		expect(alone.asked).toEqual([]);
	});

	it("names only the page itself when the presence query failed — never a guess", async () => {
		const failed = await counterpartsWith("sk,cz,de", {
			status: "upstream-error",
			type: "http",
			retryable: true,
			message: "HTTP 503",
		});
		expect(
			await failed.productCounterparts({ id: ID, slug: BASE, baseSlug: BASE }, "sk-eur", failed.presence),
		).toEqual([{ market: "sk", path: `/${BASE}` }]);
	});
});
