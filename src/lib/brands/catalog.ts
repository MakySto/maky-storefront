import { cacheLife, cacheTag } from "next/cache";
import { BrandValuesDocument } from "@/gql/graphql";
import { executePublicGraphQL, executeRawGraphQL } from "@/lib/graphql";
import { getCmsBrands, type CmsBrand } from "@/lib/cms/brands";

/**
 * The shop's brands for one market: Saleor's makers that this channel sells, dressed with the
 * owner's entries from Payload where there is one (`lib/cms/brands.ts`).
 *
 * Saleor is the source of WHICH brands exist — the `manufacturer` attribute every product
 * carries, filled by CFM — so a brand page can never list products the catalogue does not tie
 * to it. Payload is the source of how a brand PRESENTS: logo, description, banner. A maker with
 * no products in this channel has no page here; "Neznačkové" (unbranded) is never a brand.
 *
 * `approved` marks the makers CLAUDE.md §6 clears for the homepage. Every stocked maker gets a
 * page — it is catalogue navigation, like the maker's name on its product cards — but only the
 * approved ones are promoted in the homepage strip.
 */

export interface Brand {
	readonly slug: string;
	readonly name: string;
	readonly productCount: number;
	readonly approved: boolean;
	readonly logo: CmsBrand["logo"];
	readonly heroImage: CmsBrand["heroImage"];
	readonly shortDescription: string | null;
}

/** CLAUDE.md §6: the makers the homepage may show, by their Saleor slug, in the strip's order. */
export const HOMEPAGE_BRAND_SLUGS: readonly string[] = [
	"thule",
	"yakima",
	"menabo",
	"nordrive",
	"peruzzo",
	"pro-user",
	"spinder",
	"green-valley",
	"snowdrive",
	"dac",
];

const VALUE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Not a maker: the catalogue's value for products without one. */
const NOT_A_BRAND: ReadonlySet<string> = new Set(["neznackove"]);

const DEADLINE_MS = 2_500;

async function saleorBrands(
	channel: string,
): Promise<{ slug: string; name: string; productCount: number }[]> {
	"use cache";
	cacheLife("hours");
	cacheTag("brands", `brands:${channel}`);

	const values = await executePublicGraphQL(BrandValuesDocument, {
		revalidate: 0,
		retry: false,
		signal: AbortSignal.timeout(DEADLINE_MS),
	});
	// Thrown, never cached: an outage must not become "this shop has no brands" for hours.
	if (!values.ok) throw new Error(`[Brands] makers unavailable: ${values.error.message}`);

	const makers = (values.data.attribute?.choices?.edges ?? [])
		.map(({ node }) => ({ slug: node.slug ?? "", name: node.name ?? "" }))
		.filter((maker) => maker.slug && maker.name && !NOT_A_BRAND.has(maker.slug));

	// One request for every maker's count, each an aliased `products(...) { totalCount }` —
	// instead of twenty-odd round trips per market. The slugs come from Saleor and are checked
	// against the slug shape before they are written into the query.
	const safe = makers.filter((maker) => VALUE_SLUG.test(maker.slug));
	const query = `query BrandCounts($channel: String!) {\n${safe
		.map(
			(maker, index) =>
				`\tb${index}: products(channel: $channel, first: 1, filter: { attributes: [{ slug: "manufacturer", values: ["${maker.slug}"] }] }) { totalCount }`,
		)
		.join("\n")}\n}`;
	const counts = await executeRawGraphQL<Record<string, { totalCount: number | null } | null>>({
		query,
		variables: { channel },
	});
	if (!counts.ok) throw new Error(`[Brands] counts unavailable: ${counts.error.message}`);
	const counted = safe.map((maker, index) => ({
		...maker,
		productCount: counts.data[`b${index}`]?.totalCount ?? 0,
	}));
	return counted.filter((maker) => maker.productCount > 0);
}

/**
 * The makers this channel sells, from Saleor alone — for the questions that need no logo or
 * description: is there a brand page worth linking at all, and may a claim name a maker here.
 * Throws on a fault, like `getBrands`; the caller decides what an unknown answer means.
 */
export async function stockedBrandSlugs(channel: string): Promise<ReadonlySet<string>> {
	return new Set((await saleorBrands(channel)).map((maker) => maker.slug));
}

/** Pure half of `getBrands`, exported for its test. */
export function mergeBrands(
	makers: readonly { slug: string; name: string; productCount: number }[],
	entries: readonly CmsBrand[],
): Brand[] {
	const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
	return makers
		.map((maker) => {
			const entry = bySlug.get(maker.slug);
			return {
				slug: maker.slug,
				// Saleor's spelling: it is what the product cards print.
				name: maker.name,
				productCount: maker.productCount,
				approved: HOMEPAGE_BRAND_SLUGS.includes(maker.slug),
				logo: entry?.logo ?? null,
				heroImage: entry?.heroImage ?? null,
				shortDescription: entry?.shortDescription ?? null,
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name, "sk", { sensitivity: "base" }));
}

/**
 * This market's brands, alphabetically. Saleor's fault throws (the page shows its error state);
 * Payload's is survived — the brands appear as wordmarks until the CMS answers again.
 */
export async function getBrands(channel: string): Promise<Brand[]> {
	const [makers, entries] = await Promise.all([
		saleorBrands(channel),
		getCmsBrands(channel).catch((error: unknown) => {
			console.warn("[Brands] CMS entries left out:", error instanceof Error ? error.message : error);
			return [] as CmsBrand[];
		}),
	]);
	return mergeBrands(makers, entries);
}

/** One brand of this market, or `null` when the channel sells nothing of it. */
export async function getBrand(channel: string, slug: string): Promise<Brand | null> {
	return (await getBrands(channel)).find((brand) => brand.slug === slug) ?? null;
}
