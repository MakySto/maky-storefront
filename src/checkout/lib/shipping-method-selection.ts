/**
 * Shipping-method selection truthfulness (krok 1 acceptance, browser-proven 2026-07-19).
 *
 * Invariants encoded here, consumed by the ShippingStep view:
 *  - the UI never marks a method as selected unless the server has it persisted;
 *  - a SOLE available method is auto-saved immediately (then shown selected);
 *  - with multiple methods nothing is preselected until the user picks;
 *  - a Warehouse (click & collect) deliveryMethod id never resolves to a shipping method.
 *
 * Kept as pure functions because the repo's vitest environment is node-only (no DOM renderer),
 * so the multi-method matrix is covered here rather than via component rendering.
 */

type MethodLike = { id: string };

/** The server-persisted ShippingMethod id, or undefined when none/unknown/Warehouse. */
export function resolvePersistedMethodId(
	deliveryMethodId: string | null | undefined,
	methods: readonly MethodLike[],
): string | undefined {
	if (!deliveryMethodId) {
		return undefined;
	}
	return methods.some((m) => m.id === deliveryMethodId) ? deliveryMethodId : undefined;
}

/**
 * The method id to auto-save on mount, or null when no auto-save must happen.
 * Auto-save fires only for a sole available method with nothing persisted server-side.
 */
export function resolveSoleMethodToAutoSave(
	persistedMethodId: string | undefined,
	methods: readonly MethodLike[],
): string | null {
	if (persistedMethodId || methods.length !== 1) {
		return null;
	}
	return methods[0]?.id ?? null;
}
