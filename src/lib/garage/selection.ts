import { type FitmentDataset, type VehicleSelection } from "@/lib/fitment/contract";
import { roofChoicesFor } from "@/lib/fitment/selector-plan";

/**
 * Normalising a vehicle selection against the dataset — the pure half of `chooseVehicle`.
 *
 * Separate from `actions.ts` because that module is `"use server"` and may export nothing
 * but async functions, and because the rule below is worth testing directly. It is a rule
 * about what we are entitled to claim, and it was wrong in a way no type could catch.
 *
 * THE SPLIT, which is the whole content of this file:
 *
 *   - `bodyType` and `doors` with a single possible value are FILLED IN. That is not
 *     guessing. They are properties of the generation the shopper has already chosen —
 *     a generation sold only as an SUV is an SUV — so the question is genuinely resolved
 *     and answering it for them costs nothing.
 *
 *   - `roofType` is NEVER filled in. The roof is fitted per car, and our list of the
 *     roofs a generation came with is a record of what CFM mapped, not the manufacturer's
 *     options list. "We only hold data for raised rails" is a fact about our catalogue;
 *     what is on the shopper's roof is a fact about their car, and the first has never
 *     been evidence for the second.
 *
 * The old code applied the first rule to both, and it was not a missing question — it was
 * an invented answer. Measured on the committed fixture: with `roofTypes: ["raised-rails"]`
 * and no answer from the shopper, normalisation returned `"raised-rails"`, the vehicle was
 * stored carrying it, and every surface downstream then reported a verified fit on a roof
 * nobody had confirmed. That is the part that decides whether the feet attach to the car
 * at all.
 */
export type QualifierResolution<T> = T | "invalid" | undefined;

/**
 * A qualifier that IS settled by having one value: store it, whether or not it was asked.
 */
export function resolveQualifier<T>(
	available: T[] | undefined,
	answer: T | undefined,
): QualifierResolution<T> {
	if (!available || available.length === 0) return undefined;
	if (available.length === 1) {
		const only = available[0]!;
		if (answer !== undefined && answer !== only) return "invalid";
		return only;
	}
	if (answer === undefined || !available.includes(answer)) return "invalid";
	return answer;
}

/**
 * The roof answer: stored when given, never invented when not.
 *
 * "Iný typ" and "Neviem rozpoznať" both arrive here as `undefined`, and both must leave as
 * `undefined`. Refusing the save instead would be wrong too — the car is real and the
 * shopper is entitled to keep it in their garage; what we may not do is claim to know its
 * roof. Without one the resolver answers that it cannot confirm, which is true.
 */
export function resolveRoofAnswer<T>(available: T[], answer: T | undefined): QualifierResolution<T> {
	if (answer === undefined) return undefined;
	if (available.length === 0) return undefined;
	return available.includes(answer) ? answer : "invalid";
}

/** The roofs the SELECTOR offered, so the garage validates against the same list. */
export function roofOptionsFor(
	dataset: Pick<FitmentDataset, "applications">,
	generation: { id: string; qualifiers?: { roofTypes?: VehicleSelection["roofType"][] } },
) {
	return roofChoicesFor(dataset.applications, {
		id: generation.id,
		roofTypes:
			generation.qualifiers?.roofTypes?.filter((r): r is NonNullable<typeof r> => Boolean(r)) ?? null,
	});
}
