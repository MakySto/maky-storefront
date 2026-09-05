/**
 * Rendering mounting conditions. Pure — no I/O, no React.
 *
 * The first version of this had a bug that is easy to write and hard to see: it rendered
 * conditions ONLY from a hardcoded code→i18n map and ignored `condition.text` entirely.
 * A source-authored condition with perfectly good Slovak copy was therefore dropped,
 * silently, and the green "fits" badge stayed exactly as it was. A mounting restriction
 * that disappears while the reassurance remains is the worst possible combination.
 *
 * Order of preference, and the third branch is the point:
 *
 *   1. Source-approved text for THIS locale.
 *   2. An approved translation of a known stable code.
 *   3. Neither — the condition is counted as UNRESOLVED. It is not silently dropped, and
 *      a verdict carrying one may not present as an unconditional fit.
 *
 * Missing copy is a reason to stop promising, not a reason to claim NO_FIT. The product
 * may well fit; we just cannot state the condition attached to that fit.
 */

import { type FitmentCondition } from "./contract";

export type RenderedCondition = {
	code: string;
	text: string;
	/** Whether the copy came from the source payload or from our own message catalogue. */
	source: "dataset" | "i18n";
};

export type ConditionRendering = {
	resolved: RenderedCondition[];
	/** Conditions that exist but cannot be stated in this locale. */
	unresolvedCount: number;
};

/**
 * Locale fallback for source text.
 *
 * Exact match first. `de-AT` then falls back to `de-DE`, because they share one Saleor
 * translation row and a source that authors German once should not go unrendered in
 * Austria. It deliberately does NOT fall back to Slovak: a Slovak mounting instruction
 * on a German page is not a translation, it is an untranslated string that looks
 * authoritative.
 */
export function pickConditionText(text: Record<string, string> | undefined, locale: string): string | null {
	if (!text) return null;
	const exact = text[locale];
	if (exact?.trim()) return exact;
	const language = locale.split("-")[0];
	if (language === "de") {
		const german = text["de-DE"] ?? text["de-AT"];
		if (german?.trim()) return german;
	}
	return null;
}

/**
 * Resolve a list of conditions for one locale.
 *
 * `translateCode` returns null when the code has no approved translation — it must not
 * invent one, and it must not echo the raw code back to a customer.
 */
export function renderConditions(
	conditions: FitmentCondition[],
	locale: string,
	translateCode: (code: string) => string | null,
): ConditionRendering {
	const resolved: RenderedCondition[] = [];
	// De-duplication is by code AND rendered text, never by code alone: two conditions
	// sharing a code but carrying different parameters are two different restrictions,
	// and collapsing them would delete one of them.
	const seen = new Set<string>();
	let unresolvedCount = 0;

	for (const condition of conditions) {
		const fromSource = pickConditionText(condition.text, locale);
		const text = fromSource ?? translateCode(condition.code);
		if (!text) {
			unresolvedCount += 1;
			continue;
		}
		const key = `${condition.code}::${text}`;
		if (seen.has(key)) continue;
		seen.add(key);
		resolved.push({
			code: condition.code,
			text,
			source: fromSource ? "dataset" : "i18n",
		});
	}

	return { resolved, unresolvedCount };
}

/**
 * Whether a verified fit may still be presented as an unconditional one.
 *
 * A fit with a condition we cannot state is a qualified fit, and the UI has to say so.
 */
export function isUnconditional(rendering: ConditionRendering): boolean {
	return rendering.unresolvedCount === 0;
}
