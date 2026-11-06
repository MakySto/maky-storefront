import "server-only";

import type { ProductCardData } from "@/ui/components/plp/product-card";
import { tyreFit } from "./size-lookup";
import type { TyreCardFit, TyreFit } from "./types";

/**
 * The one word a card says about a product and the shopper's size, from the same verdict the product page draws
 * (`size-lookup.tyreFit`): the condition outranks the source, as in the page's box, because a fit that depends on the
 * make of the tyre is not a plain fit whoever listed it.
 */
export function tyreCardFitOf(fit: TyreFit): TyreCardFit {
	if (fit.kind === "no-fit") return { size: fit.size, kind: "no-fit" };
	return {
		size: fit.size,
		kind: fit.condition ? "fits-with-condition" : fit.fromManufacturerList ? "fits" : "fits-supplier",
	};
}

/**
 * Give each size-controlled card its verdict for the size the shopper gave.
 *
 * A card whose code is not one of the size-controlled products is untouched (it has nothing to say about tyres), and
 * with no size every card is: a verdict needs a question. It reads the card's own code, so it needs nothing from the
 * shop beyond the cards it is handed, and it says the same on every page that shows the card.
 */
export function attachTyreFit(cards: readonly ProductCardData[], size: string | null): ProductCardData[] {
	if (!size) return [...cards];
	return cards.map((card) => {
		const fit = tyreFit(card.productCode, size);
		return fit ? { ...card, tyreFit: tyreCardFitOf(fit) } : card;
	});
}
