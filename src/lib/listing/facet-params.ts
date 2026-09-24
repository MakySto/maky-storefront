/**
 * The listing's attribute filters in the URL — `?brand=thule,menabo` and `?volume=300-400` —
 * and what each means to Saleor. Pure and shared: the page turns them into the product query,
 * the facets module counts the same bands, and the client builds the same links.
 */

/** Saleor's attribute slugs behind the two filters. */
export const BRAND_ATTRIBUTE_SLUG = "manufacturer";
export const VOLUME_ATTRIBUTE_SLUG = "volume";

const VALUE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_BRANDS = 12;

/** `?brand=` → the chosen makers' value slugs, validated; anything malformed is dropped. */
export function parseBrandParam(raw: string | null | undefined): string[] {
	if (!raw) return [];
	return [...new Set(raw.split(",").map((part) => part.trim().toLowerCase()))]
		.filter((slug) => VALUE_SLUG.test(slug))
		.slice(0, MAX_BRANDS);
}

/**
 * The volume bands, in litres — the approved category page's "Do 300 l · 300–400 l · 400–500 l
 * · Viac ako 500 l". A band holds its upper edge: 300 l is "Do 300 l".
 */
export const VOLUME_BANDS = [
	{ value: "0-300", max: 300 },
	{ value: "300-400", min: 300, max: 400 },
	{ value: "400-500", min: 400, max: 500 },
	{ value: "500-", min: 500 },
] as const satisfies readonly { value: string; min?: number; max?: number }[];

export type VolumeBand = (typeof VOLUME_BANDS)[number];

export function volumeBand(raw: string | null | undefined): VolumeBand | null {
	return VOLUME_BANDS.find((band) => band.value === raw) ?? null;
}

/** Which band a product's volume falls in. */
export function bandOfVolume(litres: number): VolumeBand | null {
	if (!Number.isFinite(litres) || litres <= 0) return null;
	return (
		VOLUME_BANDS.find(
			(band) => ("min" in band ? litres > band.min : true) && ("max" in band ? litres <= band.max : true),
		) ?? null
	);
}

/**
 * The band as Saleor's `valuesRange`. Its bounds are integers (`IntRangeInput` — a fractional
 * bound is refused outright) and inclusive on both ends, so the lower edge is the next whole
 * litre past the previous band's upper one: 300 l is "Do 300 l" alone, 301 l opens "300–400 l".
 * The catalogue states volumes in whole litres, which is what makes the two agree.
 */
export function volumeRange(band: VolumeBand): { gte?: number; lte?: number } {
	return {
		...("min" in band ? { gte: band.min + 1 } : {}),
		...("max" in band ? { lte: band.max } : {}),
	};
}
