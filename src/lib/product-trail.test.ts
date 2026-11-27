import { describe, expect, it } from "vitest";

import { type FitmentDataset } from "@/lib/fitment/contract";
import { aProduct, anApplication } from "@/lib/fitment/fixtures/build";
import { categoryTrail, shortProductName, vehiclesOfProduct, type TrailCategory } from "./product-trail";

const dataset = {
	makes: [{ id: "mk-bmw", name: "BMW", displayNames: { sk: "BMW" } }],
	models: [
		{ id: "md-5t", makeId: "mk-bmw", name: "5 Series Touring", displayNames: { sk: "Rad 5 Touring" } },
	],
	generations: [
		{
			id: "gn-g61",
			modelId: "md-5t",
			name: "G61",
			productionYearFrom: 2024,
			productionYearTo: null,
			qualifiers: {},
		},
	],
	applications: [],
} as unknown as FitmentDataset;

describe("the vehicles of a product", () => {
	const withApplications = (applications: ReturnType<typeof anApplication>[]) =>
		({ ...dataset, applications }) as unknown as FitmentDataset;

	it("are the generations of the positive rows the source accepts and will sell", () => {
		const data = withApplications([
			anApplication({
				applicationId: "a",
				generationId: "gn-1",
				products: [aProduct({ saleorProductId: "p" })],
			}),
			anApplication({
				applicationId: "b",
				generationId: "gn-2",
				products: [aProduct({ saleorProductId: "p" })],
			}),
			anApplication({
				applicationId: "c",
				generationId: "gn-3",
				products: [aProduct({ saleorProductId: "other" })],
			}),
		]);
		expect(vehiclesOfProduct(data, "p").sort()).toEqual(["gn-1", "gn-2"]);
	});

	it("leave out a held row, a row the source will not sell and a negative one", () => {
		const data = withApplications([
			anApplication({
				applicationId: "a",
				generationId: "gn-held",
				products: [aProduct({ saleorProductId: "p", qaStatus: "hold" })],
			}),
			anApplication({
				applicationId: "b",
				generationId: "gn-unsellable",
				products: [aProduct({ saleorProductId: "p", eligibility: { sellable: false, reasons: ["x"] } })],
			}),
			anApplication({
				applicationId: "c",
				generationId: "gn-negative",
				negative: true,
				products: [aProduct({ saleorProductId: "p" })],
			}),
		]);
		expect(vehiclesOfProduct(data, "p")).toEqual([]);
	});

	it("are none without a dataset", () => {
		expect(vehiclesOfProduct(null, "p")).toEqual([]);
	});
});

describe("the short name of the last step", () => {
	const set = "Strešný nosič Nordrive Silenzio Silver BMW Rad 5 Touring G61 (od 2024) — Integrované lyžiny";

	it("is the maker and line of a set, without the type word and without the car", () => {
		expect(
			shortProductName(set, { brand: "Nordrive", dataset, generationIds: ["gn-g61"], language: "sk" }),
		).toBe("Nordrive Silenzio Silver");
	});

	it("is the name from the maker on for another product", () => {
		expect(
			shortProductName("Nosič bicyklov na ťažné zariadenie Thule EasyFold XT 3", { brand: "Thule" }),
		).toBe("Thule EasyFold XT 3");
	});

	it("is the whole name when the maker is not in it, is missing, or is all there is", () => {
		expect(shortProductName("Kompresorová autochladnička 19 L", { brand: "Pro-USER" })).toBe(
			"Kompresorová autochladnička 19 L",
		);
		expect(shortProductName("Snehové reťaze Pilot Pro XL", {})).toBe("Snehové reťaze Pilot Pro XL");
		expect(shortProductName("Thule", { brand: "Thule" })).toBe("Thule");
	});

	it("is the whole name of a set whose name does not hold up to the split", () => {
		expect(
			shortProductName("Montážny kit K1234", {
				brand: "Nordrive",
				dataset,
				generationIds: ["gn-g61"],
				language: "sk",
			}),
		).toBe("Montážny kit K1234");
	});

	it("does not take the maker for a word inside another word", () => {
		expect(shortProductName("Subthule prekrytie", { brand: "Thule" })).toBe("Subthule prekrytie");
	});
});

describe("the shelves above a product", () => {
	const hrefOf = (id: string, slug: string) => `/sk/${id}-${slug}`;
	const tree = (over: Partial<TrailCategory> = {}): TrailCategory => ({
		id: "c-child",
		name: "Na ťažné zariadenie",
		slug: "na-tazne",
		parent: {
			id: "c-parent",
			name: "Nosiče bicyklov",
			slug: "nosice-bicyklov",
			translation: { name: "Fahrradträger", slug: "fahrradtraeger" },
		},
		...over,
	});

	it("goes outermost first and ends with the product's own shelf", () => {
		expect(categoryTrail(tree(), { sourceLocale: true, hrefOf })).toEqual([
			{ label: "Nosiče bicyklov", href: "/sk/c-parent-nosice-bicyklov" },
			{ label: "Na ťažné zariadenie", href: "/sk/c-child-na-tazne" },
		]);
	});

	it("reads a parent in the market's language abroad", () => {
		expect(categoryTrail(tree({ name: "Anhängerkupplung" }), { sourceLocale: false, hrefOf })[0]).toEqual({
			label: "Fahrradträger",
			href: "/sk/c-parent-nosice-bicyklov",
		});
	});

	it("leaves out a parent that has no words for the market, never the Slovak ones", () => {
		const steps = categoryTrail(
			tree({ parent: { id: "p", name: "Nosiče bicyklov", slug: "x", translation: null } }),
			{
				sourceLocale: false,
				hrefOf,
			},
		);
		expect(steps.map((step) => step.label)).toEqual(["Na ťažné zariadenie"]);
	});

	it("stops at a shelf with no words, together with everything above it", () => {
		const steps = categoryTrail(
			tree({
				parent: {
					id: "mid",
					name: "Stredná",
					slug: "mid",
					translation: null,
					parent: { id: "root", name: "Koreň", slug: "root", translation: { name: "Wurzel" } },
				},
			}),
			{ sourceLocale: false, hrefOf },
		);
		expect(steps.map((step) => step.label)).toEqual(["Na ťažné zariadenie"]);
	});

	it("is the product's shelf alone when it has no parent", () => {
		expect(categoryTrail(tree({ parent: null }), { sourceLocale: true, hrefOf })).toHaveLength(1);
	});
});
