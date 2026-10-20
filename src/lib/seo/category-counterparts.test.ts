import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResourceOutcome } from "@/lib/saleor/resource-outcome";

/**
 * The category page's counterparts — its hreflang cluster and the market switcher's targets —
 * come from ONE presence answer per category, asked by base slug. The page's own market is not
 * in that answer: the page decides it from the head it has just read. A fault is not an answer
 * about any market: the page then names only itself.
 */
async function counterpartsWith(markets: string, answer: ResourceOutcome<readonly string[]>) {
	vi.resetModules();
	vi.stubEnv("MAKY_LIVE_MARKETS", markets);
	const { categoryCounterparts } = await import("./category-counterparts");
	const { categoryUrlFor } = await import("@/config/category-routes");
	const asked: string[] = [];
	const presence = async (baseSlug: string) => {
		asked.push(baseSlug);
		return answer;
	};
	return { categoryCounterparts, categoryUrlFor, presence, asked };
}

afterEach(() => vi.unstubAllEnvs());

const BASE = "autochladnicky";
const listed = (...markets: string[]): ResourceOutcome<readonly string[]> => ({
	status: "found",
	resource: markets,
});

describe("categoryCounterparts", () => {
	it("asks the presence query once, by base slug, and returns each listed market at its own root URL", async () => {
		const { categoryCounterparts, categoryUrlFor, presence, asked } = await counterpartsWith(
			"sk,cz,de,at,ro",
			listed("sk", "cz", "de", "ro"),
		);

		const result = await categoryCounterparts(BASE, "de-eur", true, presence);

		expect(asked).toEqual([BASE]);
		expect(result).toEqual([
			{ market: "sk", path: categoryUrlFor("sk", BASE) },
			{ market: "cz", path: categoryUrlFor("cz", BASE) },
			{ market: "de", path: categoryUrlFor("de", BASE) },
			{ market: "ro", path: categoryUrlFor("ro", BASE) },
		]);
		// Not vacuous: the localized roots really differ from the base slug.
		expect(result.find((c) => c.market === "de")!.path).toBe("/kuehlboxen-fuers-auto");
		expect(result.find((c) => c.market === "ro")!.path).toBe("/frigidere-auto");
	});

	it("leaves out a live market that is not listed", async () => {
		const { categoryCounterparts, presence } = await counterpartsWith("sk,cz,pl", listed("sk", "cz"));
		const result = await categoryCounterparts(BASE, "sk-eur", true, presence);
		expect(result.map((c) => c.market)).toEqual(["sk", "cz"]);
	});

	it("decides the page's own market from what the page knows, not from the presence entry", async () => {
		// The entry still remembers the page's market as empty; the page has just read it stocked.
		const stale = await counterpartsWith("sk,cz", listed("sk"));
		expect(
			(await stale.categoryCounterparts(BASE, "cz-czk", true, stale.presence)).map((c) => c.market),
		).toEqual(["sk", "cz"]);

		// And the other way round: the entry lists the page's market, the page itself is empty.
		const empty = await counterpartsWith("sk,cz", listed("sk", "cz"));
		expect(
			(await empty.categoryCounterparts(BASE, "cz-czk", false, empty.presence)).map((c) => c.market),
		).toEqual(["sk"]);
	});

	it("asks nothing with the page's own market alone live", async () => {
		const alone = await counterpartsWith("sk", listed("sk"));
		expect(await alone.categoryCounterparts(BASE, "sk-eur", true, alone.presence)).toEqual([
			{ market: "sk", path: `/${BASE}` },
		]);
		expect(alone.asked).toEqual([]);
	});

	it("names only the page itself when the presence query failed — never a guess", async () => {
		const failed = await counterpartsWith("sk,cz,de", {
			status: "upstream-error",
			type: "network",
			retryable: true,
			message: "CategoryMarketPresence: deadline exceeded",
		});
		expect(await failed.categoryCounterparts(BASE, "sk-eur", true, failed.presence)).toEqual([
			{ market: "sk", path: `/${BASE}` },
		]);
		expect(await failed.categoryCounterparts(BASE, "sk-eur", false, failed.presence)).toEqual([]);
	});

	it("keeps the live-market order whatever order the answer comes in", async () => {
		const { categoryCounterparts, presence } = await counterpartsWith(
			"sk,cz,de,at",
			listed("at", "de", "cz", "sk"),
		);
		const result = await categoryCounterparts(BASE, "cz-czk", true, presence);
		expect(result.map((c) => c.market)).toEqual(["sk", "cz", "de", "at"]);
	});
});
