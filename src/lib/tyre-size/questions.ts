import type { TyreCondition, TyreQuestion } from "./types";

/**
 * The question a tyre condition asks, and what an answer to it means.
 *
 * The list attaches to some sizes a condition on the tyre: a code fits "only on Kleber / Michelin / Continental" or
 * "on anything but those". The two kinds are two codes of one family that share a size and split the tyres between
 * them (195/75 R16: N16105 is the "only" one, N16128 the "not" one), so ONE question settles both: which of these
 * tyres do you have? The shopper answers it with a tap, the shop applies the list, and nothing is ticked as a promise.
 *
 * No I/O and nothing server-only: the page (client) draws the question, the server (cookie, add-to-cart check)
 * judges the answer, and both read this one definition.
 */

/** "None of the tyres the question names". The one answer that is not one of its options. */
export const NO_MATCH_ANSWER = "other";

/** The tyres joined into the key, sorted so the "only" and the "not" form of one condition are one question. */
export function tyreQuestionKey(tyres: readonly string[]): string {
	return [...tyres].sort().join("|");
}

/**
 * The question of a condition. A list that names a make alone ("Michelin") asks for the make; one that names a
 * model ("Michelin Alpin", "Bridgestone Duravis Rxxx") asks for the model, because owning a Michelin says nothing
 * about owning that Michelin.
 */
export function tyreQuestionOf(condition: Pick<TyreCondition, "tyres">): TyreQuestion {
	const subject = condition.tyres.some((tyre) => /\s/.test(tyre)) ? "model" : "make";
	return { key: tyreQuestionKey(condition.tyres), subject, options: [...condition.tyres] };
}

/** Is this a possible answer to the question: one of its options, or none of them? */
export function isAnswerTo(question: Pick<TyreQuestion, "options">, answer: unknown): answer is string {
	return typeof answer === "string" && (answer === NO_MATCH_ANSWER || question.options.includes(answer));
}

/**
 * Does the condition hold for a shopper who gave this answer? `only`: they have one of the named tyres. `not`: they
 * have none of them. An answer that is not an option of the question holds for nothing.
 */
export function answerFits(condition: Pick<TyreCondition, "mode" | "tyres">, answer: unknown): boolean {
	if (!isAnswerTo(tyreQuestionOf(condition), answer)) return false;
	return condition.mode === "only" ? answer !== NO_MATCH_ANSWER : answer === NO_MATCH_ANSWER;
}
