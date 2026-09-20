import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	MARKET_SLUG_REDIRECTS_SCHEMA,
	marketSlugRedirect,
	marketSlugRedirectStatus,
	parseMarketSlugRedirects,
	resetMarketSlugRedirectsForTests,
	sameCfmProduct,
} from "./market-slug-redirects";

const entry = (over: Partial<Record<string, string>> = {}) => ({
	cfm_product_id: "CFMP-B-NOR-a51bec20924e7e-000000",
	language_code: "DE_AT",
	old_slug:
		"dachtrager-nordrive-helio-silver-audi-80-avant-19911995-offene-dachreling-cfmp-b-nor-a51bec20924e7e-000000",
	new_slug: "dachtrager-nordrive-helio-silver-audi-80-avant-1991-1995-offene-dachreling",
	...over,
});

const file = (entries: unknown[], schema: string = MARKET_SLUG_REDIRECTS_SCHEMA) =>
	JSON.stringify({ schema, entries });

function deliver(text: string, { sha256 = true }: { sha256?: boolean | string } = {}) {
	const dir = mkdtempSync(join(tmpdir(), "maky-redirects-"));
	const path = join(dir, "MARKET_SLUG_REDIRECTS_apply.json");
	writeFileSync(path, text);
	vi.stubEnv("MAKY_MARKET_SLUG_REDIRECTS_PATH", path);
	if (sha256 === true) {
		vi.stubEnv("MAKY_MARKET_SLUG_REDIRECTS_SHA256", createHash("sha256").update(text).digest("hex"));
	} else if (typeof sha256 === "string") {
		vi.stubEnv("MAKY_MARKET_SLUG_REDIRECTS_SHA256", sha256);
	}
	resetMarketSlugRedirectsForTests();
	return path;
}

afterEach(() => {
	vi.unstubAllEnvs();
	resetMarketSlugRedirectsForTests();
	vi.restoreAllMocks();
});

describe("the CFM map, read the way the contract spells it", () => {
	it("files each entry under the ONE market that reads its language code", () => {
		const index = parseMarketSlugRedirects(
			file([
				entry(),
				entry({ language_code: "DE", old_slug: "dachtrager-alt-cfmp", new_slug: "dachtrager-neu" }),
				entry({ language_code: "EN", old_slug: "roof-rack-old-cfmp", new_slug: "roof-rack-new" }),
				entry({ language_code: "EN_CA", old_slug: "roof-rack-old-cfmp", new_slug: "roof-rack-new-ca" }),
				entry({ language_code: "CS", old_slug: "stresni-nosic-old-cfmp", new_slug: "stresni-nosic-novy" }),
			]),
		);

		expect(index.entries).toBe(5);
		expect([...index.byMarket.keys()].sort()).toEqual(["at", "ca", "cz", "de", "us"]);
		expect(index.byMarket.get("at")!.get(entry().old_slug)!.newSlug).toBe(entry().new_slug);
		// One old slug, two English markets, two records: Canada's target is its own.
		expect(index.byMarket.get("us")!.get("roof-rack-old-cfmp")!.newSlug).toBe("roof-rack-new");
		expect(index.byMarket.get("ca")!.get("roof-rack-old-cfmp")!.newSlug).toBe("roof-rack-new-ca");
		// Austria's entry is Austria's alone — Germany reads the DE record.
		expect(index.byMarket.get("de")!.get(entry().old_slug)).toBeUndefined();
		expect(index.markets).toBe(5);
	});

	it("refuses a code no market reads — SK, EN_US, a typo — instead of guessing one", () => {
		const index = parseMarketSlugRedirects(
			file([
				entry({ language_code: "SK" }),
				entry({ language_code: "EN_US" }),
				entry({ language_code: "DE_CH" }),
			]),
		);

		expect(index.entries).toBe(0);
		expect(index.skipped["language-no-market-reads"]).toBe(3);
	});

	it("takes nothing at all from a file that is not this contract", () => {
		expect(parseMarketSlugRedirects(file([entry()], "cfm.something.else/9")).entries).toBe(0);
		expect(parseMarketSlugRedirects("{oops").skipped["unparsable-json"]).toBe(1);
		expect(parseMarketSlugRedirects(JSON.stringify({ schema: MARKET_SLUG_REDIRECTS_SCHEMA })).entries).toBe(
			0,
		);
	});

	it("drops an entry it could not use as a URL, and says which", () => {
		const index = parseMarketSlugRedirects(
			file([
				entry({ new_slug: "" }),
				entry({ cfm_product_id: "" }),
				entry({ new_slug: "Dachtraeger-Neu" }),
				entry({ new_slug: "dach/traeger" }),
				entry({ old_slug: "a/b" }),
				entry({ old_slug: "same-slug", new_slug: "same-slug" }),
			]),
		);

		expect(index.entries).toBe(0);
		expect(index.skipped).toEqual({ "incomplete-entry": 2, "unusable-slug": 3, "same-slug": 1 });
	});

	it("sends one visitor one hop when a slug was replaced twice", () => {
		const index = parseMarketSlugRedirects(
			file([
				entry({ old_slug: "first-cfmp", new_slug: "second" }),
				entry({ old_slug: "second", new_slug: "third" }),
			]),
		);

		expect(index.byMarket.get("at")!.get("first-cfmp")!.newSlug).toBe("third");
		expect(index.byMarket.get("at")!.get("second")!.newSlug).toBe("third");
	});

	it("drops a cycle rather than bouncing a visitor between two URLs", () => {
		const index = parseMarketSlugRedirects(
			file([
				entry({ old_slug: "a-cfmp", new_slug: "b-cfmp" }),
				entry({ old_slug: "b-cfmp", new_slug: "a-cfmp" }),
			]),
		);

		expect(index.entries).toBe(0);
		expect(index.skipped["chain-loops-or-too-long"]).toBe(2);
	});

	it("abandons a chain that would hand one product's URL to another", () => {
		const index = parseMarketSlugRedirects(
			file([
				entry({ old_slug: "mine-cfmp", new_slug: "handed-over" }),
				entry({
					cfm_product_id: "CFMP-B-NOR-999999999999-000000",
					old_slug: "handed-over",
					new_slug: "theirs",
				}),
			]),
		);

		expect(index.byMarket.get("at")!.get("mine-cfmp")).toBeUndefined();
		expect(index.byMarket.get("at")!.get("handed-over")!.newSlug).toBe("theirs");
		expect(index.skipped["chain-crosses-products"]).toBe(1);
	});

	it("drops an old slug two products claim — a guess there is the foreign product the contract forbids", () => {
		const index = parseMarketSlugRedirects(
			file([
				entry({ old_slug: "contested-cfmp", new_slug: "target-one" }),
				entry({
					cfm_product_id: "CFMP-B-NOR-999999999999-000000",
					old_slug: "contested-cfmp",
					new_slug: "target-two",
				}),
			]),
		);

		expect(index.entries).toBe(0);
		expect(index.skipped["ambiguous-old-slug"]).toBe(1);
	});
});

describe("Saleor identity against CFM identity", () => {
	it("matches across the cfm:product: prefix and case, and never on an empty one", () => {
		expect(
			sameCfmProduct("cfm:product:CFMP-B-NOR-a51bec20924e7e-000000", "CFMP-B-NOR-a51bec20924e7e-000000"),
		).toBe(true);
		expect(
			sameCfmProduct("CFMP-B-NOR-a51bec20924e7e-000000", "cfm:product:CFMP-B-NOR-a51bec20924e7e-000000"),
		).toBe(true);
		expect(
			sameCfmProduct("cfm:product:cfmp-b-nor-a51bec20924e7e-000000", "CFMP-B-NOR-a51bec20924e7e-000000"),
		).toBe(true);
		expect(
			sameCfmProduct("cfm:product:CFMP-B-NOR-999999999999-000000", "CFMP-B-NOR-a51bec20924e7e-000000"),
		).toBe(false);
		expect(sameCfmProduct(null, "CFMP-B-NOR-a51bec20924e7e-000000")).toBe(false);
		expect(sameCfmProduct("cfm:product:", "")).toBe(false);
	});
});

describe("the delivered file", () => {
	it("is read once, pinned by sha256, and answers for the market it names", () => {
		deliver(file([entry()]));

		expect(marketSlugRedirect("at", entry().old_slug)).toEqual({
			cfmProductId: entry().cfm_product_id,
			newSlug: entry().new_slug,
		});
		expect(marketSlugRedirect("de", entry().old_slug)).toBeNull();
		expect(marketSlugRedirectStatus().entries).toBe(1);
	});

	it("redirects nothing when the bytes are not the ones that were pinned", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		deliver(file([entry()]), { sha256: "a".repeat(64) });

		expect(marketSlugRedirect("at", entry().old_slug)).toBeNull();
		expect(marketSlugRedirectStatus().note).toMatch(/sha256 mismatch/);
		expect(error).toHaveBeenCalled();
	});

	it("redirects nothing when there is no file, or the path is wrong", () => {
		resetMarketSlugRedirectsForTests();
		expect(marketSlugRedirect("at", entry().old_slug)).toBeNull();
		expect(marketSlugRedirectStatus().note).toMatch(/no MAKY_MARKET_SLUG_REDIRECTS_PATH/);

		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.stubEnv("MAKY_MARKET_SLUG_REDIRECTS_PATH", "/no/such/file.json");
		resetMarketSlugRedirectsForTests();
		expect(marketSlugRedirect("at", entry().old_slug)).toBeNull();
		expect(marketSlugRedirectStatus().note).toMatch(/unreadable/);
	});
});
