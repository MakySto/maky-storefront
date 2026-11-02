import { describe, expect, it } from "vitest";
import type { ProductListItemFragment } from "@/gql/graphql";
import { quoteInsteadOfPrice } from "@/config/quote-only";
import { buildCardSpecs, cardSpecsFor, transformToProductCard } from "./utils";

type Attrs = ProductListItemFragment["attributes"];

const attr = (ref: string, name: string, value: string, unit?: string) =>
	({
		attribute: { externalReference: ref, name, inputType: "NUMERIC", unit: unit ?? null, entityType: null },
		values: [{ name: value, slug: value, value: null }],
	}) as unknown as Attrs[number];

describe("buildCardSpecs", () => {
	it("keeps the product's own attributes in the card's order and drops what is missing", () => {
		const specs = buildCardSpecs(
			[
				attr("cfm:attribute:weight", "Hmotnosť", "18", "KG"),
				attr("cfm:attribute:volume", "Objem", "430", "L"),
			],
			"sk-SK",
		);
		expect(specs.map((spec) => spec.label)).toEqual(["Objem", "Hmotnosť"]);
	});

	it("is empty for a product without any of them", () => {
		expect(buildCardSpecs([], "sk-SK")).toEqual([]);
	});

	it("joins the outer size only when all three measurements exist", () => {
		const two = buildCardSpecs(
			[
				attr("cfm:attribute:outer_length", "Dĺžka", "190", "CM"),
				attr("cfm:attribute:outer_width", "Šírka", "80", "CM"),
			],
			"sk-SK",
		);
		expect(two).toEqual([]);

		const three = buildCardSpecs(
			[
				attr("cfm:attribute:outer_length", "Dĺžka", "190", "CM"),
				attr("cfm:attribute:outer_width", "Šírka", "80", "CM"),
				attr("cfm:attribute:outer_height", "Výška", "40", "CM"),
			],
			"sk-SK",
		);
		expect(three).toHaveLength(1);
		expect(three[0]!.value).toContain("190 × 80 × 40");
	});

	it("never returns more than four", () => {
		const many = ["volume", "net_volume", "bike_capacity", "ski_count", "max_load", "weight"].map((ref) =>
			attr(`cfm:attribute:${ref}`, ref, "5"),
		);
		expect(buildCardSpecs(many, "sk-SK")).toHaveLength(4);
	});

	describe("a bike carrier", () => {
		const carrier = [
			attr("cfm:attribute:weight", "Hmotnosť nosiča", "14", "KG"),
			attr("cfm:attribute:max_load_per_bike", "Max. hmotnosť na bicykel", "20", "KG"),
			attr("cfm:attribute:max_load", "Celková nosnosť", "60", "KG"),
			attr("cfm:attribute:bike_capacity", "Počet bicyklov", "3"),
		];

		it("tells how many bikes, the whole load, the load per bike and its own weight — in that order", () => {
			const specs = buildCardSpecs(carrier, "sk-SK");
			expect(specs.map((spec) => spec.label)).toEqual([
				"Počet bicyklov",
				"Celková nosnosť",
				"Max. hmotnosť na bicykel",
				"Hmotnosť nosiča",
			]);
			expect(specs.map((spec) => spec.value.replace(/\s/g, " "))).toEqual(["3", "60 kg", "20 kg", "14 kg"]);
		});

		it("never works out a per-bike limit the catalogue does not state", () => {
			const specs = buildCardSpecs(
				[
					attr("cfm:attribute:bike_capacity", "Počet bicyklov", "3"),
					attr("cfm:attribute:max_load", "Celková nosnosť", "60", "KG"),
				],
				"sk-SK",
			);
			// 60 kg over 3 bikes is 20 kg, and it is not on the card: only what the product carries is.
			expect(specs.map((spec) => spec.label)).toEqual(["Počet bicyklov", "Celková nosnosť"]);
		});
	});

	describe("a Kargo basket and a Kargo bar kit", () => {
		const basket = [
			attr("cfm:attribute:outer_length", "Dĺžka", "420", "CM"),
			attr("cfm:attribute:outer_width", "Šírka", "180", "CM"),
			attr("cfm:attribute:outer_height", "Výška", "12", "CM"),
			attr("cfm:attribute:max_load", "Maximálna nosnosť", "50", "KG"),
			attr("cfm:attribute:material", "Materiál", "hliník"),
		];
		const kit = [
			attr("cfm:attribute:bar_count", "Počet priečnikov", "4"),
			attr("cfm:attribute:bar_length", "Dĺžka priečnika", "180", "CM"),
		];

		it("says the size, the bars and the load, and the material only on the Kargo shelf", () => {
			const onShelf = buildCardSpecs([...basket, ...kit], "sk-SK", ["cfm:attribute:material"]);
			expect(onShelf.map((spec) => spec.key)).toEqual([
				"cfm:attribute:max_load",
				"cfm:attribute:material",
				"dimensions",
				"bars",
			]);
			const elsewhere = buildCardSpecs(basket, "sk-SK");
			expect(elsewhere.some((spec) => spec.key === "cfm:attribute:material")).toBe(false);
		});

		it("never says a load on the Kargo shelf, and still does elsewhere", () => {
			const slug = "stresne-nosice-a-kose-na-dodavky";
			expect(cardSpecsFor(basket, "sk-SK", slug).map((spec) => spec.key)).toEqual([
				"cfm:attribute:material",
				"dimensions",
			]);
			expect(cardSpecsFor(basket, "sk-SK", "stresne-boxy").map((spec) => spec.key)).toEqual([
				"cfm:attribute:max_load",
				"dimensions",
			]);
		});

		it("joins the bars as a count and a length, only when both exist", () => {
			const both = buildCardSpecs(kit, "sk-SK");
			expect(both).toHaveLength(1);
			expect(both[0]).toMatchObject({ key: "bars" });
			expect(both[0]!.value.replace(/\s/g, " ")).toBe("4 × 180 cm");
			expect(buildCardSpecs([kit[0]!], "sk-SK")).toEqual([]);
			expect(buildCardSpecs([kit[1]!], "sk-SK")).toEqual([]);
		});
	});

	describe("a Kargo card in a foreign market", () => {
		const DE_SLUG = "kargo-dachtraeger-und-dachkoerbe-fuer-transporter";
		const german = [
			attr("cfm:attribute:outer_length", "Länge", "420", "CM"),
			attr("cfm:attribute:outer_width", "Breite", "180", "CM"),
			attr("cfm:attribute:outer_height", "Höhe", "7", "CM"),
			attr("cfm:attribute:max_load", "Maximale Tragfähigkeit", "50", "KG"),
			attr("cfm:attribute:material", "Material", "eloxiertes Aluminium"),
		];
		/** What the exact-locale boundary hands the card: the category with its TRANSLATED slug. */
		const product = (slug: string) =>
			({
				id: "UHJvZHVjdDox",
				name: "Dachkorb Nordrive Kargo",
				slug: "dachkorb-nordrive-kargo",
				isAvailableForPurchase: true,
				rating: null,
				created: null,
				attributes: german,
				category: { id: "Q2F0ZWdvcnk6MzQ=", name: "Kargo", slug },
				pricing: { priceRange: { start: { gross: { amount: 1, currency: "EUR" } } } },
				thumbnail: null,
				cardMedia: [],
				variants: [],
			}) as unknown as ProductListItemFragment;

		it("says the material and no load, though its category carries the translated slug", () => {
			const card = transformToProductCard(product(DE_SLUG), "de-eur", "de-DE");
			expect(card.specs?.map((spec) => [spec.key, spec.label])).toEqual([
				["cfm:attribute:material", "Material"],
				["dimensions", ""],
			]);
		});

		it("is the same card as in Slovakia, whichever slug the category carries", () => {
			const keys = (slug: string, channel: string, locale: string) =>
				transformToProductCard(product(slug), channel, locale).specs?.map((spec) => spec.key);
			const abroad = keys(DE_SLUG, "de-eur", "de-DE");
			expect(keys("kargo-stresne-nosice-a-stresne-kose-na-dodavky", "sk-eur", "sk-SK")).toEqual(abroad);
			expect(keys("stresne-nosice-a-kose-na-dodavky", "sk-eur", "sk-SK")).toEqual(abroad);
			expect(keys("kargo-dachtraeger-und-dachkoerbe-fuer-lieferwagen", "at-eur", "de-AT")).toEqual(abroad);
		});

		it("carries the base slug of its category beside the translated one, for the rules keyed by it", () => {
			const abroad = transformToProductCard(product(DE_SLUG), "de-eur", "de-DE").category;
			expect(abroad).toMatchObject({
				slug: DE_SLUG,
				baseSlug: "kargo-stresne-nosice-a-stresne-kose-na-dodavky",
			});
			const home = transformToProductCard(product("stresne-boxy"), "sk-eur", "sk-SK").category;
			expect(home).toMatchObject({ slug: "stresne-boxy", baseSlug: "stresne-boxy" });
		});

		it("asks for a quote where the market does not sell it, under the translated slug too", () => {
			const quote = (slug: string, channel: string, locale: string) => {
				const category = transformToProductCard(product(slug), channel, locale).category;
				return quoteInsteadOfPrice({
					isPurchasable: false,
					categorySlug: category?.baseSlug ?? category?.slug,
				});
			};
			expect(quote("kargo-roof-racks-and-crossbars-for-vans", "us-usd", "en-US")).toBe(true);
			expect(quote("kargo-van-roof-racks-and-crossbars", "ca-cad", "en-CA")).toBe(true);
			expect(quote(DE_SLUG, "de-eur", "de-DE")).toBe(true);
			expect(quote("dachtraeger", "de-eur", "de-DE")).toBe(false);
		});

		it("leaves another shelf's translated slug alone: its load stays and no material is asked for", () => {
			const card = transformToProductCard(product("dachtraeger"), "de-eur", "de-DE");
			expect(card.specs?.map((spec) => spec.key)).toEqual(["cfm:attribute:max_load", "dimensions"]);
		});
	});
});
