import "server-only";

import { tyreFamilyCodes, tyreSizeLabelOf } from "./families";
import { answerFits, isAnswerTo, tyreQuestionOf } from "./questions";
import { isManufacturerListSource, tyreSizeIndex, tyreSizeProduct } from "./size-index";
import { isKnownTyreSize, tyreSizeEntries } from "./size-lookup";
import type { TyreAlternative, TyreCardFit, TyreFitView, TyreQuestion } from "./types";

/**
 * Does this snow chain fit the size the shopper gave, once what they said about their tyres is taken into account?
 *
 * One function answers it for the product page, the listing's narrowing and the cards, so the three can never disagree.
 * Every answer is read from the sealed lists (`velkosti`, and the model families beside it); nothing here is a guess.
 *
 * What it keeps apart, because each is a different sentence to the shopper:
 *
 *   - **A product that does not fit is not "a size nobody has".** When the code does not fit but another code of the
 *     same model does, the answer is that code ("for your tyres you need size 22,5"), not "does not fit".
 *   - **A size the lists do not hold is not a size that does not fit.** It is a size the shop cannot verify, and
 *     says exactly that.
 *   - **A condition on the tyres is a question, not a tick-box.** Unanswered, the code is a candidate and says what to
 *     ask; answered, the list decides, and the code is a yes or a no like any other.
 */

/** The answers the shopper has given, by question key (`questions.ts`). */
export type TyreAnswers = Readonly<Record<string, string>>;

export type Evaluation =
	| {
			readonly kind: "yes";
			readonly fromManufacturerList: boolean;
			readonly answer: string | null;
			readonly question: TyreQuestion | null;
	  }
	| { readonly kind: "ask"; readonly fromManufacturerList: boolean; readonly question: TyreQuestion }
	| { readonly kind: "no" };

/** One code against one size and the shopper's answers. `null` for a code that is not a size-controlled product. */
export function evaluateCode(
	code: string | null | undefined,
	size: string,
	answers: TyreAnswers = {},
): Evaluation | null {
	const product = tyreSizeProduct(code);
	if (!product) return null;
	const row = product.sizes.find(([label]) => label === size);
	if (!row) return { kind: "no" };

	const fromManufacturerList = isManufacturerListSource(product.source);
	const conditionKey = row[2];
	if (conditionKey === "") return { kind: "yes", fromManufacturerList, answer: null, question: null };

	const condition = tyreSizeIndex().conditions[conditionKey];
	const question = tyreQuestionOf(condition);
	const answer = Object.hasOwn(answers, question.key) ? answers[question.key] : undefined;
	if (!isAnswerTo(question, answer)) return { kind: "ask", fromManufacturerList, question };
	return answerFits(condition, answer)
		? { kind: "yes", fromManufacturerList, answer, question }
		: { kind: "no" };
}

const anythingFits = (size: string, answers: TyreAnswers): boolean =>
	tyreSizeEntries(size).some(({ code }) => evaluateCode(code, size, answers)?.kind !== "no");

/**
 * What the product page says about this code. `null` when it is not a size-controlled product (the page says nothing
 * about tyres). Alternatives carry no link: where a code is sold is the page's knowledge, not the list's.
 */
export function tyreViewOf(
	code: string | null | undefined,
	size: string | null | undefined,
	answers: TyreAnswers = {},
): TyreFitView | null {
	if (!tyreSizeProduct(code)) return null;
	if (!size) return { kind: "no-size" };
	if (!isKnownTyreSize(size)) return { kind: "unlisted", size };

	const own = evaluateCode(code, size, answers);
	if (own?.kind === "yes") {
		return {
			kind: "fits",
			size,
			fromManufacturerList: own.fromManufacturerList,
			answer: own.answer,
			question: own.question,
		};
	}
	if (own?.kind === "ask") return { kind: "ask", size, question: own.question };

	const alternatives: TyreAlternative[] = tyreFamilyCodes(code)
		.filter((other) => other !== code && evaluateCode(other, size, answers)?.kind !== "no")
		.map((other) => ({ code: other, sizeLabel: tyreSizeLabelOf(other), href: null }));
	if (alternatives.length > 0) return { kind: "other", size, alternatives, elsewhere: true };

	return { kind: "no-fit", size, elsewhere: anythingFits(size, answers) };
}

/**
 * The page's verdict once the shop's own offer is known.
 *
 * The lists say which codes are made for a size; which of them the shop SELLS is another fact, and most of the 145
 * codes are not published yet. "Other chains fit this size" is a promise about what the shopper can buy, so it stays
 * only while a published code fits (or may fit, depending on an answer still to be given). When none does, the page
 * says that nothing is on offer for this size and points at the people instead of at a list that cannot help.
 *
 * `published` is the set of codes the shop lists in this channel, or `null` when that could not be read, which leaves
 * the verdict as the lists gave it: the listing it points to says what it can. Only the two verdicts that promise
 * other chains (`other`, `no-fit`) are touched.
 */
export function withPublishedOffer(
	view: TyreFitView,
	published: ReadonlySet<string> | null,
	answers: TyreAnswers = {},
): TyreFitView {
	if ((view.kind !== "no-fit" && view.kind !== "other") || !view.elsewhere || published === null) return view;
	for (const code of fittingCodes(view.size, answers)) {
		if (published.has(code)) return view;
	}
	return { ...view, elsewhere: false };
}

/**
 * The codes a narrowed listing may show for a size: those that fit it, and those that fit it depending on an answer
 * the shopper has not given (the card says to ask). A code ruled out by an answer is not here.
 */
export function fittingCodes(size: string, answers: TyreAnswers = {}): Set<string> {
	const codes = new Set<string>();
	for (const { code } of tyreSizeEntries(size)) {
		if (evaluateCode(code, size, answers)?.kind !== "no") codes.add(code);
	}
	return codes;
}

/**
 * What a listing card says; `null` for a card that is not a size-controlled product.
 *
 * A size the shop holds for the product is a "fits", whichever list it came from: the owner's rule (2026-11-07) is that
 * a card is green when the product has the shopper's size and is not shown at all (in the narrowed list) when it does
 * not. The source stays on the view (`fromManufacturerList`), where the product page puts it in small words.
 */
export function tyreCardFitOf(
	code: string | null | undefined,
	size: string,
	answers: TyreAnswers = {},
): TyreCardFit | null {
	const evaluation = evaluateCode(code, size, answers);
	if (!evaluation) return null;
	if (evaluation.kind === "no") return { size, kind: "no-fit" };
	if (evaluation.kind === "ask") return { size, kind: "ask" };
	return { size, kind: "fits", answer: evaluation.answer };
}
