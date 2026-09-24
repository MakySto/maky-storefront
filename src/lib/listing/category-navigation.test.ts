import { describe, expect, it, vi } from "vitest";

import { CHANNEL_MAP } from "@/lib/channel-map";

vi.mock("@/lib/graphql", () => ({ executePublicGraphQL: vi.fn() }));

const { buildCategoryNavigation } = await import("./category-navigation");

/**
 * The row of sub-categories and the breadcrumb parent, built from the tree Saleor answers
 * with. Shapes and counts are the live sk-eur tree of 2026-09-24; the exact-locale gate and
 * the URL builder are the real ones.
 */

const SK = CHANNEL_MAP.sk.saleorSlug;
const DE = CHANNEL_MAP.de.saleorSlug;

type Node = {
	id: string;
	slug: string;
	name: string;
	translation?: Record<string, string> | null;
	products: { totalCount: number };
	accessoryProducts?: { totalCount: number };
};

const node = (
	slug: string,
	name: string,
	count: number,
	accessories = 0,
	extra: Partial<Node> = {},
): Node => ({
	id: `id-${slug}`,
	slug,
	name,
	translation: null,
	products: { totalCount: count },
	accessoryProducts: { totalCount: accessories },
	...extra,
});
const edges = (nodes: Node[]) => ({ edges: nodes.map((n) => ({ node: n })) });

// Saleor's own order for these children — accessories in the middle, an empty one first.
const BIKE_CHILDREN = [
	node("drziaky-a-stojany-na-bicykle", "Držiaky a stojany na bicykle", 0),
	node("nosice-bicyklov-na-strechu", "Nosiče bicyklov na strechu", 18),
	node("nosice-bicyklov-na-tazne-zariadenie", "Nosiče bicyklov na ťažné zariadenie", 40),
	node("nahradne-diely-k-nosicom-bicyklov", "Náhradné diely k nosičom bicyklov", 56, 56),
	node("prislusenstvo-k-nosicom-bicyklov", "Príslušenstvo k nosičom bicyklov", 70, 70),
	node("nosice-bicyklov-na-zadne-dvere", "Nosiče bicyklov na zadné dvere", 4),
];
const BIKES = node("nosice-bicyklov", "Nosiče bicyklov", 188, 126);

describe("category navigation", () => {
	it("lists a parent's sub-categories with products, carriers before accessories, 'Všetko' first", () => {
		const navigation = buildCategoryNavigation(
			{ ...BIKES, parent: null, children: edges(BIKE_CHILDREN) },
			SK,
			"sk-SK",
		);

		expect(navigation.parent).toBeNull();
		expect(navigation.chips?.map((chip) => [chip.label, chip.current])).toEqual([
			[null, true], // "Všetko"
			["Na strechu", false],
			["Na ťažné zariadenie", false],
			["Na zadné dvere", false],
			["Náhradné diely k nosičom bicyklov", false],
			["Príslušenstvo k nosičom bicyklov", false],
		]);
		// The whole name stays, for the accessible name.
		expect(navigation.chips?.[1]?.name).toBe("Nosiče bicyklov na strechu");
		// A catalogue category at its root URL, a sub-category under /categories/.
		expect(navigation.chips?.[0]?.href).toBe("/sk/nosice-bicyklov");
		expect(navigation.chips?.[1]?.href).toBe("/sk/categories/nosice-bicyklov-na-strechu");
	});

	it("keeps the row on a sub-category page, with its siblings and the page marked", () => {
		const onRoof = BIKE_CHILDREN[1]!;
		const navigation = buildCategoryNavigation(
			{ ...onRoof, parent: { ...BIKES, children: edges(BIKE_CHILDREN) }, children: edges([]) },
			SK,
			"sk-SK",
		);

		expect(navigation.parent).toMatchObject({ name: "Nosiče bicyklov", href: "/sk/nosice-bicyklov" });
		expect(navigation.chips?.filter((chip) => chip.current).map((chip) => chip.name)).toEqual([
			"Nosiče bicyklov na strechu",
		]);
		expect(navigation.chips?.[0]).toMatchObject({ name: "Nosiče bicyklov", current: false });
	});

	it("shows no row where every sub-category lists what 'Všetko' lists — the Nordrive roof racks", () => {
		const navigation = buildCategoryNavigation(
			{
				...node("stresne-nosice", "Strešné nosiče", 9157),
				parent: null,
				children: edges([
					node("nordrive-stresne-nosice", "Nordrive strešné nosiče", 9157),
					node("thule-stresne-nosice", "Thule strešné nosiče", 0),
				]),
			},
			SK,
			"sk-SK",
		);
		expect(navigation.chips).toBeNull();
	});

	it("shows a one-chip row when that chip narrows — roof boxes and their accessories", () => {
		const navigation = buildCategoryNavigation(
			{
				...node("stresne-boxy", "Strešné boxy", 101, 41),
				parent: null,
				children: edges([
					node("prislusenstvo-k-stresnym-boxom", "Príslušenstvo k strešným boxom", 41, 41),
					node("nahradne-diely-k-stresnym-boxom", "Náhradné diely k strešným boxom", 0),
				]),
			},
			SK,
			"sk-SK",
		);
		expect(navigation.chips?.map((chip) => chip.name)).toEqual([
			"Strešné boxy",
			"Príslušenstvo k strešným boxom",
		]);
	});

	it("abroad, links only categories translated the way their own page requires", () => {
		const translated = (name: string, slug: string) => ({
			name,
			slug,
			description: '{"blocks":[]}',
			seoTitle: name,
			seoDescription: name,
		});
		const navigation = buildCategoryNavigation(
			{
				...node("nosice-bicyklov", "Nosiče bicyklov", 188, 126, {
					translation: translated("Fahrradträger", "fahrradtraeger"),
				}),
				parent: null,
				children: edges([
					node("nosice-bicyklov-na-strechu", "Nosiče bicyklov na strechu", 18, 0, {
						translation: translated("Dach-Fahrradträger", "dach-fahrradtraeger"),
					}),
					// Untranslated: its page would answer "not found" in German, so no chip.
					node("nosice-bicyklov-na-tazne-zariadenie", "Nosiče bicyklov na ťažné zariadenie", 40),
				]),
			},
			DE,
			"de-DE",
		);
		expect(navigation.chips?.map((chip) => [chip.name, chip.href])).toEqual([
			["Fahrradträger", "/de/categories/fahrradtraeger"],
			["Dach-Fahrradträger", "/de/categories/dach-fahrradtraeger"],
		]);
	});

	it("keeps Saleor's order when the accessory split is unknown", () => {
		const unknown = BIKE_CHILDREN.map(({ accessoryProducts: _dropped, ...rest }) => rest);
		const navigation = buildCategoryNavigation(
			{ ...BIKES, parent: null, children: edges(unknown) },
			SK,
			"sk-SK",
		);
		expect(navigation.chips?.slice(1).map((chip) => chip.name)).toEqual([
			"Nosiče bicyklov na strechu",
			"Nosiče bicyklov na ťažné zariadenie",
			"Náhradné diely k nosičom bicyklov",
			"Príslušenstvo k nosičom bicyklov",
			"Nosiče bicyklov na zadné dvere",
		]);
	});

	it("answers nothing for a category Saleor does not have", () => {
		expect(buildCategoryNavigation(null, SK, "sk-SK")).toEqual({ parent: null, chips: null });
	});
});
