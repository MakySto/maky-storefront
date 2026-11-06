import "server-only";

import { isManufacturerListSource, tyreSizeIndex, tyreSizeProduct } from "./size-index";
import type { TyreFit, TyreFitView } from "./types";

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

/** The codes whose list holds this size (ascending), with the condition each attaches. Empty for an unknown size. */
export function tyreSizeEntries(size: string): readonly SizeEntry[] {
	return build().bySize.get(size) ?? [];
}

export type { TyreFit };

/**
 * Does the product with this public code fit this size? `null` when the code is not one of the size-controlled
 * products, or no size is known: there is nothing to say about those, and nothing is said.
 */
export function tyreFit(code: string | null | undefined, size: string | null | undefined): TyreFit | null {
	if (typeof size !== "string" || size === "") return null;
	const product = tyreSizeProduct(code);
	if (!product) return null;

	const row = product.sizes.find(([label]) => label === size);
	if (!row) return { kind: "no-fit", size };

	const conditionKey = row[2];
	const listed = conditionKey === "" ? null : tyreSizeIndex().conditions[conditionKey];
	return {
		kind: "fits",
		size,
		fromManufacturerList: isManufacturerListSource(product.source),
		condition: listed ? { key: conditionKey, mode: listed.mode, tyres: [...listed.tyres] } : null,
	};
}

/**
 * What the product page needs for one product: `null` when it is not size-controlled (the page says nothing about
 * tyres), `no-size` when it is and the shopper has not told the shop a size, the verdict otherwise.
 */
export function tyreFitViewOf(
	code: string | null | undefined,
	size: string | null | undefined,
): TyreFitView | null {
	if (!tyreSizeProduct(code)) return null;
	return tyreFit(code, size) ?? { kind: "no-size" };
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
