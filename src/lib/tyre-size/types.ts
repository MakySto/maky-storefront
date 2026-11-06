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
			readonly condition: { readonly mode: TyreConditionMode; readonly tyres: readonly string[] } | null;
			/** Key of the list's source for this code (the manufacturer's list, or the previous shop's card). */
			readonly basis: string;
			readonly listId: string;
	  }
	| { readonly mode: "code"; readonly listId: string };

/** What a client sends about the choice, before any check. Every field is attacker-shaped. */
export type TyreSelectionInput =
	| { readonly mode: "size"; readonly size: string; readonly conditionKey: string }
	| { readonly mode: "code" };

/** Why a choice was not accepted. Each one is a different sentence to the customer. */
export type TyreRefusal =
	/** Nothing was chosen. */
	| "required"
	/** The size is not in the list of this code. */
	| "unknown-size"
	/** The size carries a condition the customer has not acknowledged. */
	| "condition-required"
	/** The acknowledged condition is not the one the list attaches to this size. */
	| "condition-mismatch";

/** The picker's data for one code: serialisable, small (at most a few hundred rows), nothing internal. */
export interface TyrePickerData {
	readonly code: string;
	/**
	 * True when the sizes are the manufacturer's own list; false when they are the supplier's data from the previous
	 * shop's cards. The page says which in the customer's language; the list's own label is Slovak and stays out.
	 */
	readonly fromManufacturerList: boolean;
	readonly rims: readonly { readonly rim: string; readonly sizes: readonly TyrePickerSize[] }[];
	/** Only the conditions this code uses. */
	readonly conditions: Readonly<
		Record<string, { readonly mode: TyreConditionMode; readonly tyres: readonly string[] }>
	>;
}

export interface TyrePickerSize {
	readonly label: string;
	/** Key into `TyrePickerData.conditions`, or "" when the size carries none. */
	readonly conditionKey: string;
}

/** What a cart or order line says about the choice, read back from its public metadata. */
export type TyreLineChoice =
	| {
			readonly mode: "size";
			readonly size: string;
			readonly condition: { readonly mode: TyreConditionMode; readonly tyres: readonly string[] } | null;
	  }
	| { readonly mode: "code" };
