import { type BodyType } from "@/lib/fitment/contract";
import { type GenerationCandidate } from "@/lib/fitment/selector-plan";

/** The words for a body type, in the `fitment` namespace. */
export const BODY_LABEL_KEYS: Record<BodyType, string> = {
	hatchback: "bodyHatchback",
	estate: "bodyEstate",
	saloon: "bodySaloon",
	suv: "bodySuv",
	mpv: "bodyMpv",
	van: "bodyVan",
	coupe: "bodyCoupe",
	convertible: "bodyConvertible",
	pickup: "bodyPickup",
};

/**
 * A generation candidate, named the way a person can answer it.
 *
 * Two generations sold in the same year is ordinary: the older one is still being sold when the
 * newer one arrives (owner, 2026-11-27), and the shopper knows which of the two they drive. So
 * where exactly two candidates start in different years they are called the older and the newer
 * generation, with the years each was built. The body type is said where it tells them apart, and
 * the internal name comes last, for the shopper who knows it: "B9" and "939" are our keys, and
 * asking somebody to pick between two of them alone is asking them to guess.
 *
 * Two candidates that start in the same year are not older and newer, and nothing is made up for
 * them: they read as before (body, years, name).
 */
export function candidateLabel(
	g: GenerationCandidate,
	t: (key: string) => string,
	candidates: readonly GenerationCandidate[] = [],
): string {
	const shapeOf = (c: GenerationCandidate) => (c.bodyTypes?.length === 1 ? c.bodyTypes[0]! : null);
	const other = candidates.length === 2 ? candidates.find((c) => c.id !== g.id) : undefined;
	const age =
		other && other.productionYearFrom !== g.productionYearFrom
			? t(
					g.productionYearFrom < other.productionYearFrom
						? "selector.generationOlder"
						: "selector.generationNewer",
				)
			: null;
	const own = shapeOf(g);
	// Beside "older" and "newer" the body is said only when it differs between the two.
	const shape = own && (!age || (other && shapeOf(other) !== own)) ? t(BODY_LABEL_KEYS[own]) : null;
	// An open-ended generation reads "2015\u2013", which is the ordinary way a production
	// span that has not ended is written.
	const span = `${g.productionYearFrom}\u2013${g.productionYearTo ?? ""}`;
	return [age, shape, span, g.name].filter(Boolean).join(" \u00b7 ");
}
