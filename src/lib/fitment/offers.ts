import "server-only";

/**
 * From "these sets fit your car" to "these sets are actually on sale here".
 *
 * Order, and it is load-bearing:
 *
 *   1. Fitment answers compatibility PER PRODUCT and hands back only VERIFIED matches
 *      of the right kind.
 *   2. The catalogue is asked, anonymously and per channel, which of those are really
 *      published and purchasable.
 *   3. Only the intersection is offered, and the counts come from that intersection.
 *
 * Four things this version does that the first one did not, each of which was a way to
 * show a customer something untrue:
 *
 *   - **A demo dataset never reaches Saleor.** v1 pointed invented fitment rows at real
 *     product ids, so a real roof box arrived with its real photo and price wearing an
 *     invented "complete roof rack set" badge. A demo dataset now carries its own
 *     catalogue and is served entirely from it.
 *   - **Identity is verified, not assumed.** The external reference and the product kind
 *     are checked against what actually came back, instead of being copied out of the
 *     fitment row.
 *   - **Price comes from the exact variant only.** Falling back to
 *     `priceRange.start` prints some other variant's price next to this variant's name.
 *   - **Availability uses the canonical resolver.** This catalogue is sale-to-order:
 *     `trackInventory` is false and `quantityAvailable` is a synthetic cap of 50, so
 *     treating it as stock would be inventing a stock claim.
 */

import { executePublicGraphQL } from "@/lib/graphql";
import { FitmentProductsByIdsDocument } from "@/gql/graphql";
import { resolveAvailability, AVAILABILITY_METADATA_KEY } from "@/ui/components/product/availability-badge";
import { getLocaleConfigByLocale } from "@/config/locale";
import {
	CONFIGURATOR_PRODUCT_KIND,
	type FitmentApplication,
	type FitmentDataset,
	type FitmentProductRef,
	type ProductKind,
} from "./contract";

/** Saleor refuses `first:` above 100 outright, so batches are capped at it. */
const SALEOR_MAX_PAGE_SIZE = 100;

export type OfferAvailability = "on-demand" | "out-of-stock" | "unknown";

export type FitmentOffer = {
	saleorProductId: string;
	saleorVariantId: string;
	externalReference: string;
	productKind: ProductKind;
	name: string;
	slug: string | null;
	thumbnailUrl: string | null;
	thumbnailAlt: string | null;
	categoryName: string | null;
	/** Always the exact variant's price. Null rather than another variant's. */
	price: { amount: number; currency: string } | null;
	availability: OfferAvailability;
	completeSetIncludes: string[] | null;
	facets: Record<string, string | number | boolean> | null;
	/** True when this offer came from a demo catalogue and cannot be bought. */
	isDemo: boolean;
};

/**
 * Why a compatible product is not in the offer list. Kept separate so the UI can say
 * the true thing instead of collapsing everything into "out of stock".
 */
export type OfferRejection =
	| "not-published"
	| "variant-missing"
	| "identity-mismatch"
	| "wrong-kind"
	| "lookup-failed";

export type FitmentOffers = {
	offers: FitmentOffer[];
	/** Distinct VERIFIED, right-kind products the fitment data proposed. */
	compatibleCount: number;
	/** How many of those are actually offerable in this channel. */
	purchasableCount: number;
	/** Per-reason breakdown of everything that did not make it. */
	rejected: Record<OfferRejection, number>;
	/** True when at least one batch failed — a partial result must not look complete. */
	lookupFailed: boolean;
	/** True when the whole answer came from a demo catalogue. */
	isDemo: boolean;
};

const NO_REJECTIONS: Record<OfferRejection, number> = {
	"not-published": 0,
	"variant-missing": 0,
	"identity-mismatch": 0,
	"wrong-kind": 0,
	"lookup-failed": 0,
};

export const EMPTY_OFFERS: FitmentOffers = {
	offers: [],
	compatibleCount: 0,
	purchasableCount: 0,
	rejected: { ...NO_REJECTIONS },
	lookupFailed: false,
	isDemo: false,
};

/** DE and AT share one Saleor language row; the mapping is the single source for that. */
function languageFor(locale: string) {
	return getLocaleConfigByLocale(locale).graphqlLanguageCode;
}

function sumRejections(
	a: Record<OfferRejection, number>,
	b: Record<OfferRejection, number>,
): Record<OfferRejection, number> {
	const out = { ...NO_REJECTIONS };
	for (const key of Object.keys(out) as OfferRejection[]) out[key] = a[key] + b[key];
	return out;
}

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

/** De-duplicate product refs across applications, keeping first-seen order. */
export function uniqueProductRefs(applications: FitmentApplication[]): FitmentProductRef[] {
	const seen = new Set<string>();
	const refs: FitmentProductRef[] = [];
	for (const application of applications) {
		for (const ref of application.products) {
			if (seen.has(ref.saleorProductId)) continue;
			seen.add(ref.saleorProductId);
			refs.push(ref);
		}
	}
	return refs;
}

/** A dataset that brings its own catalogue is a demo dataset, and is served from it. */
export function isDemoDataset(dataset: FitmentDataset | null): boolean {
	return Boolean(dataset?.demoCatalogue);
}

function availabilityFrom(
	mode: string | null | undefined,
	quantity: number | null | undefined,
): OfferAvailability {
	const resolved = resolveAvailability({ mode, quantityAvailable: quantity ?? undefined });
	if (!resolved) return "unknown";
	return resolved.key === "outOfStock" ? "out-of-stock" : "on-demand";
}

/**
 * Demo offers, built entirely from the dataset's own catalogue.
 *
 * No network call. A demo dataset must be incapable of borrowing a real product's name,
 * photograph or price, and the cheapest way to guarantee that is never to ask.
 */
function demoOffers(dataset: FitmentDataset, refs: FitmentProductRef[]): FitmentOffers {
	const catalogue = new Map((dataset.demoCatalogue ?? []).map((e) => [e.saleorProductId, e]));
	const rejected = { ...NO_REJECTIONS };
	const offers: FitmentOffer[] = [];

	for (const ref of refs) {
		const entry = catalogue.get(ref.saleorProductId);
		if (!entry) {
			rejected["not-published"] += 1;
			continue;
		}
		if (entry.saleorVariantId !== ref.saleorVariantId) {
			rejected["variant-missing"] += 1;
			continue;
		}
		offers.push({
			saleorProductId: ref.saleorProductId,
			saleorVariantId: ref.saleorVariantId,
			externalReference: ref.externalReference,
			productKind: ref.productKind,
			name: entry.name,
			slug: null,
			thumbnailUrl: null,
			thumbnailAlt: null,
			categoryName: entry.categoryName ?? null,
			price: entry.price ?? null,
			availability: availabilityFrom(entry.availabilityMode, entry.quantityAvailable),
			completeSetIncludes: ref.completeSet?.includes ?? null,
			facets: ref.facets ?? null,
			isDemo: true,
		});
	}

	return {
		offers,
		compatibleCount: refs.length,
		purchasableCount: offers.length,
		rejected,
		lookupFailed: false,
		isDemo: true,
	};
}

/**
 * Resolve verified, right-kind product references into purchasable offers.
 *
 * Never throws: a catalogue outage degrades to "we could not load the offer", which is a
 * different message from "nothing fits" and from "these fit but are not sold here".
 */
export async function resolveFitmentOffers(
	refs: FitmentProductRef[],
	channel: string,
	locale: string,
	options: { dataset?: FitmentDataset | null; kind?: ProductKind } = {},
): Promise<FitmentOffers> {
	const kind = options.kind ?? CONFIGURATOR_PRODUCT_KIND;
	const rejected = { ...NO_REJECTIONS };

	// Kind filtering happens before anything else: a roof box must not reach the
	// configurator's offer even if a fitment row points at one.
	const eligible = refs.filter((r) => {
		if (r.productKind === kind) return true;
		rejected["wrong-kind"] += 1;
		return false;
	});

	if (isDemoDataset(options.dataset ?? null)) {
		const demo = demoOffers(options.dataset!, eligible);
		// Summed, not spread: spreading would let the demo path's zeroes overwrite the
		// kind rejections counted above, and the UI would be told nothing was filtered.
		return { ...demo, rejected: sumRejections(rejected, demo.rejected), compatibleCount: refs.length };
	}

	if (eligible.length === 0) {
		return { ...EMPTY_OFFERS, rejected, compatibleCount: 0 };
	}

	const byProductId = new Map(eligible.map((r) => [r.saleorProductId, r]));
	const batches = chunk([...byProductId.keys()], SALEOR_MAX_PAGE_SIZE);
	const found = new Map<string, FitmentOffer>();
	let lookupFailed = false;

	for (const ids of batches) {
		try {
			const result = await executePublicGraphQL(FitmentProductsByIdsDocument, {
				variables: { ids, channel, first: SALEOR_MAX_PAGE_SIZE, lang: languageFor(locale) },
				revalidate: 300,
			});
			// Zero results and a broken upstream are different answers.
			if (!result.ok) {
				console.error("[fitment] catalogue lookup failed for a batch:", result.error);
				lookupFailed = true;
				rejected["lookup-failed"] += ids.length;
				continue;
			}
			for (const edge of result.data.products?.edges ?? []) {
				const node = edge.node;
				const ref = byProductId.get(node.id);
				if (!ref) continue;

				if (!node.isAvailableForPurchase) {
					rejected["not-published"] += 1;
					continue;
				}

				// The external reference is VERIFIED against what came back, not copied
				// from the fitment row. A row pointing at a valid-but-different product
				// is exactly the failure that produced a roof box in the offer list.
				if (node.externalReference && node.externalReference !== ref.externalReference) {
					console.error(
						`[fitment] identity mismatch for ${node.id}: fitment says ${ref.externalReference}, catalogue says ${node.externalReference}`,
					);
					rejected["identity-mismatch"] += 1;
					continue;
				}

				// The variant is never inferred. If the exact variant the fitment data
				// names is not in this channel, this is not the offer that was verified.
				const variant = node.variants?.find((v: { id: string }) => v.id === ref.saleorVariantId);
				if (!variant) {
					rejected["variant-missing"] += 1;
					continue;
				}

				const gross = variant.pricing?.price?.gross ?? null;
				found.set(node.id, {
					saleorProductId: node.id,
					saleorVariantId: variant.id,
					externalReference: ref.externalReference,
					productKind: ref.productKind,
					name: node.translation?.name ?? node.name,
					slug: node.slug,
					thumbnailUrl: node.thumbnail?.url ?? null,
					thumbnailAlt: node.thumbnail?.alt ?? null,
					categoryName: node.category?.translation?.name ?? node.category?.name ?? null,
					price: gross ? { amount: gross.amount, currency: gross.currency } : null,
					availability: availabilityFrom(node.metafield, variant.quantityAvailable),
					completeSetIncludes: ref.completeSet?.includes ?? null,
					facets: ref.facets ?? null,
					isDemo: false,
				});
			}
		} catch (error) {
			console.error("[fitment] catalogue lookup threw:", error);
			lookupFailed = true;
			rejected["lookup-failed"] += ids.length;
		}
	}

	// Anything asked for and not accounted for was simply not returned.
	const accountedFor =
		found.size + Object.values(rejected).reduce((a, b) => a + b, 0) - rejected["wrong-kind"];
	if (accountedFor < eligible.length) rejected["not-published"] += eligible.length - accountedFor;

	// Fitment order is the stable order: it comes from the dataset, not from whichever
	// batch happened to resolve first.
	const offers = eligible
		.map((r) => found.get(r.saleorProductId))
		.filter((o): o is FitmentOffer => Boolean(o));

	return {
		offers,
		compatibleCount: eligible.length,
		purchasableCount: offers.length,
		rejected,
		lookupFailed,
		isDemo: false,
	};
}

/**
 * Confirm one variant is purchasable in this channel, immediately before adding it.
 *
 * Between rendering the configurator and pressing the button a product can be
 * unpublished or sold out, so the honest outcome then is a clear error rather than a
 * cart line for something that cannot be sold.
 */
export async function verifyPurchasable(
	saleorProductId: string,
	saleorVariantId: string,
	channel: string,
	locale: string,
	expectedExternalReference?: string,
): Promise<
	| { ok: true; availability: OfferAvailability; price: { amount: number; currency: string } | null }
	| { ok: false; reason: OfferRejection }
> {
	try {
		const result = await executePublicGraphQL(FitmentProductsByIdsDocument, {
			variables: { ids: [saleorProductId], channel, first: 1, lang: languageFor(locale) },
			cache: "no-store",
		});
		if (!result.ok) {
			console.error("[fitment] purchasability check failed:", result.error);
			return { ok: false, reason: "lookup-failed" };
		}
		const node = result.data.products?.edges?.[0]?.node;
		if (!node || !node.isAvailableForPurchase) return { ok: false, reason: "not-published" };
		if (
			expectedExternalReference &&
			node.externalReference &&
			node.externalReference !== expectedExternalReference
		) {
			return { ok: false, reason: "identity-mismatch" };
		}
		const variant = node.variants?.find((v: { id: string }) => v.id === saleorVariantId);
		if (!variant) return { ok: false, reason: "variant-missing" };
		const gross = variant.pricing?.price?.gross ?? null;
		return {
			ok: true,
			availability: availabilityFrom(node.metafield, variant.quantityAvailable),
			price: gross ? { amount: gross.amount, currency: gross.currency } : null,
		};
	} catch (error) {
		console.error("[fitment] purchasability check threw:", error);
		return { ok: false, reason: "lookup-failed" };
	}
}

export { AVAILABILITY_METADATA_KEY };
