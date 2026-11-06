import { TYRE_FIELDS } from "./fields";
import type { TyreFitView } from "./types";

/**
 * What the product page makes of the shopper's tyres, without React: whether the buy button may submit, why not when
 * it may not, and exactly which values the form carries. The page draws this and a test drives it against the
 * server's own check (`selection.ts`), so what the form sends is what the server accepts, or refuses for the reason
 * the page gave.
 *
 * Client-safe: nothing here imports the list. The server hands the page a `TyreFitView`, one small object.
 */

export type { TyreFitView };

/**
 * Why the buy button holds back, and what it does instead. Each one is a different button text and a different next
 * step, because a button that only says "does not fit" tells the shopper nothing they can do:
 *
 *   `choose`   no size yet: opens the window that asks for it.
 *   `ask`      one question about their tyres decides the size: takes them to it.
 *   `other`    a code of this model in another size fits and the shop sells it: goes to its page.
 *   `find`     this one does not fit, others the shop sells do: goes to the list narrowed to the size.
 *   `contact`  the shop cannot verify the size or sells nothing for it: goes to the people who can.
 */
export type TyreGateReason = "choose" | "ask" | "other" | "find" | "contact";

/** What the shopper can still say on the page itself: that they know the code and give no size. */
export interface TyreFitChoice {
	/** The shopper says they know this code and gives no size. Honoured only while the shop cannot answer for a size. */
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
	[TYRE_FIELDS.answer]: "",
} as const;

const codeOnly = {
	complete: true,
	reason: null,
	fields: { ...nothingChosen, [TYRE_FIELDS.mode]: "code" },
} as const satisfies TyreFitState;

export function tyreFitState(view: TyreFitView, choice: TyreFitChoice): TyreFitState {
	switch (view.kind) {
		case "no-size":
			// "I know the code" is a statement made INSTEAD of giving a size. Once a size is known and the shop can
			// answer for it the list has spoken and the statement no longer overrules it.
			return choice.knowsCode ? codeOnly : { complete: false, reason: "choose", fields: nothingChosen };
		case "unlisted":
			// The shop cannot verify this size, which is not "it does not fit": the shopper who knows the code may buy.
			return choice.knowsCode ? codeOnly : { complete: false, reason: "contact", fields: nothingChosen };
		case "ask":
			return { complete: false, reason: "ask", fields: nothingChosen };
		case "other": {
			// Where the right size is sold if the shop sells it; else the list of what it does sell for the size; else people.
			const sold = view.alternatives.some((alternative) => alternative.href !== null);
			return {
				complete: false,
				reason: sold ? "other" : view.elsewhere ? "find" : "contact",
				fields: nothingChosen,
			};
		}
		case "no-fit":
			// The size is deliberately not sent: the server would refuse it, and the button does not submit.
			return { complete: false, reason: view.elsewhere ? "find" : "contact", fields: nothingChosen };
		case "fits":
			return {
				complete: true,
				reason: null,
				fields: { ...nothingChosen, [TYRE_FIELDS.size]: view.size, [TYRE_FIELDS.answer]: view.answer ?? "" },
			};
	}
}
