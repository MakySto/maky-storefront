import { TYRE_FIELDS } from "./fields";
import type { TyreConditionMode, TyrePickerData, TyrePickerSize } from "./types";

/**
 * The tyre-size picker's behaviour, without React: what is chosen, what may be chosen next, whether the choice is
 * complete, and exactly which values the form carries. The component only draws this, which is what lets a node
 * test drive the whole picker, and tie it to the check the server runs on the same fields.
 *
 * Client-safe: nothing here imports the list. The page hands it one code's rows (`TyrePickerData`).
 */
export interface PickerState {
	/** "size": the customer picks one from the list. "code": they say they know the code and pick none. */
	readonly mode: "size" | "code";
	readonly rim: string;
	readonly size: string;
	/** The condition on the chosen size has been ticked. Meaningless for a size without a condition. */
	readonly acknowledged: boolean;
}

export type PickerAction =
	| { readonly type: "rim"; readonly rim: string }
	| { readonly type: "size"; readonly size: string }
	| { readonly type: "acknowledge"; readonly acknowledged: boolean }
	| { readonly type: "knows-code"; readonly knowsCode: boolean };

/**
 * Nothing chosen. With a single rim the rim is not a choice (one disk size in the list), so it is taken; the SIZE
 * is never taken for the customer, however short the list.
 */
export function initialPickerState(data: TyrePickerData): PickerState {
	return { mode: "size", rim: data.rims.length === 1 ? data.rims[0].rim : "", size: "", acknowledged: false };
}

const sizesOfRim = (data: TyrePickerData, rim: string): readonly TyrePickerSize[] =>
	data.rims.find((group) => group.rim === rim)?.sizes ?? [];

export function reducePicker(data: TyrePickerData, state: PickerState, action: PickerAction): PickerState {
	switch (action.type) {
		case "rim":
			// A different rim starts the size over: a size of the old rim is not a choice on the new one.
			return action.rim === state.rim ? state : { ...state, rim: action.rim, size: "", acknowledged: false };
		case "size": {
			if (action.size === state.size) return state;
			// Only a size of the chosen rim can be chosen; anything else is no size.
			const known = sizesOfRim(data, state.rim).some((size) => size.label === action.size);
			return { ...state, size: known ? action.size : "", acknowledged: false };
		}
		case "acknowledge":
			return { ...state, acknowledged: action.acknowledged };
		case "knows-code":
			return { ...state, mode: action.knowsCode ? "code" : "size" };
	}
}

export interface PickerView {
	/** The sizes the second select offers: those of the chosen rim, none before a rim is chosen. */
	readonly sizeOptions: readonly TyrePickerSize[];
	/** The condition the chosen size carries, to be shown and ticked; null when there is none. */
	readonly condition: {
		readonly key: string;
		readonly mode: TyreConditionMode;
		readonly tyres: readonly string[];
	} | null;
	/** True when the form can be submitted: a listed size (with its condition ticked), or the customer's own "I know the code". */
	readonly complete: boolean;
	/** What the three hidden fields carry. */
	readonly fields: Readonly<Record<(typeof TYRE_FIELDS)[keyof typeof TYRE_FIELDS], string>>;
}

export function viewPicker(data: TyrePickerData, state: PickerState): PickerView {
	const sizeOptions = sizesOfRim(data, state.rim);
	const chosen = sizeOptions.find((size) => size.label === state.size);
	const listed = state.mode === "size" ? chosen : undefined;
	const condition =
		listed && listed.conditionKey !== "" && data.conditions[listed.conditionKey]
			? { key: listed.conditionKey, ...data.conditions[listed.conditionKey] }
			: null;
	const complete =
		state.mode === "code" || (listed !== undefined && (condition === null || state.acknowledged));

	return {
		sizeOptions,
		condition,
		complete,
		fields: {
			[TYRE_FIELDS.mode]: state.mode,
			[TYRE_FIELDS.size]: listed ? listed.label : "",
			// The condition travels only once it is ticked: ticking is the customer's acknowledgement.
			[TYRE_FIELDS.condition]: condition && state.acknowledged ? condition.key : "",
		},
	};
}
