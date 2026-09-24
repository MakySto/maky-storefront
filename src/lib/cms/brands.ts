import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readBlockMarkets, readMedia, type CmsMedia } from "./blocks";
import { cmsCollectionTag } from "./cache-tags";
import { readCmsConnection } from "./env";
import { isVisibleInMarket, marketForChannel, payloadLocaleForMarket } from "./markets";

/**
 * The owner's brand entries from Payload's `brands` collection: a logo, a short description and
 * a banner per maker (owner, 2026-09-24: "vytvoríme zoznam značiek, pridáme im logá a vytvoríme
 * stránky pre značky").
 *
 * Payload already has the collection — `name`, `slug`, `shortDescription`, `content`, `logo`,
 * `heroImage`, `markets` and SEO fields — and it holds nothing yet. The storefront reads what is
 * published for this market's language and matches it to Saleor's maker by `slug`: the Payload
 * slug is the `manufacturer` value's slug in Saleor (`thule`, `pro-user`, `green-valley`). An
 * entry without a Saleor maker of that slug is ignored — it would be a page with no products.
 *
 * Media goes through the same validator as every CMS image (`readMedia`): the approved CDN
 * origin, JPEG/PNG/WebP/AVIF, an alt text. An unusable logo is dropped and the name is set as a
 * wordmark instead; nothing else about the entry is lost.
 */

export interface CmsBrand {
	readonly slug: string;
	readonly name: string;
	readonly shortDescription: string | null;
	readonly logo: CmsMedia | null;
	readonly heroImage: CmsMedia | null;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TIMEOUT_MS = 5_000;

function text(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Pure half of `getCmsBrands`, exported for its test: Payload's docs → this market's entries. */
export function brandsFromDocs(
	docs: readonly unknown[],
	market: ReturnType<typeof marketForChannel>,
): CmsBrand[] {
	const brands: CmsBrand[] = [];
	for (const [index, doc] of docs.entries()) {
		if (typeof doc !== "object" || doc === null) continue;
		const record = doc as Record<string, unknown>;
		const slug = text(record.slug)?.toLowerCase();
		const name = text(record.name);
		if (!slug || !SLUG.test(slug) || !name) continue;
		const markets = readBlockMarkets(record, index);
		if (!markets.ok || !isVisibleInMarket(markets.markets, market)) continue;
		const logo = readMedia(record.logo);
		const hero = readMedia(record.heroImage);
		brands.push({
			slug,
			name,
			shortDescription: text(record.shortDescription),
			logo: logo.kind === "ok" ? logo.media : null,
			heroImage: hero.kind === "ok" ? hero.media : null,
		});
	}
	return brands;
}

/**
 * This market's published brand entries. A fault THROWS, so it is never cached as "no brands";
 * the pages fall back to Saleor's makers alone meanwhile.
 */
export async function getCmsBrands(channel: string): Promise<CmsBrand[]> {
	"use cache";
	cacheLife("hours");
	const tag = cmsCollectionTag("brands");
	if (tag) cacheTag(tag);

	const market = marketForChannel(channel);
	const connection = readCmsConnection();
	if (!market || !connection) return [];

	const url = new URL(`${connection.baseUrl}/api/brands`);
	url.searchParams.set("where[_status][equals]", "published");
	url.searchParams.set("locale", payloadLocaleForMarket(market));
	url.searchParams.set("fallback-locale", "none");
	url.searchParams.set("depth", "1");
	url.searchParams.set("limit", "100");

	const response = await fetch(url, {
		headers: {
			"CF-Access-Client-Id": connection.accessClientId,
			"CF-Access-Client-Secret": connection.accessClientSecret,
			accept: "application/json",
		},
		// Access answers a refused token with a redirect to its login page, never a 401.
		redirect: "manual",
		signal: AbortSignal.timeout(Math.min(connection.timeoutMs, TIMEOUT_MS)),
	});
	if (!response.ok || !(response.headers.get("content-type") ?? "").includes("application/json")) {
		throw new Error(`[Brands] CMS answered HTTP ${response.status}`);
	}
	const body = (await response.json()) as { docs?: unknown };
	return brandsFromDocs(Array.isArray(body.docs) ? body.docs : [], market);
}
