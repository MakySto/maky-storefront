import { withPublishedOffer, type TyreAnswers } from "./choice";
import type { TyreFitView } from "./types";

/**
 * What the shop sells of the answer the size lists gave.
 *
 * The lists say WHICH codes of the model (or of the whole shelf) fit a size; whether the shop sells one is the shop's
 * own list of what it publishes in this channel (`listing/shelf-codes`), and most of the 145 codes are not published
 * yet. So the product page's verdict is corrected by it before it is drawn:
 *
 *   - "the size you need is another code of this model" gets a link only to a code that is on sale, and says "we do
 *     not sell that size now" for one that is not;
 *   - "other chains fit this size" stays only while a published chain fits it (`withPublishedOffer`); otherwise the
 *     page says that nothing is on offer for the size and points at the people, not at a list that cannot help.
 *
 * `listed` is what the shop publishes (`null` when it could not be read: the links are then absent, so the page points
 * at the list instead of a page that may not exist, and the offer is unknown, so the verdict stays as the lists gave it
 * and the listing it leads to states what it can). `hrefOf` turns a published product's slug into its page.
 *
 * Pure: the reading of the shop's list and the building of links belong to the page; this is only the rule.
 */
export interface ShopCode {
	readonly code: string;
	readonly slug: string;
}

export function applyShopOffer(
	view: TyreFitView,
	listed: readonly ShopCode[] | null,
	answers: TyreAnswers,
	hrefOf: (slug: string) => string,
): TyreFitView {
	if (view.kind !== "other" && view.kind !== "no-fit") return view;

	const published = listed === null ? null : new Set(listed.map(({ code }) => code));
	const offered = withPublishedOffer(view, published, answers);
	if (offered.kind !== "other") return offered;

	return {
		...offered,
		alternatives: offered.alternatives.map((alternative) => {
			const found = listed?.find(({ code }) => code === alternative.code);
			return { ...alternative, href: found ? hrefOf(found.slug) : null };
		}),
	};
}
