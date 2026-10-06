// What `src/config/categories.ts` says, read as text.
//
// The checks are plain node with no build step, so they cannot import the TypeScript. They read the two
// literals they need instead: the catalogue (`STOREFRONT_CATEGORIES`, with where each is surfaced) and
// the slugs of the other categories the build names (`OTHER_CATEGORY_SLUGS`). Together those are the
// FLOOR of the set the proxy tells a category from a product with: the running server adds whatever
// else Saleor holds (`src/lib/live-categories.ts`). `src/lib/category-source-script.test.ts` pins
// this reader against the real module, so a change to either literal's shape fails a test, not a check.
import { readFileSync } from "node:fs";

const CATEGORIES_TS = new URL("../../src/config/categories.ts", import.meta.url);

export function readCategorySource(url = CATEGORIES_TS) {
	const source = readFileSync(url, "utf8");

	const catalogue = [
		...source.matchAll(/\{\s*slug:\s*"([a-z0-9-]+)",\s*key:\s*"(\w+)",\s*surfaces:\s*\[([^\]]*)\]/g),
	].map(([, slug, key, surfaces]) => ({
		slug,
		key,
		surfaces: [...surfaces.matchAll(/"(\w+)"/g)].map(([, surface]) => surface),
	}));

	// `export const OTHER_CATEGORY_SLUGS: readonly string[] = [ "a", "b", ];` — one slug per line.
	const block = source.match(/export const OTHER_CATEGORY_SLUGS[^=]*=\s*\[([^\]]*)\]/);
	const other = block ? [...block[1].matchAll(/"([a-z0-9-]+)"/g)].map(([, slug]) => slug) : [];

	return { catalogue, other };
}

/** The Saleor channel slugs the storefront serves (`CHANNEL_MAP` in `src/lib/channel-map.ts`), in its order. */
export function readChannels(url = new URL("../../src/lib/channel-map.ts", import.meta.url)) {
	return [...readFileSync(url, "utf8").matchAll(/saleorSlug:\s*"([a-z]{2}-[a-z]{3})"/g)].map(
		([, slug]) => slug,
	);
}
