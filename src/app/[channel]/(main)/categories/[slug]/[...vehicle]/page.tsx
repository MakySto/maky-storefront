import { Suspense } from "react";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { getLocaleFromChannel } from "@/config/locale";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { buildCanonicalUrl } from "@/lib/seo/hreflang";
import { indexabilityOf, isCatalogPreviewEnabled, visibilityOf } from "@/lib/catalog-content/publication";
import { loadCatalogView, resolveVehiclePath } from "@/lib/catalog-content/resolve";
import { splitContent } from "@/lib/catalog-content/text";
import { type CatalogNode, ancestorsOf } from "@/lib/catalog-content/tree";
import { resolveFitmentOffers, uniqueProductRefs } from "@/lib/fitment/offers";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { Breadcrumbs, type BreadcrumbItem } from "@/ui/components/breadcrumbs";
import { ContentBlocks } from "@/ui/components/catalog/content-blocks";
import { CatalogOfferList } from "@/ui/components/catalog/offer-list";

/**
 * The vehicle category pages: `/sk/stresne-nosice/[make]/[model]/[generation]`.
 *
 * Three levels and no more. A year or a roof type refines the choice INSIDE a generation
 * page; neither becomes its own URL, because that would be tens of thousands of pages
 * saying nearly the same thing.
 *
 * The vehicle is whatever the URL names. It is deliberately NOT the car saved in the
 * visitor's Garage: a public category has to say the same thing to everyone, and someone
 * arriving at the T-Roc page from a search result must not be shown an Octavia's offer
 * because they once saved one.
 */

type Params = { params: Promise<{ channel: string; slug: string; vehicle: string[] }> };

async function resolve(channel: string, categorySlug: string, vehicle: string[]) {
	const view = await loadCatalogView();
	if (!view.ready) return null;
	const node = resolveVehiclePath(view.tree, categorySlug, vehicle);
	if (!node?.page) return null;

	const visibility = visibilityOf(node.page);
	// Preview is an explicit server-side mode, never a query parameter: a public
	// parameter that switches off a publication gate is not a gate.
	if (!visibility.visible && !isCatalogPreviewEnabled()) return null;

	return {
		view,
		node,
		page: node.page,
		locale: getLocaleFromChannel(channel),
		// `params.channel` is the SALEOR channel (`sk-eur`). Every public URL uses the
		// market segment (`sk`), so a canonical or a link built from the raw param points
		// at a path that does not exist. Caught by reading the served HTML, not by tsc.
		market: REVERSE_MAP[channel] ?? channel,
		published: visibility.visible,
	};
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
	const { channel, slug, vehicle } = await params;
	const resolved = await resolve(channel, slug, vehicle);
	if (!resolved) return { robots: { index: false, follow: false } };

	const { page, market } = resolved;
	const canonical = buildCanonicalUrl(market, page.urlPath);
	const indexable = indexabilityOf(page).indexable;

	return {
		title: page.metaTitle ?? page.h1,
		description: page.metaDescription,
		alternates: { canonical },
		// hreflang is deliberately absent: only `sk` exists, and an alternate must point
		// at a translation that has actually been published.
		robots: indexable ? undefined : { index: false, follow: true },
	};
}

function tileHref(channel: string, node: CatalogNode): string {
	return marketHref(channel, node.urlPath);
}

function ChildTiles({ channel, nodes }: { channel: string; nodes: readonly CatalogNode[] }) {
	if (nodes.length === 0) return null;
	return (
		<ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{nodes.map((child) => (
				<li key={child.vehicleId}>
					<Link
						href={tileHref(channel, child)}
						className="border-border-default hover:border-action-primary bg-surface-primary flex h-full flex-col rounded-lg border p-4 transition-colors"
					>
						<span className="text-text-primary font-medium break-words">{child.name}</span>
						{child.kind === "generation" && child.productionYearFrom ? (
							<span className="text-text-tertiary mt-1 text-sm">
								{child.productionYearFrom}
								{child.productionYearTo ? `–${child.productionYearTo}` : "+"}
							</span>
						) : null}
					</Link>
				</li>
			))}
		</ul>
	);
}

function OfferSkeleton() {
	return (
		<section className="mt-8">
			<h2 className="text-text-primary text-lg font-semibold">Kompatibilné zostavy</h2>
			<div className="bg-surface-muted mt-4 h-24 animate-pulse rounded-lg" />
		</section>
	);
}

/**
 * The offer, and ONLY the offer, is dynamic.
 *
 * It has to be. Price, availability and publication are per-channel live data, and this
 * route is partially prerendered — so without a Suspense boundary the listing is computed
 * once at build time, on a host that cannot reach Saleor, and that answer is replayed to
 * every visitor. Measured before this boundary existed: a fresh request made no Saleor
 * call at all and served a baked "could not load" state.
 *
 * The editorial text and the tiles stay in the prerendered shell, which is what keeps the
 * article in the HTML without an interaction and the page fast.
 */
async function Offers({
	vehicleId,
	channel,
	locale,
}: {
	vehicleId: string;
	channel: string;
	locale: string;
}) {
	const view = await loadCatalogView();
	if (!view.ready) return null;

	const applications = view.tree.applicationsOf.get(vehicleId) ?? [];
	if (applications.length === 0) return null;

	const fitment = await loadFitmentDataset();
	const offers = await resolveFitmentOffers(uniqueProductRefs([...applications]), channel, locale, {
		dataset: fitment.dataset,
	});
	return <CatalogOfferList offers={offers} channel={channel} />;
}

export default async function Page({ params }: Params) {
	const { channel, slug, vehicle } = await params;
	const resolved = await resolve(channel, slug, vehicle);
	if (!resolved) notFound();

	const { view, node, page, locale, market, published } = resolved;
	const { top, body } = splitContent(page);
	const children = view.tree.childrenOf.get(node.vehicleId) ?? [];

	const crumbs: BreadcrumbItem[] = [
		{ label: "Strešné nosiče", href: marketHref(channel, `/${slug}`) },
		...ancestorsOf(view.tree, node).map((ancestor) => ({
			label: ancestor.name,
			href: tileHref(channel, ancestor),
		})),
		{ label: node.name },
	];

	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
			<Breadcrumbs items={crumbs} />

			{!published ? (
				<p className="bg-status-warning-bg text-status-warning border-status-warning-border mt-4 rounded-md border px-3 py-2 text-sm">
					Náhľad nepublikovanej stránky. Návštevníkom sa nezobrazuje.
				</p>
			) : null}

			<h1 className="text-text-primary mt-4 text-2xl font-bold break-words sm:text-3xl">
				{page.h1 ?? node.name}
			</h1>

			{/* Above the listing: the short lead. */}
			<div className="mt-4">
				<ContentBlocks blocks={top} market={market} id="top" />
			</div>

			<ChildTiles channel={channel} nodes={children} />

			{/* Products only on a generation: the first level at which the fitment data
			    makes a claim about a specific car. A make or model page is still browsing. */}
			{node.kind === "generation" ? (
				<Suspense fallback={<OfferSkeleton />}>
					<Offers vehicleId={node.vehicleId} channel={channel} locale={locale} />
				</Suspense>
			) : null}

			{/* Below the listing: the advice. Server-rendered, no interaction required. */}
			{body.length > 0 ? (
				<section className="border-border-default mt-10 border-t pt-8">
					<ContentBlocks blocks={body} market={market} id="body" />
				</section>
			) : null}
		</div>
	);
}
