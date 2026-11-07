/**
 * The shapes of the tyre-size feature, shared by the server (the list, the check at add-to-cart) and the client
 * (the picker on the product page, the cart's display of what was chosen).
 *
 * Nothing here imports the list itself: `size-index.ts` is server-only and large (5 324 rows), and a client
 * module must be able to import these types without pulling it into the browser bundle.
 */

/** "only": the chain fits this size only on tyres of these makes/models. "not": it fits unless they are these. */
export type TyreConditionMode = "only" | "not";

export interface TyreCondition {
	readonly mode: TyreConditionMode;
	/** The producer's own words ("Bridgestone Duravis Rxxx", "No Kleber / No Michelin / No Continental"). */
	readonly raw: string;
	/** The makes/models the condition names, one per entry. Never empty. */
	readonly tyres: readonly string[];
}

/** `[size, rim, condition key]`: "205/55 R16", "16", and "" for a size without a condition. */
export type TyreSizeRow = readonly [label: string, rim: string, conditionKey: string];

export interface TyreSizeProduct {
	/** Key into `TyreSizeIndex.sources`: where the product's sizes come from. */
	readonly source: string;
	readonly sizes: readonly TyreSizeRow[];
}

export interface TyreSizeIndex {
	readonly schema: "maky.tyre-size-index/1";
	readonly id: string;
	readonly conditions: Readonly<Record<string, TyreCondition>>;
	readonly sources: Readonly<Record<string, { readonly label: string }>>;
	readonly products: Readonly<Record<string, TyreSizeProduct>>;
	readonly counts: {
		readonly conditional_products: number;
		readonly conditions: number;
		readonly products: number;
		readonly sizes: number;
	};
	readonly origin: {
		readonly batch: string;
		readonly batch_file_sha256: string;
		readonly batch_self_sha256: string;
		readonly producer: string;
	};
	readonly self_sha256: string;
}

/**
 * What the customer chose, once the server has checked it against the list.
 *
 * `size`: a size from the list of this code (with the condition the list attaches to it, which the customer
 * acknowledged). `code`: the customer knows this code fits their tyres and chose no size; the shop then makes no
 * statement about the fit, and the order line says exactly that.
 */
export type TyreSelection =
	| {
			readonly mode: "size";
			readonly size: string;
			readonly rim: string;
			/**
			 * The condition the list attaches to this size, and what the shopper said about their tyres (`answer`: the
			 * make or model from the condition they have, or `NO_MATCH_ANSWER` for "none of those").
			 */
			readonly condition: {
				readonly mode: TyreConditionMode;
				readonly tyres: readonly string[];
				readonly answer: string;
			} | null;
			/** Key of the list's source for this code (the manufacturer's list, or the previous shop's card). */
			readonly basis: string;
			readonly listId: string;
	  }
	| { readonly mode: "code"; readonly listId: string };

/** What a client sends about the choice, before any check. Every field is attacker-shaped. */
export type TyreSelectionInput =
	| { readonly mode: "size"; readonly size: string; readonly answer: string }
	| { readonly mode: "code" };

/** Why a choice was not accepted. Each one is a different sentence to the customer. */
export type TyreRefusal =
	/** Nothing was chosen. */
	| "required"
	/** The size is not in the list of this code. */
	| "unknown-size"
	/** The size carries a condition on the tyre and the customer has not said which tyres they have. */
	| "condition-required"
	/** What the customer said about their tyres rules this code out for the size (or is not an answer to its question). */
	| "condition-mismatch";

/**
 * The question a size's condition asks: which make (or model) of tyre do you have? The same question serves the
 * code that fits only on those tyres and the code that fits on any other, so the answer picks between them.
 */
export interface TyreQuestion {
	/** Stable id: the tyres, sorted, joined. The cookie keys the shopper's answer by it. */
	readonly key: string;
	/** `make` when the list names makes ("Michelin"), `model` when it names a model ("Michelin Alpin"). */
	readonly subject: "make" | "model";
	/** What the shopper may say they have, as the list writes it. "None of these" is always offered besides. */
	readonly options: readonly string[];
}

/** A chain of the same model family that does fit the size, when this one does not. */
export interface TyreAlternative {
	readonly code: string;
	/** The physical size as the family names it ("22,5"); the code when the family has no name for it. */
	readonly sizeLabel: string;
	/** Where it is sold, or `null` when the shop does not list it (yet): the page then says so and does not link. */
	readonly href: string | null;
}

/**
 * What the product page knows about this product and the size the shopper gave (`choice.ts` answers it from the
 * list; the page draws it). Client-safe on purpose: the page hands this small object to the browser, never the list.
 *
 * Five different things, because "no" is not one answer:
 *   `no-size`   nothing asked yet.
 *   `unlisted`  the size is a well-formed one that no list holds: the shop CANNOT VERIFY it, which is not "it does not fit".
 *   `fits`      the list holds the size for this code (with the shopper's answer when the list attaches a tyre condition).
 *   `ask`       the list holds the size for this code only on certain tyres: one question decides it.
 *   `other`     this code does not fit, a code of the same model family does.
 *   `no-fit`    nothing of this family fits.
 *
 * `elsewhere` (on `other` and `no-fit`) says whether the shopper can still find a chain for this size: in the lists it
 * is true whenever some code holds the size, and the page narrows it to what the shop actually sells
 * (`withPublishedOffer`), so that "see the chains that fit" is never promised for a list the shop does not offer.
 */
export type TyreFitView =
	| { readonly kind: "no-size" }
	| { readonly kind: "unlisted"; readonly size: string }
	| {
			readonly kind: "fits";
			readonly size: string;
			/**
			 * The manufacturer's own list, or the supplier's data from the previous shop's card. It changes the words under
			 * the verdict and nothing else: a size the shop holds for the product fits, whichever list it came from.
			 */
			readonly fromManufacturerList: boolean;
			/** What the shopper said about their tyres when the list asked, else `null`. */
			readonly answer: string | null;
			/** The question the list asked, when it asked one (and the answer decided), else `null`. */
			readonly question: TyreQuestion | null;
	  }
	| { readonly kind: "ask"; readonly size: string; readonly question: TyreQuestion }
	| {
			readonly kind: "other";
			readonly size: string;
			readonly alternatives: readonly TyreAlternative[];
			readonly elsewhere: boolean;
	  }
	| { readonly kind: "no-fit"; readonly size: string; readonly elsewhere: boolean };

/**
 * How a LISTING CARD speaks of the shopper's tyre size: the product page's verdicts, in one word each. `fits` is a
 * size the shop holds for the product (with the shopper's answer when the list asked one), `ask` a size that fits only
 * on certain tyres and the shopper has not said which they have, `no-fit` a size the product's list does not hold.
 */
export type TyreCardFitKind = "fits" | "ask" | "no-fit";

export interface TyreCardFit {
	readonly size: string;
	readonly kind: TyreCardFitKind;
	/**
	 * On `fits` only: what the shopper said about their tyres when the list asked and that answer decided it, else
	 * `null`. The card's add-to-cart sends it back with the size, because the server checks the pair again.
	 */
	readonly answer?: string | null;
}

/** What a cart or order line says about the choice, read back from its public metadata. */
export type TyreLineChoice =
	| {
			readonly mode: "size";
			readonly size: string;
			readonly condition: {
				readonly mode: TyreConditionMode;
				readonly tyres: readonly string[];
				/** What the shopper said they have; `""` on a line written before the answer was recorded. */
				readonly answer: string;
			} | null;
	  }
	| { readonly mode: "code" };
