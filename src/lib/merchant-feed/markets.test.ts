import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { CHANNEL_MAP } from "@/lib/channel-map";
import { type FeedProduct, feedItemsFor } from "./item";

const { renderItem } = await import("../../../scripts/ops/merchant-feed.mjs");

/**
 * The markets the nightly writer is told to make a feed for (the unit installed on the web server), and
 * what an item of a foreign market states. Merchant Center has delivery set for all eleven foreign
 * countries, and the feed carries the weight, so the unit lists every market. Nothing here decides what
 * an item says (`item.test.ts` does); it checks that the list is one the writer can walk and that the
 * market, not the Slovak page, decides price, currency, address and waiting time.
 */

const unit = readFileSync(join(process.cwd(), "scripts/ops/systemd/maky-merchant-feed.service"), "utf8");
const listed = /merchant-feed\.mjs --markets ([a-z,]+) --write/.exec(unit)?.[1]?.split(",") ?? [];

describe("the markets of the nightly feed run", () => {
	it("names markets the shop has, each once, the pilot first", () => {
		expect(listed.length).toBeGreaterThan(0);
		expect(new Set(listed).size).toBe(listed.length);
		for (const market of listed) expect(CHANNEL_MAP[market], market).toBeDefined();
		expect(listed[0]).toBe("sk");
	});

	it("names every market there is", () => {
		expect([...listed].sort()).toEqual(Object.keys(CHANNEL_MAP).sort());
	});

	it("leaves the run time for them: the longest wait is above the 90 minutes the pilot had", () => {
		const minutes = Number(/^TimeoutStartSec=(\d+)min$/m.exec(unit)?.[1]);
		expect(minutes).toBeGreaterThanOrEqual(120);
	});
});

const heavy = (channel: string, amount: number): FeedProduct => {
	const currency = Object.values(CHANNEL_MAP).find((config) => config.saleorSlug === channel)!.currency;
	return {
		id: "UHJvZHVjdDox",
		name: "Cargo box",
		slug: "cargo-box",
		isAvailableForPurchase: true,
		attributes: [
			{ attribute: { externalReference: "cfm:attribute:manufacturer" }, values: [{ name: "Thule" }] },
		],
		media: [{ id: "m1", url: "https://media.maky.store/a.jpg", type: "IMAGE", sortOrder: 0 }],
		variants: [
			{
				id: "UHJvZHVjdFZhcmlhbnQ6MQ==",
				name: "box",
				quantityAvailable: 5,
				trackInventory: false,
				metafield: "sale_to_order",
				weight: { value: 31.4, unit: "KG" },
				pricing: {
					price: { gross: { amount, currency } },
					priceUndiscounted: { gross: { amount, currency } },
				},
			},
		],
		pricing: {
			priceRange: { start: { gross: { amount, currency } }, stop: { gross: { amount, currency } } },
		},
	} as FeedProduct;
};

describe("an item of a foreign market", () => {
	beforeEach(() => {
		process.env.NEXT_PUBLIC_STOREFRONT_URL = "https://maky.store";
	});

	const foreign = Object.entries(CHANNEL_MAP).filter(([market]) => market !== "sk");

	it.each(foreign)(
		"%s: the market's currency, its own address and the weight in the file",
		(market, config) => {
			const outcome = feedItemsFor(heavy(config.saleorSlug, 249), config.saleorSlug);
			expect(outcome.skipped).toBeNull();
			const item = outcome.items[0]!;

			expect(item.price).toEqual({ amount: 249, currency: config.currency });
			expect(item.link.startsWith(`https://maky.store/${market}/`)).toBe(true);
			expect(item.shippingWeight).toEqual({ value: 31.4, unit: "kg" });

			const xml = renderItem(item, { now: new Date("2026-11-30T05:05:00Z") });
			expect(xml).toContain("<g:shipping_weight>31.4 kg</g:shipping_weight>");
			expect(xml).toContain(`<g:price>249.00 ${config.currency}</g:price>`);
		},
	);

	it("waits as the badge says: 10 working days in the EU, 14 in the US and Canada", () => {
		const date = (market: string) => {
			const channel = CHANNEL_MAP[market]!.saleorSlug;
			const item = feedItemsFor(heavy(channel, 249), channel).items[0]!;
			return renderItem(item, { now: new Date("2026-11-30T05:05:00Z") }).match(
				/<g:availability_date>(.*?)</,
			)?.[1];
		};
		expect(date("de")).toBe("2026-12-14T00:00Z");
		expect(date("us")).toBe("2026-12-18T00:00Z");
		expect(date("ca")).toBe("2026-12-18T00:00Z");
	});
});
