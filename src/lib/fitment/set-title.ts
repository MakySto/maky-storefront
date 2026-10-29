import type { FitmentDataset } from "./contract";

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
	/** The car as the name spells it, without the years: "Dacia Bigster". */
	vehicle: string;
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Index of the last whole-word occurrence of `needle` in `haystack` (case-insensitive), or -1. */
function lastWordIndex(haystack: string, needle: string): number {
	const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escape(needle)})(?![\\p{L}\\p{N}])`, "giu");
	let found = -1;
	for (let match = pattern.exec(haystack); match; match = pattern.exec(haystack)) {
		found = match.index + match[1]!.length;
	}
	return found;
}

export function splitSetTitle(
	name: string,
	options: { brand?: string | null; makes: readonly string[] },
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
		const at = lastWordIndex(body, brand);
		// The product type before the maker ("Strešný nosič") is the shelf's own label.
		if (at > 0) from = at;
	}
	const rest = body.slice(from);

	// The vehicle starts at the LAST make named in the sentence: a line called "Evo" or a variant that
	// shares a word with a make comes before the car, never after it.
	let split = -1;
	let makeLength = 0;
	for (const make of options.makes) {
		const at = lastWordIndex(rest, make);
		if (at > split || (at === split && make.length > makeLength)) {
			split = at;
			makeLength = make.length;
		}
	}
	if (split <= 0) return null;

	const model = rest.slice(0, split).trim();
	const vehicle = rest.slice(split).trim();
	if (!model || !vehicle) return null;
	return { model, vehicle };
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
