import { describe, expect, it } from "vitest";
import type { ProductListItemFragment } from "@/gql/graphql";
import { buildCardSpecs } from "./utils";

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
});
