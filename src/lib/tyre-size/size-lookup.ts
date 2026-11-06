import "server-only";

import { tyreSizeIndex } from "./size-index";

/**
 * The tyre-size list seen from the size's side.
 *
 * `size-index.ts` answers "which sizes does this code fit". The customer asks the other way round: "which
 * products fit MY tyres". This module turns the same list over, once, and answers that, without a second source:
 * every answer here is read from the sealed list and nothing is added to it. A size is a label exactly as the
 * list spells it (`205/55 R16`, `175 R13`, `4.00-12`); what the customer types is only ever MATCHED to such a
 * label, never converted into a neighbour, rounded, or completed.
 */

/** One row of the list from the size's side: a code that fits it, and the condition the list attaches. */
export interface SizeEntry {
	readonly code: string;
	/** Key into the list's conditions; "" when the size carries none. */
	readonly conditionKey: string;
}

/** `205/55 R16`: width in mm, profile in %, rim in inches. The shape the steps and the badges are built on. */
const STANDARD_LABEL = /^(\d{3})\/(\d{2}) R(\d{2})$/;

/**
 * The spellings of the standard shape a customer copies off a tyre or types from memory: `205/55R16`,
 * `205 55 16`, `205/55-16`, `205/55 ZR16`, `205/55 R16 91V` (with the load index and speed symbol that follow the
 * size on the sidewall), or the bare digits `2055516`. Matched to the list afterwards: a spelling of a size the list
 * does not hold is no size.
 */
const STANDARD_TEXT =
	/^(\d{3})\s*[/\s.-]?\s*(\d{2})\s*(?:[/\s-]\s*)?(?:z?r)?\s*(\d{2})(?:\s*\d{2,3}\s*[a-z]{1,2})?$/i;

/**
 * How two spellings of the same size compare: case, spacing and the decimal separator do not matter (`R17,5` and
 * `r17.5` are one size, `205/55R16` and `205/55 R16` are one size). Nothing else is forgiven.
 */
export function tyreSizeKey(text: string): string {
	return text.normalize("NFKC").toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
}

interface Lookup {
	/** The list's label → the codes that fit it, ascending by code. */
	readonly bySize: ReadonlyMap<string, readonly SizeEntry[]>;
	/** `tyreSizeKey` of a label → the label. */
	readonly byKey: ReadonlyMap<string, string>;
	/** Standard labels only, for the steps: width → profile → rims (numerically ascending). */
	readonly standard: ReadonlyMap<number, ReadonlyMap<number, readonly string[]>>;
	/** The widths that fit the most codes, most first: what the first step offers before "more". */
	readonly commonWidths: ReadonlySet<number>;
}

/** How many widths the first step offers before "more": enough for the usual passenger and van sizes. */
const COMMON_WIDTHS = 12;

let lookup: Lookup | null = null;

function build(): Lookup {
	if (lookup) return lookup;

	const bySize = new Map<string, SizeEntry[]>();
	for (const [code, product] of Object.entries(tyreSizeIndex().products)) {
		for (const [label, , conditionKey] of product.sizes) {
			const entries = bySize.get(label) ?? [];
			entries.push({ code, conditionKey });
			bySize.set(label, entries);
		}
	}
	for (const entries of bySize.values())
		entries.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

	const byKey = new Map<string, string>();
	for (const label of bySize.keys()) {
		const key = tyreSizeKey(label);
		const clash = byKey.get(key);
		// Two labels that differ only in spacing, case or the decimal separator would make a typed size ambiguous.
		if (clash !== undefined)
			throw new Error(`tyre-size lookup: ${clash} and ${label} are one size to a customer`);
		byKey.set(key, label);
	}

	const profilesByWidth = new Map<number, Map<number, Set<string>>>();
	const codesByWidth = new Map<number, Set<string>>();
	for (const [label, entries] of bySize) {
		const match = STANDARD_LABEL.exec(label);
		if (!match) continue;
		const width = Number(match[1]);
		const profile = Number(match[2]);
		const profiles = profilesByWidth.get(width) ?? new Map<number, Set<string>>();
		const rims = profiles.get(profile) ?? new Set<string>();
		rims.add(match[3]);
		profiles.set(profile, rims);
		profilesByWidth.set(width, profiles);
		const codes = codesByWidth.get(width) ?? new Set<string>();
		for (const entry of entries) codes.add(entry.code);
		codesByWidth.set(width, codes);
	}

	const standard = new Map<number, ReadonlyMap<number, readonly string[]>>();
	for (const [width, profiles] of profilesByWidth) {
		standard.set(
			width,
			new Map(
				[...profiles].map(([profile, rims]) => [
					profile,
					[...rims].sort((a, b) => Number.parseFloat(a) - Number.parseFloat(b)),
				]),
			),
		);
	}

	const common = [...codesByWidth]
		.sort(([widthA, codesA], [widthB, codesB]) => codesB.size - codesA.size || widthA - widthB)
		.slice(0, COMMON_WIDTHS)
		.map(([width]) => width);

	lookup = { bySize, byKey, standard, commonWidths: new Set(common) };
	return lookup;
}

/** Is this label one of the list's sizes, spelled as the list spells it? */
export function isKnownTyreSize(size: unknown): size is string {
	return typeof size === "string" && build().bySize.has(size);
}

/**
 * What a customer typed or copied, matched to the list's own label, or `null` when the list holds no such size.
 *
 * The list's spelling wins: `205/55r16` finds `205/55 R16`, and it is `205/55 R16` that is remembered and shown.
 */
export function resolveTyreText(text: unknown): string | null {
	if (typeof text !== "string") return null;
	const cleaned = text.normalize("NFKC").trim();
	if (cleaned === "" || cleaned.length > 40) return null;

	const { bySize, byKey } = build();
	const direct = byKey.get(tyreSizeKey(cleaned));
	if (direct !== undefined) return direct;

	const spelled = STANDARD_TEXT.exec(cleaned);
	if (spelled) {
		const label = `${spelled[1]}/${spelled[2]} R${spelled[3]}`;
		if (bySize.has(label)) return label;
	}
	return null;
}

/**
 * A size no list holds, but a well-formed one: the shop can match nothing to it and so cannot verify it. The limits are
 * those of tyres that exist (width 125-395 mm, profile 25-90 %, rim 10-24"), so a mistyped "205/55 R61" is no size.
 */
function plausibleStandardLabel(width: number, profile: number, rim: number): string | null {
	return width >= 125 && width <= 395 && profile >= 25 && profile <= 90 && rim >= 10 && rim <= 24
		? `${width}/${profile} R${rim}`
		: null;
}

/** Is this label a well-formed standard size (`205/55 R16`) in the range of tyres that exist? */
export function isPlausibleTyreSize(size: unknown): size is string {
	if (typeof size !== "string") return false;
	const match = STANDARD_LABEL.exec(size);
	return (
		match !== null && plausibleStandardLabel(Number(match[1]), Number(match[2]), Number(match[3])) === size
	);
}

/** Can the shop remember this as the shopper's size: a size of the list, or a well-formed one the list does not hold? */
export const isRememberableTyreSize = (size: unknown): size is string =>
	isKnownTyreSize(size) || isPlausibleTyreSize(size);

/**
 * What a shopper typed, matched to the list's own label (`listed`), or, failing that, read as a well-formed standard
 * size the list does not hold (`unlisted`: remembered, but the shop says it cannot verify it). `null` is no size at all.
 *
 * Whether the shop SELLS something for a size and whether the size is a real size are two different questions: a
 * customer with 255/40 R19 has a perfectly good tyre, and "we do not know that size" would be an insult.
 */
export function resolveTyreInput(text: unknown): { label: string; listed: boolean } | null {
	const listed = resolveTyreText(text);
	if (listed !== null) return { label: listed, listed: true };
	if (typeof text !== "string") return null;
	const cleaned = text.normalize("NFKC").trim();
	if (cleaned === "" || cleaned.length > 40) return null;
	const spelled = STANDARD_TEXT.exec(cleaned);
	if (!spelled) return null;
	const label = plausibleStandardLabel(Number(spelled[1]), Number(spelled[2]), Number(spelled[3]));
	return label === null ? null : { label, listed: false };
}

/** The codes whose list holds this size (ascending), with the condition each attaches. Empty for an unknown size. */
export function tyreSizeEntries(size: string): readonly SizeEntry[] {
	return build().bySize.get(size) ?? [];
}

export interface TyreSteps {
	/** Every width of a standard size, ascending. `common` marks the ones the first step offers up front. */
	readonly widths: readonly { readonly value: number; readonly common: boolean }[];
	/** The profiles that exist for the chosen width; `null` before a width is chosen. */
	readonly profiles: readonly number[] | null;
	/** The rim diameters (inches, as the list writes them) that exist for the chosen width and profile. */
	readonly rims: readonly string[] | null;
}

/**
 * What the step-by-step way offers next. Only combinations the list holds are offered, so every path through the
 * steps ends on a size the list has.
 */
export function tyreSteps(width?: number, profile?: number): TyreSteps {
	const { standard, commonWidths } = build();
	const widths = [...standard.keys()]
		.sort((a, b) => a - b)
		.map((value) => ({ value, common: commonWidths.has(value) }));

	const profilesOfWidth = width === undefined ? null : standard.get(width) ?? null;
	const profiles =
		width === undefined ? null : profilesOfWidth ? [...profilesOfWidth.keys()].sort((a, b) => a - b) : [];
	const rims =
		profile === undefined || width === undefined ? null : profilesOfWidth?.get(profile)?.slice() ?? [];

	return { widths, profiles, rims };
}

/** The list's label for a width, a profile and a rim chosen in the steps, or `null` when the list holds no such size. */
export function tyreLabelFromSteps(width: unknown, profile: unknown, rim: unknown): string | null {
	if (typeof width !== "number" || typeof profile !== "number" || typeof rim !== "string") return null;
	const label = `${width}/${profile} R${rim}`;
	return STANDARD_LABEL.test(label) && build().bySize.has(label) ? label : null;
}
