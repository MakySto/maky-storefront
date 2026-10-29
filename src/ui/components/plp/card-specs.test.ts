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
});
