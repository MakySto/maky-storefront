import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Slovak product fetch carries the product's own tag, so the revalidation event's IMMEDIATE
 * tag purge reaches it whoever reads it — the page, or the crawler preflight's internal route,
 * whose implicit path tags are not the page's (review of 73f2521, 2026-09-27).
 */

const { executePublicGraphQL } = vi.hoisted(() => ({ executePublicGraphQL: vi.fn() }));
vi.mock("@/lib/graphql", () => ({ executePublicGraphQL }));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

import { buildTag, CACHE_PROFILES } from "@/lib/cache-manifest";
import { getProductOutcome } from "./product-outcome";

beforeEach(() => {
	executePublicGraphQL.mockReset();
	executePublicGraphQL.mockResolvedValue({ ok: true, data: { product: null } });
});

type Options = { revalidate?: number; tags?: readonly string[] };
const optionsOf = (call: unknown[]) => call[1] as Options;

describe("the product fetch's cache", () => {
	it("in Slovakia: cached 300 s AND tagged with the tag the product event expires", async () => {
		await getProductOutcome("stresny-nosic-x", "sk-eur");
		const options = optionsOf(executePublicGraphQL.mock.calls[0]!);
		expect(options.revalidate).toBe(300);
		expect(options.tags).toEqual([
			buildTag(CACHE_PROFILES.products, { channel: "sk-eur", locale: "sk-SK", slug: "stresny-nosic-x" }),
		]);
		expect(options.tags).toEqual(["product:sk-eur:sk-SK:stresny-nosic-x"]);
	});

	it("abroad: not fetch-cached at all, so the entry's own tags are the whole story", async () => {
		await getProductOutcome("dachtraeger-x", "de-eur");
		for (const call of executePublicGraphQL.mock.calls) expect(optionsOf(call).revalidate).toBe(0);
	});
});
