import { cacheLife, cacheTag } from "next/cache";
import { CategoryFacetsDocument, type CategoryFacetsQuery } from "@/gql/graphql";
import { getLocaleFromChannel } from "@/config/locale";
import { CACHE_PROFILES, buildTag } from "@/lib/cache-manifest";
import { executePublicGraphQL } from "@/lib/graphql";
import { VOLUME_BANDS, bandOfVolume } from "./facet-params";

/**
 * The makers and the volume bands a category holds in a channel, with how many products each —
 * the "Značka" and "Objem" sections of the listing's filter panel (second pass, 2026-09-24).
 *
 * Data-backed only: a maker is offered because products of it are on this shelf, a band because
 * products of that volume are. Read whole up to `READ_ALL_LIMIT` products (every main category
 * but the roof-rack sets, which are one make's thousands of vehicle-specific sets and have the
 * vehicle filter instead); above it there are no facets and the sections are not shown. The
 * counts describe the category, not the page or the other filters in force — like the price
 * bands, one cached answer serves every visit.
 */

export interface BrandFacet {
	readonly slug: string;
	readonly name: string;
	readonly count: number;
}

export interface VolumeFacet {
	readonly value: string;
	readonly count: number;
}

export interface CategoryFacets {
	/** At least two makers, most products first; otherwise empty. */
	readonly brands: readonly BrandFacet[];
	/** The bands that hold something, in order; empty when volume is not this shelf's fact. */
	readonly volumes: readonly VolumeFacet[];
}

const READ_ALL_LIMIT = 300;
const PAGE = 100;
const DEADLINE_MS = 2_000;
/** The volume filter is offered when most of the shelf states a volume. */
const VOLUME_SHARE = 0.4;

type Node = NonNullable<NonNullable<CategoryFacetsQuery["category"]>["products"]>["edges"][number]["node"];

/** Pure half of `getCategoryFacets`, exported for its test. */
export function facetsFromNodes(nodes: readonly Node[]): CategoryFacets {
	const brands = new Map<string, { name: string; count: number }>();
	const volumes = new Map<string, number>();
	let withVolume = 0;

	for (const node of nodes) {
		const brand = node.brand?.values?.[0];
		if (brand?.slug && brand.name) {
			const entry = brands.get(brand.slug) ?? { name: brand.name, count: 0 };
			entry.count += 1;
			brands.set(brand.slug, entry);
		}
		const litres = Number.parseFloat(node.volume?.values?.[0]?.name ?? "");
		const band = bandOfVolume(litres);
		if (band) {
			withVolume += 1;
			volumes.set(band.value, (volumes.get(band.value) ?? 0) + 1);
		}
	}

	const brandList = [...brands.entries()]
		.map(([slug, { name, count }]) => ({ slug, name, count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
	const volumeList = VOLUME_BANDS.flatMap((band) => {
		const count = volumes.get(band.value) ?? 0;
		return count > 0 ? [{ value: band.value, count }] : [];
	});

	return {
		brands: brandList.length >= 2 ? brandList : [],
		volumes:
			nodes.length > 0 && withVolume / nodes.length >= VOLUME_SHARE && volumeList.length >= 2
				? volumeList
				: [],
	};
}

export async function getCategoryFacets(baseSlug: string, channel: string): Promise<CategoryFacets | null> {
	"use cache";
	const locale = getLocaleFromChannel(channel);
	cacheLife(CACHE_PROFILES.categories.cacheProfile);
	cacheTag(buildTag(CACHE_PROFILES.categories, { channel, locale, slug: baseSlug }));

	const read = async (after: string | null) => {
		const result = await executePublicGraphQL(CategoryFacetsDocument, {
			variables: { slug: baseSlug, channel, first: PAGE, after },
			revalidate: 0,
			retry: false,
			signal: AbortSignal.timeout(DEADLINE_MS),
		});
		// Thrown, never cached: an outage must not become "no filters" for minutes.
		if (!result.ok) throw new Error(`[Listing] facets unavailable for ${baseSlug}: ${result.error.message}`);
		return result.data.category?.products ?? null;
	};

	let page = await read(null);
	if (!page || (page.totalCount ?? 0) > READ_ALL_LIMIT) return null;
	const nodes: Node[] = page.edges.map(({ node }) => node);
	while (page.pageInfo.hasNextPage) {
		const next = await read(page.pageInfo.endCursor ?? null);
		if (!next) break;
		nodes.push(...next.edges.map(({ node }) => node));
		page = next;
	}
	return facetsFromNodes(nodes);
}
