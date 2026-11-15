import { Suspense } from "react";
import { type Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { formatPageTitleOnce } from "@/config/brand";
import { categoryUrlFor, saleorSlugFor } from "@/config/category-routes";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { TYRE_SHELF_MARKETS, TYRE_SHELF_SLUG } from "@/config/tyre-shelves";
import { ProductListByCategoryDocument, type ProductListByCategoryQuery } from "@/gql/graphql";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { executePublicGraphQL } from "@/lib/graphql";
import { liveMarkets } from "@/lib/market-state";
import { resolveExactLocaleProducts } from "@/lib/saleor/exact-locale";
import { lookupBySlug } from "@/lib/saleor/slug-lookup";
import { buildCanonicalUrl, counterpartAlternates } from "@/lib/seo/hreflang";
import { buildItemListJsonLd } from "@/lib/seo/item-list";
import { jsonLdScriptProps } from "@/lib/seo";
import { marketOpenGraph } from "@/lib/seo/metadata";
import { attachTyreFit } from "@/lib/tyre-size/card-fit";
import { tyreFamilyOf } from "@/lib/tyre-size/families";
import { readRememberedTyre } from "@/lib/tyre-size/remembered";
import { isKnownTyreSize } from "@/lib/tyre-size/size-lookup";
import {
	isTyrePageIndexable,
	readTyreShelfOffer,
	tyrePageCounterparts,
	tyrePagePath,
	tyreSizePagePath,
	type TyreShelfOffer,
} from "@/lib/tyre-size/size-page-route";
import {
	tyreFamilyOffer,
	tyreSizeOffer,
	tyreSizePagesOfRim,
	type TyreFamilyPage,
	type TyrePage,
	type TyreRimPage,
	type TyreSizePage,
} from "@/lib/tyre-size/size-pages";
import { Breadcrumbs, type BreadcrumbItem } from "@/ui/components/breadcrumbs";
import { TyreListingFilter } from "@/ui/components/fitment/tyre-listing-filter";
import { MarketSwitchTargets } from "@/ui/components/header/market-switch-targets";
import { ProductGrid, transformToProductCard, type ProductCardData } from "@/ui/components/plp";
import { buildFilterVariables } from "@/ui/components/plp/filter-utils";

/**
 * The snow-chain shelf's pages by tyre size (`/sk/snehove-retaze/205-60-r16`), by rim (`/sk/snehove-retaze/r16`) and
 * by model family (`/sk/snehove-retaze/snowdrive-r9`).
 *
 * They live in the catch-all below the category, where the roof-rack shelf keeps its vehicle pages, and follow the
 * same rule: the page is whatever the URL names and says the same to everyone. The size of the address is NOT the
 * size the visitor once gave the shop, and opening the page does not change that remembered size; a card added to the
 * cart from here carries the page's size, exactly as a `?tyreSize=` link does.
 *
 * Which products are listed is decided by the sealed size list (`lib/tyre-size/size-pages`) and by what the channel
 * sells (`size-page-route`); names, prices and availability come from Saleor at request time. Nothing on the page is
 * written by hand for one size: the words are the shop's templates in the market's language.
 */

type Listing = { cards: ProductCardData[]; dropped: number };

/**
 * The offer, or `null` when the shop cannot be asked. A fault is not "nothing on sale": the page then says it could
 * not load, and its metadata keeps it out of the index for as long as the fault lasts.
 */
async function offerOrNull(channel: string): Promise<TyreShelfOffer | null> {
	try {
		return await readTyreShelfOffer(channel);
	} catch (error) {
		console.error("[tyre-pages] the shelf's products could not be read:", error);
		return null;
	}
}

const marketOf = (channel: string): string => REVERSE_MAP[channel] ?? channel;

export async function tyrePageMetadata(channel: string, page: TyrePage): Promise<Metadata> {
	const market = marketOf(channel);
	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "tyrePages" });
	const offer = await offerOrNull(channel);

	const title = formatPageTitleOnce(
		page.kind === "size"
			? t("sizeMetaTitle", { size: page.label })
			: page.kind === "rim"
				? t("rimMetaTitle", { rim: page.rim })
				: t(page.product === "sock" ? "familySockMetaTitle" : "familyChainMetaTitle", { name: page.name }),
	);
	const description =
		page.kind === "size"
			? t("sizeMetaDescription", { size: page.label })
			: page.kind === "rim"
				? t("rimMetaDescription", { rim: page.rim })
				: t("familyMetaDescription", { name: page.name });

	// Could not verify what the shop sells: no canonical and no index, as the category page answers a fault.
	if (!offer) return { title, description, robots: { index: false, follow: false } };

	const canonical = buildCanonicalUrl(market, tyrePagePath(channel, page.slug));
	if (!isTyrePageIndexable(page, offer.onSale)) {
		// A page with one product or none is still a page a shopper may open; it is not one to send a search to.
		// No canonical: a self-canonical nominates the URL, which is the opposite of what `noindex` says.
		return { title, description, robots: { index: false, follow: true } };
	}

	return {
		title,
		description,
		alternates: {
			canonical,
			languages: counterpartAlternates(market, await tyrePageCounterparts(page)),
		},
		openGraph: marketOpenGraph(channel, canonical),
	};
}

/** The same page in every live market that sells the shelf, for the header's market switcher. No I/O. */
function TyreSwitchTargets({ page }: { page: TyrePage }) {
	const paths = Object.fromEntries(
		liveMarkets()
			.filter((market) => TYRE_SHELF_MARKETS.has(market))
			.map((market) => [market, tyrePagePath(market, page.slug)]),
	);
	return <MarketSwitchTargets paths={paths} />;
}

async function loadCards(channel: string, locale: string, productIds: readonly string[]): Promise<Listing> {
	// An empty `ids` filter returns the whole shelf, not nothing (measured live, see the car filter).
	if (productIds.length === 0) return { cards: [], dropped: 0 };
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	const result = await lookupBySlug(
		locale,
		(data: ProductListByCategoryQuery) => data.category,
		(slugLang) =>
			executePublicGraphQL(ProductListByCategoryDocument, {
				variables: {
					slug: saleorSlugFor(TYRE_SHELF_SLUG),
					channel,
					lang,
					slugLang,
					// A size fits at most a few dozen codes; the whole answer is one page.
					first: 100,
					filter: buildFilterVariables({ vehicleProductIds: [...productIds] }),
				},
				revalidate: 300,
			}),
	);
	if (!result.ok) throw new Error(`tyre page products failed: ${result.error.message}`);
	const nodes = result.data.category?.products?.edges.map((edge) => edge.node) ?? [];
	const localized = resolveExactLocaleProducts(nodes, locale);
	return {
		cards: localized.products.map((product) => transformToProductCard(product, channel, locale)),
		dropped: localized.dropped,
	};
}

const isSock = (card: ProductCardData): boolean => tyreFamilyOf(card.productCode)?.kind === "sock";

/** Chains first, then socks; inside each the cheapest first, and the code decides between equal prices. */
function inPageOrder(cards: readonly ProductCardData[]): ProductCardData[] {
	return [...cards].sort(
		(a, b) =>
			Number(isSock(a)) - Number(isSock(b)) ||
			a.price - b.price ||
			(a.productCode ?? "").localeCompare(b.productCode ?? ""),
	);
}

function ProductsSkeleton() {
	return (
		<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
			{Array.from({ length: 4 }).map((_, index) => (
				<div key={index} className="bg-surface-muted h-80 animate-pulse rounded-sm" />
			))}
		</div>
	);
}

/**
 * The products of a size page. Dynamic and in its own boundary: price and availability are the channel's live data.
 */
async function SizeProducts({ channel, page }: { channel: string; page: TyreSizePage }) {
	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "tyrePages" });
	const shelfHref = marketHref(channel, categoryUrlFor(channel, TYRE_SHELF_SLUG));

	const offer = await offerOrNull(channel);
	if (!offer) {
		return (
			<p className="text-text-secondary mt-6 text-sm" role="status" data-testid="tyre-page-unavailable">
				{t("unavailable")}{" "}
				<Link href={shelfHref} className="text-text-link hover:text-text-link-hover underline">
					{t("allChains")}
				</Link>
			</p>
		);
	}

	const fitting = new Set(tyreSizeOffer(page.label, offer.onSale).codes);
	const productIds = [
		...new Set(offer.products.filter(({ code }) => fitting.has(code)).map((p) => p.productId)),
	];
	const listing = await loadCards(channel, locale, productIds);
	// The same verdict the listing and the product page give, for the page's own size and no answers: a card whose
	// fit depends on the tyres says to ask, every other one is green and adds to the cart with this size.
	const cards = inPageOrder(attachTyreFit(listing.cards, page.label, {}));

	if (cards.length === 0) {
		return (
			<div
				className="border-border-subtle bg-surface-card mt-6 rounded-sm border p-5"
				data-testid="tyre-page-empty"
			>
				<p className="text-text-primary text-base font-semibold">{t("emptyTitle", { size: page.label })}</p>
				<p className="text-text-secondary mt-1 text-sm">{t("emptyBody")}</p>
				<Link
					href={shelfHref}
					className="text-text-link hover:text-text-link-hover mt-3 inline-block text-sm font-medium underline"
				>
					{t("allChains")}
				</Link>
			</div>
		);
	}

	const socks = cards.filter(isSock);
	const chains = cards.length - socks.length;
	const cheapest = cards.reduce((low, card) => (card.price < low.price ? card : low), cards[0]!);
	const price = new Intl.NumberFormat(locale, { style: "currency", currency: cheapest.currency }).format(
		cheapest.price,
	);
	const firstSock = chains > 0 ? socks[0] : undefined;
	// `card.href` is already the market's own address of the product (`/sk/<slug>`).
	const itemListProps = jsonLdScriptProps(
		buildItemListJsonLd(cards.map((card) => ({ name: card.name, href: card.href }))),
	);

	return (
		<section className="mt-6" aria-labelledby="tyre-page-products" data-testid="tyre-page-products">
			{itemListProps && <script {...itemListProps} />}
			<h2
				id="tyre-page-products"
				className="text-text-primary text-lg font-bold tracking-[-0.01em] sm:text-xl"
			>
				{chains > 0 ? t("chainsHeading", { size: page.label }) : t("socksHeading", { size: page.label })}
			</h2>
			<p className="text-text-secondary mt-1 text-sm" data-testid="tyre-page-count">
				{t("sizeCount", { size: page.label, chains, socks: socks.length, price })}
			</p>
			{cards.some((card) => card.tyreFit?.kind === "ask") && (
				<p className="text-text-secondary mt-1 text-sm">{t("conditionNote")}</p>
			)}
			<div className="mt-5">
				<ProductGrid
					products={cards}
					columns="full"
					groupHeading={
						firstSock
							? { beforeProductId: firstSock.id, label: t("socksHeading", { size: page.label }) }
							: null
					}
				/>
			</div>
		</section>
	);
}

const CHIP =
	"border-border-default hover:border-action-primary bg-surface-primary text-text-primary inline-flex min-h-11 items-center rounded-sm border px-3 text-sm font-medium tabular-nums transition-colors";

/** Sizes as links, grouped by width. A size the channel offers nothing for is printed and not linked. */
function SizeLinks({
	channel,
	sizes,
	onSale,
	current,
	widthLabel,
}: {
	channel: string;
	sizes: readonly TyreSizePage[];
	/** `null` when the shop could not be asked: every size is then linked, as each has a page. */
	onSale: ReadonlySet<string> | null;
	current?: string;
	widthLabel: (width: number) => string;
}) {
	const byWidth = new Map<number, TyreSizePage[]>();
	for (const size of sizes) byWidth.set(size.width, [...(byWidth.get(size.width) ?? []), size]);
	return (
		<dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
			{[...byWidth].map(([width, group]) => (
				<div key={width}>
					<dt className="text-text-tertiary text-xs font-semibold tracking-[0.06em] uppercase">
						{widthLabel(width)}
					</dt>
					<dd className="mt-1.5 flex flex-wrap gap-2">
						{group.map((size) => {
							const offered = onSale === null || tyreSizeOffer(size.label, onSale).codes.length > 0;
							return size.label === current || !offered ? (
								<span
									key={size.slug}
									aria-current={size.label === current ? "page" : undefined}
									className="border-border-subtle text-text-tertiary inline-flex min-h-11 items-center rounded-sm border px-3 text-sm tabular-nums"
								>
									{size.label}
								</span>
							) : (
								<Link
									key={size.slug}
									href={marketHref(channel, tyrePagePath(channel, size.slug))}
									className={CHIP}
								>
									{size.label}
								</Link>
							);
						})}
					</dd>
				</div>
			))}
		</dl>
	);
}

/** How far a neighbour's width may be from the page's own, in millimetres: one step of the usual 10 mm ladder. */
const NEIGHBOUR_WIDTH_MM = 10;

/**
 * The sizes next to this one: the same rim, the same width and the widths one step either side. A rim holds up to
 * 150 sizes, and all of them under every size page was a wall of links on a phone; the rim page holds the whole list
 * and is linked right below. Its own boundary: it asks what the channel sells.
 */
async function NeighbourSizes({ channel, page }: { channel: string; page: TyreSizePage }) {
	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "tyrePages" });
	const offer = await offerOrNull(channel);
	return (
		<SizeLinks
			channel={channel}
			sizes={tyreSizePagesOfRim(page.rim).filter(
				(size) => Math.abs(size.width - page.width) <= NEIGHBOUR_WIDTH_MM,
			)}
			onSale={offer?.onSale ?? null}
			current={page.label}
			widthLabel={(width) => t("widthGroup", { width })}
		/>
	);
}

async function RimSizes({ channel, page }: { channel: string; page: TyreRimPage }) {
	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "tyrePages" });
	const offer = await offerOrNull(channel);
	return (
		<SizeLinks
			channel={channel}
			sizes={tyreSizePagesOfRim(page.rim)}
			onSale={offer?.onSale ?? null}
			widthLabel={(width) => t("widthGroup", { width })}
		/>
	);
}

/** What a card says about the shopper's own size, as a rank: the sizes that fit come first. */
const fitRank = (card: ProductCardData): number =>
	card.tyreFit?.kind === "fits" ? 0 : card.tyreFit?.kind === "ask" ? 1 : 2;

/**
 * The sizes of one model family, as the shop's own product cards.
 *
 * Unlike a size page, this one has no size of its own, and the question a shopper brings to it is "which of these
 * fourteen is mine?". So it reads the size the shopper once gave the shop: the cards then carry the same verdict as
 * on the listing and the sizes that fit come first. With no size the cards are plain and the page asks for one, with
 * the listing's own panel. A visitor without the cookie, a crawler among them, sees the plain list in the family's
 * order.
 */
async function FamilyProducts({ channel, page }: { channel: string; page: TyreFamilyPage }) {
	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "tyrePages" });
	const shelfPath = categoryUrlFor(channel, TYRE_SHELF_SLUG);
	const shelfHref = marketHref(channel, shelfPath);

	const offer = await offerOrNull(channel);
	if (!offer) {
		return (
			<p className="text-text-secondary mt-6 text-sm" role="status" data-testid="tyre-page-unavailable">
				{t("unavailable")}{" "}
				<Link href={shelfHref} className="text-text-link hover:text-text-link-hover underline">
					{t("allChains")}
				</Link>
			</p>
		);
	}

	const family = tyreFamilyOffer(page.key, offer.onSale);
	const onSale = new Set(family.codes);
	const productIds = [
		...new Set(offer.products.filter(({ code }) => onSale.has(code)).map((p) => p.productId)),
	];
	const [listing, remembered] = await Promise.all([
		loadCards(channel, locale, productIds),
		readRememberedTyre().catch(() => null),
	]);

	if (listing.cards.length === 0) {
		return (
			<div
				className="border-border-subtle bg-surface-card mt-6 rounded-sm border p-5"
				data-testid="tyre-page-empty"
			>
				<p className="text-text-primary text-base font-semibold">
					{t("familyEmptyTitle", { name: page.name })}
				</p>
				<p className="text-text-secondary mt-1 text-sm">{t("emptyBody")}</p>
				<Link
					href={shelfHref}
					className="text-text-link hover:text-text-link-hover mt-3 inline-block text-sm font-medium underline"
				>
					{t("allChains")}
				</Link>
			</div>
		);
	}

	// A size the list does not hold says nothing about any card, so it is treated as no size here.
	const size = remembered && isKnownTyreSize(remembered.size) ? remembered.size : null;
	const byCode = [...listing.cards].sort((a, b) => (a.productCode ?? "").localeCompare(b.productCode ?? ""));
	const cards = attachTyreFit(byCode, size, remembered?.answers ?? {}).sort(
		(a, b) => fitRank(a) - fitRank(b),
	);
	const anyFits = cards.some((card) => fitRank(card) < 2);
	const sizePath = size ? tyreSizePagePath(channel, size) : null;

	const cheapest = cards.reduce((low, card) => (card.price < low.price ? card : low), cards[0]!);
	const price = new Intl.NumberFormat(locale, { style: "currency", currency: cheapest.currency }).format(
		cheapest.price,
	);
	const facts: [string, string][] = [
		[t("familyFactSizes"), String(cards.length)],
		[t("familyFactTyres"), String(family.sizes)],
		...(family.rims.length > 0
			? ([[t("familyFactRims"), `R${family.rims[0]} – R${family.rims.at(-1)}`]] as [string, string][])
			: []),
		[t("familyFactPrice"), price],
	];
	const itemListProps = jsonLdScriptProps(
		buildItemListJsonLd(cards.map((card) => ({ name: card.name, href: card.href }))),
	);

	return (
		<>
			<dl
				className="border-border-subtle bg-surface-card mt-6 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-4 rounded-sm border p-4 sm:grid-cols-4 sm:p-5"
				data-testid="tyre-family-facts"
			>
				{facts.map(([label, value]) => (
					<div key={label}>
						<dt className="text-text-tertiary text-xs font-semibold tracking-[0.06em] uppercase">{label}</dt>
						<dd className="text-text-primary mt-1 text-lg font-bold tabular-nums">{value}</dd>
					</div>
				))}
			</dl>

			<section className="mt-8" aria-labelledby="tyre-page-products" data-testid="tyre-page-products">
				{itemListProps && <script {...itemListProps} />}
				<h2
					id="tyre-page-products"
					className="text-text-primary text-lg font-bold tracking-[-0.01em] sm:text-xl"
				>
					{t("familyProductsHeading", { name: page.name })}
				</h2>
				{size === null ? (
					<TyreListingFilter
						channel={channel}
						filter={{ state: "no-size", requested: false }}
						basePath={shelfPath}
						searchParams={{}}
						className="mt-4"
					/>
				) : (
					<p className="text-text-secondary mt-1 text-sm" data-testid="tyre-family-size">
						{anyFits ? t("familyYourSize", { size }) : t("familyNoneFit", { size })}
						{!anyFits && sizePath && (
							<>
								{" "}
								<Link
									href={marketHref(channel, sizePath)}
									className="text-text-link hover:text-text-link-hover font-medium underline"
								>
									{t("familySizeLink", { size })}
								</Link>
							</>
						)}
					</p>
				)}
				<div className="mt-5">
					<ProductGrid products={cards} columns="full" />
				</div>
			</section>

			{family.rims.length > 0 && (
				<section className="border-border-default mt-12 border-t pt-8" aria-labelledby="tyre-family-rims">
					<h2 id="tyre-family-rims" className="text-text-primary text-lg font-bold tracking-[-0.01em]">
						{t("familyRimsHeading", { name: page.name })}
					</h2>
					<ul className="mt-4 flex flex-wrap gap-2">
						{family.rims.map((rim) => (
							<li key={rim}>
								<Link href={marketHref(channel, tyrePagePath(channel, `r${rim}`))} className={CHIP}>
									{t("rimCrumb", { rim })}
								</Link>
							</li>
						))}
					</ul>
				</section>
			)}
		</>
	);
}

function LinksSkeleton() {
	return <div className="bg-surface-muted mt-4 h-40 animate-pulse rounded-sm" />;
}

export async function TyrePageView({ channel, page }: { channel: string; page: TyrePage }) {
	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale });
	const shelfPath = categoryUrlFor(channel, TYRE_SHELF_SLUG);
	const shelfHref = marketHref(channel, shelfPath);
	const rimHref = page.kind === "family" ? null : marketHref(channel, tyrePagePath(channel, `r${page.rim}`));

	const heading =
		page.kind === "size"
			? t("tyrePages.sizeHeading", { size: page.label })
			: page.kind === "rim"
				? t("tyrePages.rimHeading", { rim: page.rim })
				: t(page.product === "sock" ? "tyrePages.familySockHeading" : "tyrePages.familyChainHeading", {
						name: page.name,
					});
	const lead =
		page.kind === "size"
			? t("tyrePages.sizeLead", { size: page.label })
			: page.kind === "rim"
				? t("tyrePages.rimLead", { rim: page.rim })
				: t("tyrePages.familyLead", { name: page.name });

	const tail: BreadcrumbItem[] =
		page.kind === "family"
			? [{ label: page.name }]
			: page.kind === "rim"
				? [{ label: t("tyrePages.rimCrumb", { rim: page.rim }) }]
				: [
						{ label: t("tyrePages.rimCrumb", { rim: page.rim }), href: rimHref ?? undefined },
						{ label: page.label },
					];
	const crumbs: BreadcrumbItem[] = [
		{ label: t("nav.home"), href: marketHref(channel) },
		{ label: t("nav.snowChains"), href: shelfHref },
		...tail,
	];

	return (
		<div className="max-w-page mx-auto w-full px-4 pt-8 pb-12 sm:px-6 lg:px-8">
			<TyreSwitchTargets page={page} />
			<Breadcrumbs items={crumbs} />

			<h1 className="text-text-primary mt-4 text-2xl font-bold break-words sm:text-3xl">{heading}</h1>
			<p className="text-text-secondary mt-3 max-w-3xl text-base leading-relaxed">{lead}</p>

			{page.kind === "size" && rimHref ? (
				<>
					<Suspense fallback={<ProductsSkeleton />}>
						<SizeProducts channel={channel} page={page} />
					</Suspense>

					<section
						className="border-border-default mt-12 border-t pt-8"
						aria-labelledby="tyre-page-neighbours"
					>
						<h2 id="tyre-page-neighbours" className="text-text-primary text-lg font-bold tracking-[-0.01em]">
							{t("tyrePages.otherSizesHeading", { rim: page.rim })}
						</h2>
						<Suspense fallback={<LinksSkeleton />}>
							<NeighbourSizes channel={channel} page={page} />
						</Suspense>
						<p className="mt-5 text-sm font-medium">
							<Link href={rimHref} className="text-text-link hover:text-text-link-hover underline">
								{t("tyrePages.rimLink", { rim: page.rim })}
							</Link>
						</p>
					</section>
				</>
			) : page.kind === "rim" ? (
				<Suspense fallback={<LinksSkeleton />}>
					<RimSizes channel={channel} page={page} />
				</Suspense>
			) : page.kind === "family" ? (
				<Suspense fallback={<ProductsSkeleton />}>
					<FamilyProducts channel={channel} page={page} />
				</Suspense>
			) : null}

			<section className="border-border-default mt-10 max-w-3xl border-t pt-8">
				<h2 className="text-text-primary text-lg font-bold tracking-[-0.01em]">{t("tyreSize.howTitle")}</h2>
				<p className="text-text-secondary mt-2 text-sm leading-relaxed">{t("tyreSize.howBody")}</p>
				<p className="text-text-secondary mt-2 text-sm leading-relaxed">{t("tyrePages.sourceNote")}</p>
				<p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
					<Link href={shelfHref} className="text-text-link hover:text-text-link-hover underline">
						{t("tyrePages.allChains")}
					</Link>
				</p>
			</section>
		</div>
	);
}
