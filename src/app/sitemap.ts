import { type MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo/config";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { executePublicGraphQL } from "@/lib/graphql";
import { SitemapProductsDocument, SitemapCategoriesDocument } from "@/gql/graphql";

/**
 * The sitemap used to advertise 32 URLs: eleven market homepages, their
 * /products, and the Slovak legal pages. Zero of the 453 products and zero
 * categories — and eleven of those markets have an empty catalogue, verified
 * against the API rather than assumed.
 *
 * A sitemap is a list of preferred canonical URLs, and empty storefronts are
 * thin content, so this now lists the one stocked market, its products, and only
 * the categories that actually hold something.
 */

/** The only market with a catalogue. sk-eur has 453 products; every other channel has 0. */
const STOCKED_MARKET = "sk";

/** Saleor's `products` is a cursor connection; 100 is a comfortable page. */
const PAGE_SIZE = 100;

/** Backstop against an unbounded loop if the API ever misreports `hasNextPage`. */
const MAX_PAGES = 20;

const SK_ONLY_PATHS = [
	"/obchodne-podmienky",
	"/reklamacie-a-vratenie",
	"/odstupenie-od-zmluvy",
	"/ochrana-osobnych-udajov",
	"/cookies",
	"/doprava-a-platba",
	"/kontakt",
	"/o-nas",
];

/** Re-read the catalogue at most hourly; a sitemap is not a live view. */
export const revalidate = 3600;

interface ProductEntry {
	slug: string;
	updatedAt: string | null;
}

/**
 * One page of the connection. Split out on purpose: with the cursor as a
 * parameter TypeScript has a declared type for it, whereas reassigning a local
 * cursor from the query result inside the loop makes the result's own inference
 * circular (TS7022).
 */
async function fetchProductPage(channel: string, after: string | null) {
	const result = await executePublicGraphQL(SitemapProductsDocument, {
		variables: { channel, first: PAGE_SIZE, after },
		revalidate,
	});
	return result.ok ? result.data.products ?? null : null;
}

async function fetchProductSlugs(channel: string): Promise<ProductEntry[]> {
	const out: ProductEntry[] = [];
	let after: string | null = null;

	for (let page = 0; page < MAX_PAGES; page++) {
		const connection = await fetchProductPage(channel, after);
		if (!connection) break;

		for (const edge of connection.edges) {
			if (edge.node.slug) {
				out.push({ slug: edge.node.slug, updatedAt: edge.node.updatedAt ?? null });
			}
		}

		if (!connection.pageInfo.hasNextPage) break;
		after = connection.pageInfo.endCursor ?? null;
		if (!after) break;
	}

	return out;
}

async function fetchStockedCategorySlugs(channel: string): Promise<string[]> {
	const result = await executePublicGraphQL(SitemapCategoriesDocument, {
		variables: { channel, first: 100 },
		revalidate,
	});
	if (!result.ok || !result.data.categories) return [];

	return result.data.categories.edges
		.filter((edge) => (edge.node.products?.totalCount ?? 0) > 0)
		.map((edge) => edge.node.slug);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const base = getBaseUrl();
	const now = new Date();
	const channel = CHANNEL_MAP[STOCKED_MARKET].saleorSlug;

	const entries: MetadataRoute.Sitemap = [
		{ url: `${base}/${STOCKED_MARKET}`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
		{
			url: `${base}/${STOCKED_MARKET}/products`,
			lastModified: now,
			changeFrequency: "daily",
			priority: 0.8,
		},
	];

	// A dead Saleor must not take the sitemap down with it: the static entries are
	// still worth serving, and an empty <urlset> would tell Google the site has no
	// pages at all.
	let products: Awaited<ReturnType<typeof fetchProductSlugs>> = [];
	let categories: string[] = [];
	try {
		[products, categories] = await Promise.all([
			fetchProductSlugs(channel),
			fetchStockedCategorySlugs(channel),
		]);
	} catch {
		// keep the static entries
	}

	for (const slug of categories) {
		entries.push({
			url: `${base}/${STOCKED_MARKET}/categories/${slug}`,
			lastModified: now,
			changeFrequency: "weekly",
			priority: 0.7,
		});
	}

	for (const product of products) {
		entries.push({
			// Root-level product URL. /{market}/products/{slug} has 308'd here since
			// 62657e7 and the canonical points at this form.
			url: `${base}/${STOCKED_MARKET}/${product.slug}`,
			lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
			changeFrequency: "weekly",
			priority: 0.6,
		});
	}

	for (const path of SK_ONLY_PATHS) {
		entries.push({
			url: `${base}/${STOCKED_MARKET}${path}`,
			lastModified: now,
			changeFrequency: "monthly",
			priority: 0.3,
		});
	}

	return entries;
}
