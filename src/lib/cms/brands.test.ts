import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const { brandsFromDocs } = await import("./brands");

const media = (name: string) => ({
	id: name,
	url: `https://cms-media.maky.store/media/${name}.png`,
	alt: name,
	mimeType: "image/png",
	width: 400,
	height: 120,
	sizes: {},
});

describe("CMS brand entries", () => {
	it("reads a published entry for this market, with a usable logo", () => {
		const [thule] = brandsFromDocs(
			[
				{
					slug: "thule",
					name: "Thule",
					shortDescription: " Švédska značka. ",
					logo: media("thule"),
					markets: null,
				},
			],
			"SK",
		);
		expect(thule).toMatchObject({ slug: "thule", name: "Thule", shortDescription: "Švédska značka." });
		expect(thule?.logo?.url).toBe("https://cms-media.maky.store/media/thule.png");
	});

	it("skips another market's entry, a malformed slug, and a logo from outside the CDN", () => {
		const brands = brandsFromDocs(
			[
				{ slug: "yakima", name: "Yakima", markets: ["CZ"] },
				{ slug: "Pro USER", name: "Pro-USER" },
				{
					slug: "menabo",
					name: "Menabo",
					logo: { ...media("menabo"), url: "https://evil.example/menabo.png" },
				},
				"not an object",
			],
			"SK",
		);
		expect(brands).toHaveLength(1);
		expect(brands[0]).toMatchObject({ slug: "menabo", logo: null });
	});
});
