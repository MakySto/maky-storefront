/**
 * The quantity ceiling, in a module with NO directive — which is the whole point.
 *
 * It used to live in `quantity-stepper.tsx`, which is `"use client"`. `plp/actions.ts` is
 * `"use server"` and imported it from there, so on the server the constant did not arrive
 * as 99. `Math.min(qty, ceiling)` then produced `NaN`, `JSON.stringify` wrote it as
 * `null`, and Saleor refused the mutation — with the message
 * `Variable "$quantity" of required type "Int!" was not provided`, which is byte-identical
 * to the message for a genuinely absent key (measured against api.maky.store: null and
 * omitted give the same string). So the error named the wrong cause, and the value that
 * was actually wrong never appeared in it.
 *
 * The PDP never saw this: it passes a real `maxQuantity` from stock, so it never reaches
 * the fallback. The configurator has no quantity control and therefore reaches it EVERY
 * time — so add-to-cart from the configurator could not work at all, and the demo fixture
 * could not reveal it, because a demo card refuses to sell on purpose.
 *
 * A plain module can be imported from both sides. Nothing else changes.
 */
export const QUANTITY_FALLBACK_MAX = 99;

/**
 * Clamp a requested quantity to something Saleor will accept.
 *
 * Belt and braces, because the failure above was not merely a wrong number — it was a
 * number that stopped being one. `Math.min(1, undefined)` is `NaN`, `JSON.stringify`
 * writes `NaN` as `null`, and the API's complaint about a null variable is worded exactly
 * like its complaint about a missing one. Nothing between the mistake and the error
 * message said "quantity". So the ceiling is validated here rather than assumed, and the
 * result is guaranteed to be a positive integer no matter what either argument is.
 */
export function clampQuantity(requested: number, maxQuantity?: number | null): number {
	const ceiling =
		typeof maxQuantity === "number" && Number.isFinite(maxQuantity) && maxQuantity > 0
			? Math.trunc(maxQuantity)
			: QUANTITY_FALLBACK_MAX;
	if (typeof requested !== "number" || !Number.isFinite(requested)) return 1;
	const clamped = Math.min(Math.max(Math.trunc(requested), 1), ceiling);
	return Number.isFinite(clamped) && clamped >= 1 ? clamped : 1;
}
