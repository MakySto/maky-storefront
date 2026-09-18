import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import { productAnswerTags, productMissTagFor } from "./product-cache-tags";

/**
 * A PDP entry is keyed by its URL slug. Abroad that is the translated slug, while every
 * revalidation event names the base slug — so these extra tags are what lets an event reach
 * the translated-slug entry at all.
 */
describe("the extra tags on a cached product answer", () => {
	it("tags a product found abroad at its translated URL with its base slug", () => {
		expect(
			productAnswerTags(
				{ channel: "de-eur", locale: "de-DE", slug: "dachtrager-nordrive-cfmp-b-nor-1" },
				{ status: "found", baseSlug: "stresny-nosic-nordrive-1" },
			),
		).toEqual(["product:de-eur:de-DE:stresny-nosic-nordrive-1"]);
	});

	it("adds nothing when the URL already is the base slug (an old URL still rendering abroad)", () => {
		expect(
			productAnswerTags(
				{ channel: "at-eur", locale: "de-AT", slug: "stresny-nosic-nordrive-1" },
				{ status: "found", baseSlug: "stresny-nosic-nordrive-1" },
			),
		).toEqual([]);
	});

	it("tags a miss abroad with the channel's miss tag — it has no base slug to be named by", () => {
		expect(
			productAnswerTags(
				{ channel: "at-eur", locale: "de-AT", slug: "dachtraeger-neu" },
				{ status: "not-found" },
			),
		).toEqual(["product-miss:at-eur:de-AT"]);
		expect(productMissTagFor("ca-cad", "en-CA")).toBe("product-miss:ca-cad:en-CA");
	});

	it("leaves Slovakia exactly as it was: no extra tag on a hit or on a miss, and nothing to purge", () => {
		expect(
			productAnswerTags(
				{ channel: "sk-eur", locale: "sk-SK", slug: "novy-slug" },
				{ status: "found", baseSlug: "stary-slug" },
			),
		).toEqual([]);
		expect(
			productAnswerTags({ channel: "sk-eur", locale: "sk-SK", slug: "x" }, { status: "not-found" }),
		).toEqual([]);
		expect(productMissTagFor("sk-eur", "sk-SK")).toBeNull();
	});
});
