import "server-only";

import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { SearchProductsByIdsDocument } from "@/gql/graphql";
import { catalogLanguageForChannel } from "@/lib/catalog-content/language";
import { marketHref } from "@/lib/channel-map";
import { executePublicGraphQL } from "@/lib/graphql";
import { logUpstreamError, upstreamError } from "@/lib/saleor/resource-outcome";
import { resolveTyreText } from "@/lib/tyre-size/size-lookup";
import { tyreSizePagePath } from "@/lib/tyre-size/size-page-route";
import { correctBrandTypos } from "./brand-typos";
import { searchProducts, toSearchProducts } from "./saleor-provider";
import {
	SEARCH_PAGE_SIZE,
	type SaleorVariant,
	findTyreText,
	onlyWords,
	parseSearchCursor,
	saleorCursor,
	shelfCursor,
	withoutWords,
} from "./search-plan";
import { type ShelfHit, type ShelfIndex, type ShelfSort, searchShelf, sortShelfHits } from "./shelf-index";
import { readShelfIndex } from "./shelf-source";
import type { SearchResult } from "./types";
import {
	NO_VEHICLE,
	type VehicleIntent,
	type VehicleNames,
	productWordsOf,
	readVehicleIntent,
} from "./vehicle-intent";
import { type VehicleShortcut, readVehicleCatalog, vehicleShortcuts } from "./vehicle-names";

/**
 * One search, answered: what the words mean first, then where the products come from.
 *
 * ## What the words mean
 *
 *   - a tyre size ("reťaze 205/55 R16") is answered with that size's page, where the chains that
 *     fit it are listed; the size is then left out of the product search, since no chain carries
 *     tyre sizes in its name;
 *   - a car ("nosič Kuga", "Dachträger VW Golf 7") is answered with the car's own page, where its
 *     roof-rack sets are chosen by roof and bar. Unless the words name another shelf: "nosič
 *     bicyklov octavia" is a bike carrier, and the car is left out of that search;
 *   - a shelf ("strešný box", "Fahrradträger") puts that shelf's products first.
 *
 * ## Where the products come from, in this order
 *
 *   1. the shop's own index of the shelf, every word as typed (`shelf-index.ts`): the market's own
 *      language, ranked;
 *   2. Saleor's search with the same words: the roof-rack sets, which the index does not hold and
 *      which are found by a car, a maker or a code, the same in every language;
 *   3. Saleor again with only the car's words, when a car was named ("Montagekit Golf" finds
 *      nothing in Slovak text, "Golf" does);
 *   4. a misspelt maker corrected (`brand-typos.ts`): the index, then Saleor, and the page says so;
 *   5. the index once more, forgiving a spelling mistake and then a missing word, and the page says
 *      that these are the closest products and not the answer.
 *
 * A later page continues the answer the first page gave: the `cursor` names it (`search-plan.ts`).
 */

/** The base slug of the shelf whose products are chosen by car. */
export const ROOF_RACK_SHELF = "stresne-nosice";

export interface SearchAnswer {
	readonly result: SearchResult;
	/** The words the listed products answer; differs from what was typed when a note says why. */
	readonly shownQuery: string;
	/**
	 * `brand`: a misspelt maker was corrected. `closest`: nothing carries every word as typed, and
	 * the products shown are the nearest. `null`: the products answer the words.
	 */
	readonly note: "brand" | "closest" | null;
	/** The pages of the car the words name, when the search is for something chosen by car. */
	readonly vehicles: readonly VehicleShortcut[];
	/** The words name the roof racks and no car: the page offers to choose one. */
	readonly askForVehicle: boolean;
	/** The page of the tyre size the words hold. */
	readonly tyre: { readonly label: string; readonly href: string } | null;
}

export interface SearchRequest {
	readonly query: string;
	readonly channel: string;
	readonly cursor?: string;
	readonly direction?: "forward" | "backward";
	readonly sortBy?: ShelfSort;
	/** Base slugs of the shelves the words name (`category-shortcuts.ts`), read by the page. */
	readonly namedShelves?: readonly string[];
}

/** The shop's product words per index and set of car names: computed once, on the first search. */
const PRODUCT_WORDS = new WeakMap<ShelfIndex, WeakMap<VehicleNames, Set<string>>>();

function productWordsFor(index: ShelfIndex, names: VehicleNames): Set<string> {
	let byNames = PRODUCT_WORDS.get(index);
	if (!byNames) {
		byNames = new WeakMap();
		PRODUCT_WORDS.set(index, byNames);
	}
	let words = byNames.get(names);
	if (!words) {
		words = productWordsOf(index.docs, names, index.language);
		byNames.set(names, words);
	}
	return words;
}

export async function answerSearch(request: SearchRequest): Promise<SearchAnswer> {
	const { query, channel, direction = "forward", sortBy = "relevance" } = request;
	const locale = getLocaleFromChannel(channel);
	const language = catalogLanguageForChannel(channel) ?? locale.split("-")[0]!.toLowerCase();
	const named = new Set(request.namedShelves ?? []);
	let cursor = parseSearchCursor(request.cursor);

	// A tyre size, and the search without it.
	const sized = findTyreText(query);
	const sizeLabel = sized ? resolveTyreText(sized.text) : null;
	const sizePath = sizeLabel ? tyreSizePagePath(channel, sizeLabel) : null;
	const tyre = sizeLabel && sizePath ? { label: sizeLabel, href: marketHref(channel, sizePath) } : null;
	let productQuery = tyre && sized && sized.rest ? sized.rest : query;

	const [index, catalog] = await Promise.all([
		readShelfIndex(channel),
		// A car is a help beside the answer, never a reason to have none.
		readVehicleCatalog(channel).catch((error: unknown) => {
			console.warn("[search] vehicle names left out:", error instanceof Error ? error.message : error);
			return null;
		}),
	]);

	// A car, and whether it is the roof racks that are wanted for it.
	const intent: VehicleIntent = catalog
		? readVehicleIntent(productQuery, catalog.names, language, {
				productWords: index ? productWordsFor(index, catalog.names) : undefined,
				// Request time: this page is rendered per search and reads its parameters first.
				currentYear: new Date().getFullYear(),
			})
		: NO_VEHICLE;
	const carNamed = intent.models.length > 0 || intent.makeIds.length > 0;
	const forRoofRacks = carNamed && (named.size === 0 || named.has(ROOF_RACK_SHELF));
	if (carNamed && !forRoofRacks)
		productQuery = withoutWords(productQuery, intent.words, language) || productQuery;
	const carWords = forRoofRacks ? onlyWords(productQuery, intent.words, language) : "";

	const vehicles = forRoofRacks && catalog ? await vehicleShortcuts(channel, intent, catalog.tree) : [];
	const frame = {
		vehicles,
		askForVehicle: !carNamed && named.has(ROOF_RACK_SHELF),
		tyre,
	};

	const fromSaleor = async (variant: SaleorVariant, text: string, after?: string): Promise<SearchResult> => {
		const result = await searchProducts({
			query: text,
			channel,
			limit: SEARCH_PAGE_SIZE,
			cursor: after,
			direction: after ? direction : "forward",
			sortBy,
		});
		const { nextCursor, prevCursor } = result.pagination;
		return {
			...result,
			pagination: {
				...result.pagination,
				nextCursor: nextCursor ? saleorCursor(variant, nextCursor) : undefined,
				prevCursor: prevCursor ? saleorCursor(variant, prevCursor) : undefined,
			},
		};
	};
	const textOf = (variant: SaleorVariant): string =>
		variant === "vehicle"
			? carWords || productQuery
			: variant === "brand"
				? correctBrandTypos(productQuery) ?? productQuery
				: productQuery;
	const saleorAnswer = (variant: SaleorVariant, result: SearchResult): SearchAnswer => ({
		...frame,
		result,
		shownQuery: variant === "full" ? query : textOf(variant),
		note: variant === "brand" ? "brand" : variant === "vehicle" ? "closest" : null,
	});
	const shelfAnswer = async (
		hits: readonly ShelfHit[],
		closest: boolean,
		offset: number,
	): Promise<SearchAnswer> => ({
		...frame,
		result: await shelfPage(channel, sortShelfHits(hits, sortBy, language), offset),
		shownQuery: query,
		note: closest ? "closest" : null,
	});
	const found = (result: SearchResult): boolean => !result.unavailable && result.products.length > 0;

	// A later page of Saleor's answer continues the search the first page chose.
	if (cursor.kind === "saleor") {
		return saleorAnswer(
			cursor.variant,
			await fromSaleor(cursor.variant, textOf(cursor.variant), cursor.cursor),
		);
	}
	// A later page of the index's answer, unless the index is gone (the process restarted): then
	// the search starts again from its first page.
	if (cursor.kind === "shelf" && !index) cursor = { kind: "start" };
	const offset = cursor.kind === "shelf" ? cursor.offset : 0;

	const exact = index ? searchShelf(index, productQuery, { preferRoots: named }).hits : [];
	if (exact.length > 0) return shelfAnswer(exact, false, offset);

	if (cursor.kind === "start") {
		const full = await fromSaleor("full", productQuery);
		if (full.unavailable || found(full)) return saleorAnswer("full", full);

		if (carWords && carWords !== productQuery) {
			const byCar = await fromSaleor("vehicle", carWords);
			if (found(byCar)) return saleorAnswer("vehicle", byCar);
		}
	}

	// A misspelt maker: the index first, as for the maker spelt right, then Saleor. Outside the
	// block above, so that a later page of the index's answer finds the same products again.
	const corrected = correctBrandTypos(productQuery);
	if (corrected) {
		const spelt = index ? searchShelf(index, corrected, { preferRoots: named }).hits : [];
		if (spelt.length > 0) {
			return { ...(await shelfAnswer(spelt, false, offset)), shownQuery: corrected, note: "brand" };
		}
		if (cursor.kind === "start") {
			const byBrand = await fromSaleor("brand", corrected);
			if (found(byBrand)) return saleorAnswer("brand", byBrand);
		}
	}

	const closest = index
		? searchShelf(index, productQuery, { match: "closest", preferRoots: named }).hits
		: [];
	if (closest.length > 0) return shelfAnswer(closest, true, offset);

	return { ...frame, result: { products: [], pagination: { totalCount: 0 } }, shownQuery: query, note: null };
}

/** One page of the index's answer, as cards read fresh from Saleor in the index's order. */
async function shelfPage(channel: string, hits: readonly ShelfHit[], from: number): Promise<SearchResult> {
	// Past the end (an old link, a shorter answer since): the last page there is.
	const lastStart = Math.max(0, Math.floor((hits.length - 1) / SEARCH_PAGE_SIZE) * SEARCH_PAGE_SIZE);
	const offset = Math.min(Math.max(0, from), lastStart);
	const ids = hits.slice(offset, offset + SEARCH_PAGE_SIZE).map((hit) => hit.doc.id);

	const result = await executePublicGraphQL(SearchProductsByIdsDocument, {
		variables: {
			ids,
			channel,
			first: ids.length,
			lang: getLocaleConfigByLocale(getLocaleFromChannel(channel)).graphqlLanguageCode,
		},
		revalidate: 60,
	});
	if (!result.ok) {
		logUpstreamError("search-cards", upstreamError(result), { channel });
		return { products: [], pagination: { totalCount: 0 }, unavailable: true };
	}

	const { products } = toSearchProducts(
		(result.data.products?.edges ?? []).map(({ node }) => node),
		channel,
	);
	const place = new Map(ids.map((id, position) => [id, position]));
	products.sort((a, b) => (place.get(a.id) ?? 0) - (place.get(b.id) ?? 0));

	return {
		products,
		pagination: {
			totalCount: hits.length,
			hasNextPage: offset + SEARCH_PAGE_SIZE < hits.length,
			hasPreviousPage: offset > 0,
			nextCursor: shelfCursor(offset + SEARCH_PAGE_SIZE),
			prevCursor: shelfCursor(offset - SEARCH_PAGE_SIZE),
		},
	};
}
