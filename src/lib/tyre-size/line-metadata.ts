import type { TyreConditionMode, TyreLineChoice, TyreSelection } from "./types";

/**
 * What the cart line says about the tyre choice.
 *
 * Saleor copies a checkout line's public metadata onto the order line when the order is placed (verified against
 * the pinned Saleor source), so these keys are how the chosen size travels from the page to the order. They are
 * written only by the server action, from a choice it has checked against the list, and read back wherever a line
 * is shown: the cart, the checkout summary, the confirmation, the account's orders.
 *
 * Client-safe on purpose (no list, no server-only import): a cart component reads these without the list.
 */
export const TYRE_META = {
	mode: "maky_tyre_mode",
	size: "maky_tyre_size",
	conditionMode: "maky_tyre_condition_mode",
	conditionTyres: "maky_tyre_condition_tyres",
	list: "maky_tyre_list",
	basis: "maky_tyre_basis",
} as const;

/** Tyres in a condition are written on the line joined by this, which reads naturally to whoever packs the order. */
export const TYRE_LIST_SEPARATOR = " / ";

export type MetadataItem = { readonly key: string; readonly value: string };

/** The metadata to write on the line for a checked choice. Order is fixed so equal choices produce equal input. */
export function tyreSelectionToMetadata(selection: TyreSelection): MetadataItem[] {
	const items: MetadataItem[] = [
		{ key: TYRE_META.mode, value: selection.mode },
		{ key: TYRE_META.list, value: selection.listId },
	];
	if (selection.mode === "size") {
		items.push({ key: TYRE_META.size, value: selection.size });
		if (selection.condition) {
			items.push(
				{ key: TYRE_META.conditionMode, value: selection.condition.mode },
				{ key: TYRE_META.conditionTyres, value: selection.condition.tyres.join(TYRE_LIST_SEPARATOR) },
			);
		}
		items.push({ key: TYRE_META.basis, value: selection.basis });
	}
	return items;
}

const valueOf = (metadata: readonly MetadataItem[], key: string): string => {
	for (const item of metadata) {
		if (item.key === key) return item.value;
	}
	return "";
};

const isConditionMode = (value: string): value is TyreConditionMode => value === "only" || value === "not";

/**
 * The choice a line carries, or `null` for a line that carries none (every product that is not size-controlled,
 * and any line that was not written by the server action). A half-written choice is no choice: a size line
 * without a size, or a condition without its mode, reads as `null` so nothing half-true is shown.
 */
export function tyreChoiceFromMetadata(
	metadata: readonly MetadataItem[] | null | undefined,
): TyreLineChoice | null {
	if (!metadata || metadata.length === 0) return null;
	const mode = valueOf(metadata, TYRE_META.mode);
	if (mode === "code") return { mode: "code" };
	if (mode !== "size") return null;

	const size = valueOf(metadata, TYRE_META.size);
	if (size === "") return null;

	const conditionMode = valueOf(metadata, TYRE_META.conditionMode);
	const conditionTyres = valueOf(metadata, TYRE_META.conditionTyres);
	if (conditionMode === "" && conditionTyres === "") return { mode: "size", size, condition: null };
	if (!isConditionMode(conditionMode) || conditionTyres === "") return null;

	return {
		mode: "size",
		size,
		condition: { mode: conditionMode, tyres: conditionTyres.split(TYRE_LIST_SEPARATOR) },
	};
}

/**
 * A key that is equal for two lines exactly when they hold the same choice, and `""` for a line with none.
 * Adding the same size twice must raise the quantity of one line, not make a second line, and two different sizes
 * must never be merged: this is what tells them apart.
 */
export function tyreChoiceKey(choice: TyreLineChoice | null): string {
	if (!choice) return "";
	if (choice.mode === "code") return "code";
	const condition = choice.condition ? `${choice.condition.mode}:${choice.condition.tyres.join("|")}` : "";
	return `size|${choice.size}|${condition}`;
}

/** The key of the choice a checked selection will write, for finding the line it belongs to. */
export function tyreSelectionKey(selection: TyreSelection): string {
	return tyreChoiceKey(
		selection.mode === "code"
			? { mode: "code" }
			: { mode: "size", size: selection.size, condition: selection.condition },
	);
}
