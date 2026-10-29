import type { FitmentDataset } from "./contract";
import type { SetVehicle } from "./set-vehicle";

/**
 * A roof-rack set's catalogue name, read as the parts a shopper scans a shelf by.
 *
 * The name is one long sentence by construction — `Strešný nosič Nordrive Silenzio Silver Dacia
 * Bigster (2025–) — Klasické lyžiny` — and a card that prints it AND the roof and the years under
 * it says everything twice. This takes the sentence apart for the card's own layout:
 *
 *   model     Nordrive Silenzio Silver      what is being sold
 *   vehicle   Dacia Bigster                 what it is for, as the name says it
 *
 * It is a PRESENTATION of the name and nothing else: the product keeps its name, its URL and its SEO
 * title, and the roof and the years still come from the set's own application, not from this. The
 * split is conservative on purpose. It needs the maker of the car (a make the fitment export knows)
 * to find where the vehicle starts; when the name does not hold up to that, the answer is `null` and
 * the card prints the whole name exactly as the catalogue wrote it. Nothing is ever dropped from
 * what the shopper reads: a wrong split moves words between two lines, it does not remove them.
 */
export type SetTitle = {
	/** The product: maker, line and variant. The product type word ("Strešný nosič") is left out. */
	model: string;
	/** The car, without the years: "Dacia Bigster", as the dataset names it when it can, else as the name spells it. */
	vehicle: string;
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Hit = { start: number; end: number };

/** Every whole-word occurrence of `needle` in `haystack` (case-insensitive). */
function wordHits(haystack: string, needle: string): Hit[] {
	const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escape(needle)})(?![\\p{L}\\p{N}])`, "giu");
	const hits: Hit[] = [];
	for (let match = pattern.exec(haystack); match; match = pattern.exec(haystack)) {
		const start = match.index + match[1]!.length;
		hits.push({ start, end: start + match[2]!.length });
	}
	return hits;
}

/**
 * Where the car starts: the last make named in the sentence, a make that is only part of a longer
 * one ("Rover" inside "Land Rover") not counting.
 */
function carStart(rest: string, makes: readonly string[]): number {
	const hits = makes.flatMap((make) => wordHits(rest, make));
	const alone = hits.filter(
		(hit) =>
			!hits.some(
				(other) =>
					other.end - other.start > hit.end - hit.start && other.start <= hit.start && other.end >= hit.end,
			),
	);
	return alone.reduce((last, hit) => Math.max(last, hit.start), -1);
}

export function splitSetTitle(
	name: string,
	options: {
		brand?: string | null;
		makes: readonly string[];
		/**
		 * The car(s) the set's own application is for. With them the car starts at THEIR maker and nowhere
		 * else — a product line or a model that is also a maker ("Punto Evo", "Thule WingBar Evo") cannot
		 * be taken for it — and when the name's car is one of them (its generation is named there too) the
		 * car is worded the way the rest of the shop words it. A name that does not confirm any of them
		 * keeps its own words for the car. Without them, the car is whatever the name says after the last
		 * maker the export knows.
		 */
		vehicles?: readonly SetVehicle[];
	},
): SetTitle | null {
	// The roof type rides after the dash and the years in the last parentheses; both are told by the
	// set's application, so neither is needed here.
	const dash = name.lastIndexOf(" — ");
	const head = dash >= 0 ? name.slice(0, dash) : name;
	const body = head.replace(/\s*\([^()]*\)\s*$/, "").trim();
	if (!body) return null;

	let from = 0;
	const brand = options.brand?.trim();
	if (brand) {
		const at = wordHits(body, brand).reduce((last, hit) => Math.max(last, hit.start), -1);
		// The product type before the maker ("Strešný nosič") is the shelf's own label.
		if (at > 0) from = at;
	}
	const rest = body.slice(from);

	// The vehicle starts at the LAST make named in the sentence: a line called "Evo" or a variant that
	// shares a word with a make comes before the car, never after it.
	const own = options.vehicles ?? [];
	const split = carStart(rest, own.length > 0 ? own.flatMap((vehicle) => vehicle.make) : options.makes);
	if (split <= 0) return null;

	const model = rest.slice(0, split).trim();
	const spelled = rest.slice(split).trim();
	if (!model || !spelled) return null;
	// Worded the shop's way only when the name itself says it is that car.
	const confirmed = own.find((vehicle) =>
		vehicle.generation.some((generation) => wordHits(spelled, generation).length > 0),
	);
	return { model, vehicle: confirmed ? confirmed.label : spelled };
}

const MAKES = new WeakMap<FitmentDataset, readonly string[]>();

/** The makes of one dataset, longest first, so "Land Rover" is tried before "Rover". */
export function datasetMakeNames(dataset: FitmentDataset): readonly string[] {
	let names = MAKES.get(dataset);
	if (!names) {
		names = [...new Set(dataset.makes.map((make) => make.name.trim()).filter(Boolean))].sort(
			(a, b) => b.length - a.length,
		);
		MAKES.set(dataset, names);
	}
	return names;
}
