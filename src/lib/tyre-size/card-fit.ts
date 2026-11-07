import "server-only";

import type { ProductCardData } from "@/ui/components/plp/product-card";
import { tyreCardFitOf, type TyreAnswers } from "./choice";
import { isKnownTyreSize } from "./size-lookup";

/**
 * Give each size-controlled card its verdict for the size the shopper gave, from the same function the product page
 * and the narrowing use (`choice.ts`), so a card, its page and the list it stands in never disagree.
 *
 * A card whose code is not one of the size-controlled products is untouched (it has nothing to say about tyres), and
 * with no size every card is: a verdict needs a question. So is every card for a size no list holds: "does not fit"
 * would be a claim, and all the shop can say is that it cannot verify the size. It reads the card's own code, so it needs nothing from the
 * shop beyond the cards it is handed, and it says the same on every page that shows the card.
 */
export function attachTyreFit(
	cards: readonly ProductCardData[],
	size: string | null,
	answers: TyreAnswers = {},
): ProductCardData[] {
	if (!size || !isKnownTyreSize(size)) return [...cards];
	return cards.map((card) => {
		const fit = tyreCardFitOf(card.productCode, size, answers);
		return fit ? { ...card, tyreFit: fit } : card;
	});
}
