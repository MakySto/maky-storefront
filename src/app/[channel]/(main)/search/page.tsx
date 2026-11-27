import { getLocaleFromChannel } from "@/config/locale";
import { type ReactNode, Suspense } from "react";
import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { answerSearch, ROOF_RACK_SHELF } from "@/lib/search/search-answer";
import { categorySynonyms } from "@/lib/search/synonyms";
import { catalogLanguageForChannel } from "@/lib/catalog-content/language";
import { SearchSignpost, VehicleShortcuts } from "@/ui/components/search/search-shortcuts";
import { SearchResults } from "@/ui/components/search-results";
import { Pagination } from "@/ui/components/pagination";
import { SearchSort } from "./search-sort";
import { ListingViewSwitch } from "@/ui/components/listing/listing-view-switch";
import { SearchIcon } from "lucide-react";
import { marketHref } from "@/lib/channel-map";
import { brandConfig, formatPageTitle } from "@/config/brand";
import { routePolicyFor } from "@/lib/route-policy";
import { searchView } from "./search-view";
import { matchCategoryShortcuts } from "@/lib/search/category-shortcuts";
import { CategoryShelfLinks } from "@/ui/components/search/category-shelf-links";
import { categoriesFor } from "@/config/categories";
import { categorySegment, categoryUrlFor } from "@/config/category-routes";
import { getMarketAssortment, offersCategory } from "@/lib/market-assortment";

/**
 * Internal search results are never for the index — `route-policy.ts` says so, and this is
 * the page honouring it. Until now it did not: `/sk/search?query=thule` answered HTTP 200
 * with no robots meta at all, so every query string a crawler found was an indexable page,
 * thin, infinite and titled "Search products" in all twelve markets.
 *
 * `noindex, follow`: the results link to real product pages, and those links are worth
 * following even though the listing itself is not worth keeping. A missing policy entry
 * counts as not indexable — the safe direction for a page that exists in every market.
 *
 * Title and description depend on the market only, never on the query: they are resolved
 * from `params`, like every other page's, so the shell stays prerenderable.
 */
const SEARCH_INDEXABLE = routePolicyFor("search")?.indexable === true;

export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "search" });

	return {
		title: formatPageTitle(t("metaTitle")),
		description: t("metaDescription", { siteName: brandConfig.siteName }),
		...(SEARCH_INDEXABLE ? {} : { robots: { index: false, follow: true } }),
	};
}

type SearchParams = {
	query?: string | string[];
	cursor?: string | string[];
	direction?: string | string[];
	sort?: string | string[];
};

/**
 * Search page with Cache Components.
 * Static shell renders immediately, search results stream in.
 */
export default function Page(props: {
	searchParams: Promise<SearchParams>;
	params: Promise<{ channel: string }>;
}) {
	return (
		<section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<Suspense fallback={<SearchSkeleton />}>
				<SearchContent searchParams={props.searchParams} params={props.params} />
			</Suspense>
		</section>
	);
}

/**
 * Dynamic search content - reads searchParams at request time.
 */
async function SearchContent({
	searchParams: searchParamsPromise,
	params: paramsPromise,
}: {
	searchParams: Promise<SearchParams>;
	params: Promise<{ channel: string }>;
}) {
	const [searchParams, params] = await Promise.all([searchParamsPromise, paramsPromise]);
	const locale = getLocaleFromChannel(params.channel);
	const t = await getTranslations({ locale, namespace: "search" });
	const tPlp = await getTranslations({ locale, namespace: "plp" });
	const tNav = await getTranslations({ locale, namespace: "nav" });

	// Extract and validate query
	const queryParam = searchParams.query;
	if (!queryParam) {
		notFound();
	}

	// Handle array values (redirect to first valid). The header's form is a plain GET, so what the
	// shopper typed arrives as it was typed, a trailing space from a phone keyboard included; the
	// server action that used to carry it trimmed first, and the search is for the words.
	const query = (
		Array.isArray(queryParam) ? queryParam.find((v) => v.trim().length > 0) : queryParam
	)?.trim();

	if (!query) {
		notFound();
	}

	if (Array.isArray(queryParam)) {
		redirect(marketHref(params.channel, `/search?query=${encodeURIComponent(query)}`));
	}

	// Parse pagination
	const cursor = Array.isArray(searchParams.cursor) ? searchParams.cursor[0] : searchParams.cursor;
	// The shared <Pagination> emits "prev"/"next" (pagination.tsx:38-42) and this
	// route only ever recognised "backward". A Previous click therefore fell
	// through to "forward" and was run as `first: N, after: startCursor` — so it
	// answered HTTP 200 with the WRONG products rather than failing. "backward" is
	// still accepted for any link already in the wild.
	const directionParam = Array.isArray(searchParams.direction)
		? searchParams.direction[0]
		: searchParams.direction;
	const direction = directionParam === "backward" || directionParam === "prev" ? "backward" : "forward";

	// Parse sort
	const sortParam = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
	const sortBy = ["relevance", "price-asc", "price-desc", "name", "newest"].includes(sortParam || "")
		? (sortParam as "relevance" | "price-asc" | "price-desc" | "name" | "newest")
		: "relevance";

	// What the words mean before what they find: the shelves they name decide which products come
	// first, and whether a car that is named is wanted for its roof racks (`search-answer.ts`).
	const shelves = await readCategoryShelves(params.channel, locale);
	const named = matchCategoryShortcuts(query, shelves, locale);

	const answer = await answerSearch({
		query,
		channel: params.channel,
		cursor,
		direction,
		sortBy,
		namedShelves: named.map((shelf) => shelf.slug),
	});
	const { result, shownQuery } = answer;
	const { products, pagination } = result;
	const view = searchView(result);

	if (view === "unavailable") {
		return <SearchUnavailable query={query} channel={params.channel} />;
	}

	const vehicleCards = answer.vehicles.map((vehicle) => ({
		id: vehicle.id,
		heading: t("vehicleHeading", { vehicle: vehicle.title }),
		openLabel: t("vehicleOpen", { vehicle: vehicle.title }),
		href: vehicle.href,
		generations: vehicle.generations,
		related: vehicle.related,
	}));
	const roofRacks = shelves.find((shelf) => shelf.slug === ROOF_RACK_SHELF);
	// The answers that are not a list of products: the car's own page, the offer to choose a car,
	// the page of a tyre size. Shown on the first page only, and also where no product was found.
	const signposts = cursor ? null : (
		<>
			<VehicleShortcuts
				cards={vehicleCards}
				help={t("vehicleHelp")}
				generationsLabel={t("vehicleGenerations")}
				relatedLabel={t("vehicleRelated")}
				className="mb-6"
			/>
			{answer.askForVehicle && roofRacks ? (
				<SearchSignpost
					heading={t("vehicleAskHeading")}
					help={t("vehicleAskHelp")}
					cta={t("vehicleAskCta")}
					href={roofRacks.href}
					testId="search-vehicle-ask"
					className="mb-6"
				/>
			) : null}
			{answer.tyre ? (
				<SearchSignpost
					heading={t("tyreHeading", { size: answer.tyre.label })}
					cta={t("tyreCta")}
					href={answer.tyre.href}
					testId="search-tyre-size"
					className="mb-6"
				/>
			) : null}
		</>
	);

	if (view === "empty") {
		// Nothing found: the shelf that was named, or failing that every shelf of this market, so
		// that "browse our categories" in the line above is something the customer can do.
		return (
			<EmptyState
				query={query}
				channel={params.channel}
				shelves={named.length > 0 ? named : shelves}
				signposts={signposts}
			/>
		);
	}

	return (
		<div>
			{/* Header with count and sort */}
			<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold">{t("resultsFor", { query: shownQuery })}</h1>
					{answer.note && (
						<p className="text-muted-foreground mt-1 text-sm">
							{answer.note === "brand" ? t("correctedFrom", { query }) : t("closestNote")}
						</p>
					)}
					<p className="text-muted-foreground mt-1 text-sm">
						{pagination.totalCountIsEstimate ? "≥ " : ""}
						{/* `plp.productCount` already carries each locale's plural rules — Slovak,
						    Czech, Polish and Romanian all need a `few` form that an English
						    `count === 1 ? "product" : "products"` cannot express. */}
						{tPlp("productCount", { count: pagination.totalCount })}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<ListingViewSwitch />
					<SearchSort />
				</div>
			</div>

			{signposts}

			{/* Only on the first page: further pages are reached from it. */}
			{!cursor && <CategoryShelfLinks heading={tNav("categories")} shelves={named} className="mb-8" />}

			{/* Results grid */}
			<SearchResults products={products} channel={params.channel} />

			{/* Pagination */}
			{(pagination.hasNextPage || pagination.hasPreviousPage) && (
				<Pagination
					pageInfo={{
						hasNextPage: pagination.hasNextPage ?? false,
						hasPreviousPage: pagination.hasPreviousPage ?? false,
						startCursor: pagination.prevCursor,
						endCursor: pagination.nextCursor,
					}}
				/>
			)}
		</div>
	);
}

/**
 * Search skeleton with delayed visibility.
 * Matches SearchResults/SearchResultCard dimensions to prevent layout shift.
 */
function SearchSkeleton() {
	return (
		<div className="animate-skeleton-delayed opacity-0">
			<div className="mb-8">
				<div className="bg-muted h-8 w-64 animate-pulse rounded" />
				<div className="bg-muted mt-2 h-4 w-32 animate-pulse rounded" />
			</div>
			{/* Matches SearchResults: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 */}
			<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<div key={i} className="border-border bg-card animate-pulse overflow-hidden rounded-lg border">
						{/* Matches SearchResultCard: aspect-square image + p-4 content */}
						<div className="bg-muted aspect-square" />
						<div className="p-4">
							<div className="bg-muted mb-1 h-3 w-16 rounded" />
							<div className="bg-muted h-4 w-3/4 rounded" />
							<div className="bg-muted mt-2 h-4 w-20 rounded" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

/**
 * Saleor could not be asked. Not "no results": the same query may well find products a moment
 * later, so the first action offered is to ask again.
 */
async function SearchUnavailable({ query, channel }: { query: string; channel: string }) {
	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "search" });
	const tCommon = await getTranslations({ locale, namespace: "common" });
	return (
		<div role="status" className="flex flex-col items-center justify-center py-16 text-center">
			<div className="bg-muted mb-6 flex h-16 w-16 items-center justify-center rounded-full">
				<SearchIcon className="text-muted-foreground h-8 w-8" />
			</div>
			<h1 className="text-2xl font-semibold">{t("unavailableTitle")}</h1>
			<p className="text-muted-foreground mt-2 max-w-md">{t("unavailableHelp", { query })}</p>
			<div className="mt-8 flex flex-col gap-3 sm:flex-row">
				<Link
					href={marketHref(channel, `/search?query=${encodeURIComponent(query)}`)}
					prefetch={false}
					className="hover:bg-primary/90 bg-primary text-primary-foreground inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium transition-colors"
				>
					{tCommon("retry")}
				</Link>
				<Link
					href={marketHref(channel, "/products")}
					className="border-border bg-background text-foreground hover:bg-muted inline-flex items-center justify-center rounded-lg border px-6 py-3 text-sm font-medium transition-colors"
				>
					{t("browseAll")}
				</Link>
			</div>
		</div>
	);
}

interface CategoryShelf {
	readonly slug: string;
	readonly label: string;
	readonly aliases: readonly string[];
	readonly href: string;
}

/**
 * The shelves this market links from its menu, with the names a search is compared with
 * (`lib/search/category-shortcuts.ts`). A shelf the market does not stock is left out, as it is
 * in the menu, so nothing offered here leads to an empty page.
 */
async function readCategoryShelves(channel: string, locale: string): Promise<CategoryShelf[]> {
	const [tNav, assortment] = await Promise.all([
		getTranslations({ locale, namespace: "nav" }),
		getMarketAssortment(channel),
	]);
	const language = catalogLanguageForChannel(channel);
	return categoriesFor("home")
		.filter((category) => offersCategory(assortment, category.slug))
		.map((category) => ({
			slug: category.slug,
			label: tNav(category.key),
			// The address of the shelf and the other words the trade uses for it ("Grundträger",
			// "autobox"): the same list the search index reads, so both know a shelf by the same names.
			aliases: [categorySegment(channel, category.slug), ...categorySynonyms(language, category.slug)],
			href: marketHref(channel, categoryUrlFor(channel, category.slug)),
		}));
}

async function EmptyState({
	query,
	channel,
	shelves,
	signposts,
}: {
	query: string;
	channel: string;
	shelves: readonly CategoryShelf[];
	/** The car's page, the offer to choose a car, a tyre size's page: an answer even with no product listed. */
	signposts: ReactNode;
}) {
	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "search" });
	const tPages = await getTranslations({ locale, namespace: "pages" });
	const tNav = await getTranslations({ locale, namespace: "nav" });
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<div className="bg-muted mb-6 flex h-16 w-16 items-center justify-center rounded-full">
				<SearchIcon className="text-muted-foreground h-8 w-8" />
			</div>
			<h1 className="text-2xl font-semibold">{t("noResultsFor", { query })}</h1>
			<p className="text-muted-foreground mt-2 max-w-md">{t("noResultsHelp")}</p>
			{signposts ? <div className="mt-8 w-full max-w-2xl text-left">{signposts}</div> : null}
			<CategoryShelfLinks
				heading={tNav("categories")}
				shelves={shelves}
				className="mt-6 max-w-2xl justify-center"
			/>
			<div className="mt-8 flex flex-col gap-3 sm:flex-row">
				<Link
					href={marketHref(channel, "/products")}
					className="hover:bg-primary/90 bg-primary text-primary-foreground inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium transition-colors"
				>
					{t("browseAll")}
				</Link>
				<Link
					href={marketHref(channel)}
					className="border-border bg-background text-foreground hover:bg-muted inline-flex items-center justify-center rounded-lg border px-6 py-3 text-sm font-medium transition-colors"
				>
					{tPages("backToHome")}
				</Link>
			</div>
		</div>
	);
}
