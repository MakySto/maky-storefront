import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/graphql", () => ({ executePublicGraphQL: vi.fn(), executeRawGraphQL: vi.fn() }));
vi.mock("@/lib/cms/brands", () => ({ getCmsBrands: vi.fn() }));

const { mergeBrands, HOMEPAGE_BRAND_SLUGS } = await import("./catalog");

const logo = {
	id: "1",
	url: "https://cms-media.maky.store/media/thule.png",
	alt: "Thule",
	width: 400,
	height: 120,
	mimeType: "image/png",
	sizes: {},
	focalX: 50,
	focalY: 50,
};

describe("brand catalogue", () => {
	it("lists Saleor's makers alphabetically, dressed with the Payload entry of the same slug", () => {
		const brands = mergeBrands(
			[
				{ slug: "yakima", name: "Yakima", productCount: 4 },
				{ slug: "thule", name: "Thule", productCount: 40 },
				{ slug: "kjust", name: "KJUST", productCount: 24 },
			],
			[
				{
					slug: "thule",
					name: "THULE (CMS spelling)",
					shortDescription: "Švédska značka.",
					logo,
					heroImage: null,
				},
				{ slug: "dometic", name: "Dometic", shortDescription: null, logo: null, heroImage: null },
			],
		);
		expect(brands.map((brand) => brand.slug)).toEqual(["kjust", "thule", "yakima"]);
		const thule = brands.find((brand) => brand.slug === "thule")!;
		// Saleor's name stays: it is what the product cards print.
		expect(thule).toMatchObject({
			name: "Thule",
			productCount: 40,
			approved: true,
			shortDescription: "Švédska značka.",
		});
		expect(thule.logo?.url).toBe(logo.url);
		expect(brands.find((brand) => brand.slug === "kjust")?.approved).toBe(false);
		// A Payload entry with no Saleor maker gets no page.
		expect(brands.some((brand) => brand.slug === "dometic")).toBe(false);
	});

	it("promotes only the makers CLAUDE.md §6 approves for the homepage", () => {
		expect(HOMEPAGE_BRAND_SLUGS).toEqual([
			"thule",
			"yakima",
			"menabo",
			"nordrive",
			"peruzzo",
			"pro-user",
			"spinder",
			"green-valley",
			"snowdrive",
			"dac",
		]);
		for (const banned of ["cruz", "hak-system", "galia", "oris", "jaeger", "dometic", "ikamper"]) {
			expect(HOMEPAGE_BRAND_SLUGS).not.toContain(banned);
		}
	});
});
