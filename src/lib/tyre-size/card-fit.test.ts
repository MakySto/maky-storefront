import { describe, expect, it } from "vitest";

import type { ProductCardData } from "@/ui/components/plp/product-card";
import { attachTyreFit } from "./card-fit";

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

const MAKE_KEY = "Continental|Kleber|Michelin";

describe("what a card says about the shopper's size", () => {
	it("is attached to the cards of size-controlled products only", () => {
		const cards = attachTyreFit([card("N16128", "a"), card("A7604", "b"), card(null, "c")], "215/70 R15");
		expect(cards[0]!.tyreFit).toEqual({ size: "215/70 R15", kind: "fits", answer: null });
		// Not a snow chain or sock: nothing to say about tyres.
		expect(cards[1]!.tyreFit).toBeUndefined();
		expect(cards[2]!.tyreFit).toBeUndefined();
		expect(cards.map((c) => c.id)).toEqual(["a", "b", "c"]);
	});

	it("says fits where the previous shop's card is the only source, as it does for the maker's list", () => {
		expect(attachTyreFit([card("D0190")], "165/75 R14")[0]!.tyreFit).toEqual({
			size: "165/75 R14",
			kind: "fits",
			answer: null,
		});
	});

	it("says a card does not fit a size the product's list does not hold", () => {
		expect(attachTyreFit([card("N16128")], "205/55 R16")[0]!.tyreFit).toEqual({
			size: "205/55 R16",
			kind: "no-fit",
		});
	});

	it("asks, on the card, while the size splits the model between two codes and the shopper has not said which", () => {
		const [a, b] = attachTyreFit([card("N16105", "a"), card("N16128", "b")], "195/75 R16");
		expect(a.tyreFit).toEqual({ size: "195/75 R16", kind: "ask" });
		expect(b.tyreFit).toEqual({ size: "195/75 R16", kind: "ask" });
	});

	it("says fits on one card and no-fit on the other once the shopper has answered", () => {
		const [a, b] = attachTyreFit([card("N16105", "a"), card("N16128", "b")], "195/75 R16", {
			[MAKE_KEY]: "Michelin",
		});
		expect(a.tyreFit).toEqual({ size: "195/75 R16", kind: "fits", answer: "Michelin" });
		expect(b.tyreFit).toEqual({ size: "195/75 R16", kind: "no-fit" });
	});

	it("is not attached without a size: a verdict needs a question", () => {
		const input = [card("N16128")];
		expect(attachTyreFit(input, null)[0]!.tyreFit).toBeUndefined();
		expect(attachTyreFit(input, "")[0]!.tyreFit).toBeUndefined();
	});

	it("is not attached for a size no list holds: all the shop can say is that it cannot verify it", () => {
		expect(attachTyreFit([card("N16128")], "205/40 R21")[0]!.tyreFit).toBeUndefined();
	});

	it("does not change the cards it is handed", () => {
		const input = [card("N16128")];
		const out = attachTyreFit(input, "215/70 R15");
		expect(input[0]!.tyreFit).toBeUndefined();
		expect(out[0]).not.toBe(input[0]);
	});
});
