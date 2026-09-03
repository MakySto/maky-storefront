import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import { CACHE_PROFILES, buildPath, buildTag } from "./cache-manifest";

describe("localized cache identities", () => {
	it("separates the same slug across channel and locale", () => {
		const sk = buildTag(CACHE_PROFILES.products, {
			channel: "sk-eur",
			locale: "sk-SK",
			slug: "strecha",
		});
		const de = buildTag(CACHE_PROFILES.products, {
			channel: "de-eur",
			locale: "de-DE",
			slug: "strecha",
		});
		expect(sk).toBe("product:sk-eur:sk-SK:strecha");
		expect(de).toBe("product:de-eur:de-DE:strecha");
		expect(sk).not.toBe(de);
	});

	it("builds the localized route independently of the cache tag", () => {
		expect(
			buildPath(CACHE_PROFILES.products, {
				channel: "de-eur",
				locale: "de-DE",
				slug: "dachtraeger",
			}),
		).toBe("/de-eur/dachtraeger");
	});
});
