import { describe, expect, it } from "vitest";

import type { ProductCardData } from "@/ui/components/plp/product-card";
import { attachTyreFit, tyreCardFitOf } from "./card-fit";
import { tyreFit } from "./size-lookup";

const card = (productCode: string | null, id = "p"): ProductCardData => ({
	id,
	name: "n",
	slug: "n",
	productCode,
	price: 1,
	currency: "EUR",
	image: "",
	href: "/n",
	channel: "sk-eur",
	isPurchasable: true,
});

describe("what a card says about the shopper's size", () => {
	it("is the product page's verdict, in one word", () => {
		// The manufacturer's list, no condition.
		expect(tyreCardFitOf(tyreFit("N16128", "215/70 R15")!)).toEqual({ size: "215/70 R15", kind: "fits" });
		// The same code under a condition on the make of the tyre.
		expect(tyreCardFitOf(tyreFit("N16128", "195/75 R16")!)).toEqual({
			size: "195/75 R16",
			kind: "fits-with-condition",
		});
		// The supplier's data from the previous shop's card, not the manufacturer's list.
		expect(tyreCardFitOf(tyreFit("D0190", "165/75 R14")!)).toEqual({
			size: "165/75 R14",
			kind: "fits-supplier",
		});
		expect(tyreCardFitOf(tyreFit("N16128", "205/55 R16")!)).toEqual({ size: "205/55 R16", kind: "no-fit" });
	});

	it("is attached to the cards of size-controlled products only", () => {
		const cards = attachTyreFit([card("N16128", "a"), card("A7604", "b"), card(null, "c")], "215/70 R15");
		expect(cards[0]!.tyreFit).toEqual({ size: "215/70 R15", kind: "fits" });
		// Not a snow chain or sock: nothing to say about tyres.
		expect(cards[1]!.tyreFit).toBeUndefined();
		expect(cards[2]!.tyreFit).toBeUndefined();
		expect(cards.map((c) => c.id)).toEqual(["a", "b", "c"]);
	});

	it("is not attached without a size: a verdict needs a question", () => {
		const input = [card("N16128")];
		expect(attachTyreFit(input, null)[0]!.tyreFit).toBeUndefined();
		expect(attachTyreFit(input, "")[0]!.tyreFit).toBeUndefined();
	});

	it("does not change the cards it is handed", () => {
		const input = [card("N16128")];
		const out = attachTyreFit(input, "215/70 R15");
		expect(input[0]!.tyreFit).toBeUndefined();
		expect(out[0]).not.toBe(input[0]);
	});
});
