import { TYRE_FIELDS } from "./fields";
import type { TyreFitView } from "./types";

/**
 * What the product page makes of the shopper's remembered size, without React: whether the buy buttons may submit,
 * why not when they may not, and exactly which values the form carries. The page draws this and a test drives it
 * against the server's own check (`selection.ts`), so what the form sends is what the server accepts, or refuses
 * for the reason the page gave.
 *
 * Client-safe: nothing here imports the list. The server hands the page a `TyreFit`, one small object.
 */

export type { TyreFitView };

/** Why a buy button holds back and takes the shopper to the choice instead: each one is a different button text. */
export type TyreGateReason =
	/** No size yet: the button takes the shopper to the window that asks for it. */
	| "choose"
	/** The size is known and this product does not fit it. */
	| "no-fit"
	/** The size fits only on certain tyres, and the shopper has not said theirs are those. */
	| "confirm";

/** The two things the shopper can still say on the page itself. */
export interface TyreFitChoice {
	/** The condition on the size has been ticked. Meaningless for a size without a condition. */
	readonly acknowledged: boolean;
	/** The shopper says they know this code and gives no size. Honoured only while no size is known. */
	readonly knowsCode: boolean;
}

export interface TyreFitState {
	/** True when the form can be submitted. */
	readonly complete: boolean;
	readonly reason: TyreGateReason | null;
	/** What the three hidden fields carry. */
	readonly fields: Readonly<Record<(typeof TYRE_FIELDS)[keyof typeof TYRE_FIELDS], string>>;
}

const nothingChosen = {
	[TYRE_FIELDS.mode]: "size",
	[TYRE_FIELDS.size]: "",
	[TYRE_FIELDS.condition]: "",
} as const;

export function tyreFitState(view: TyreFitView, choice: TyreFitChoice): TyreFitState {
	switch (view.kind) {
		case "no-size":
			// "I know the code" is a statement made INSTEAD of giving a size. Once a size is known the list has
			// spoken and the statement no longer overrules it: a size that does not fit is changed, not argued with.
			return choice.knowsCode
				? { complete: true, reason: null, fields: { ...nothingChosen, [TYRE_FIELDS.mode]: "code" } }
				: { complete: false, reason: "choose", fields: nothingChosen };
		case "no-fit":
			// The size is deliberately not sent: the server would refuse it, and the button does not submit.
			return { complete: false, reason: "no-fit", fields: nothingChosen };
		case "fits": {
			const { condition } = view;
			if (condition === null) {
				return {
					complete: true,
					reason: null,
					fields: { ...nothingChosen, [TYRE_FIELDS.size]: view.size },
				};
			}
			return {
				complete: choice.acknowledged,
				reason: choice.acknowledged ? null : "confirm",
				fields: {
					...nothingChosen,
					[TYRE_FIELDS.size]: view.size,
					// The condition travels only once it is ticked: ticking is the shopper's acknowledgement.
					[TYRE_FIELDS.condition]: choice.acknowledged ? condition.key : "",
				},
			};
		}
	}
}
