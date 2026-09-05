import "server-only";

/**
 * From "these sets fit your car" to "these sets are actually on sale here".
 *
 * The order is load-bearing and it is the whole reason this module exists:
 *
 *   1. CFM answers compatibility and hands back candidate Saleor ids.
 *   2. Saleor is asked, ANONYMOUSLY and per channel, which of those ids are really
 *      published and purchasable.
 *   3. Only the intersection is offered, and the ordering and counts come from that
 *      intersection — not from the fitment list, and not from one page of it.
 *
 * Two failures this prevents:
 *
 *   - Filtering the current browser page instead of the eligible set. A "12 sets fit
 *     your car" that is really "12 of the 12 rows we happened to have loaded" is a lie
 *     that looks like a feature.
 *   - Leaking hidden products. The query runs through `executePublicGraphQL`, which
 *     sends no staff token, so Saleor's own visibility rules are the gate. There is no
 *     second, storefront-side "should this be visible" check to get wrong.
 *
 * And one truth it preserves: a set that fits but is not purchasable in this channel is
 * NOT "nothing fits your car". Those two counts are returned separately so the UI can
 * say the honest thing — which is today's actual state, since `nordrive-stresne-nosice`
 * has zero public products.
 */

import { executePublicGraphQL } from "@/lib/graphql";
import { FitmentProductsByIdsDocument } from "@/gql/graphql";
import { type FitmentApplication, type FitmentProductRef } from "./contract";

/** Saleor refuses `first:` above 100 outright, so batches are capped below it. */
const SALEOR_MAX_PAGE_SIZE = 100;

export type FitmentOffer = {
	saleorProductId: string;
	saleorVariantId: string;
	externalReference: string;
	name: string;
	slug: string;
	thumbnailUrl: string | null;
	thumbnailAlt: string | null;
	categoryName: string | null;
	price: { amount: number; currency: string } | null;
	quantityAvailable: number | null;
	completeSetIncludes: string[] | null;
	facets: Record<string, string | number | boolean> | null;
};

export type FitmentOffers = {
	offers: FitmentOffer[];
	/** How many distinct compatible products the fitment data proposed. */
	compatibleCount: number;
	/** How many of those are actually purchasable in this channel. */
	purchasableCount: number;
	/** True when the catalogue lookup itself failed, as opposed to returning nothing. */
	lookupFailed: boolean;
};

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

/**
 * Resolve compatible product references into purchasable offers for one channel.
 *
 * Never throws: a catalogue outage degrades the configurator to "we could not load the
 * offer", which is a different message from "nothing fits", and both are different from
 * "these fit but are not on sale here".
 */
export async function resolveFitmentOffers(
	refs: FitmentProductRef[],
	channel: string,
): Promise<FitmentOffers> {
	if (refs.length === 0) {
		return { offers: [], compatibleCount: 0, purchasableCount: 0, lookupFailed: false };
	}

	const byProductId = new Map(refs.map((r) => [r.saleorProductId, r]));
	const batches = chunk([...byProductId.keys()], SALEOR_MAX_PAGE_SIZE);

	const found = new Map<string, FitmentOffer>();
	let lookupFailed = false;

	for (const ids of batches) {
		try {
			const result = await executePublicGraphQL(FitmentProductsByIdsDocument, {
				variables: { ids, channel, first: SALEOR_MAX_PAGE_SIZE },
				revalidate: 300,
			});
			// Zero results and a broken upstream are different answers, and the whole
			// point of this module is not to conflate them.
			if (!result.ok) {
				console.error("[fitment] catalogue lookup failed for a batch:", result.error);
				lookupFailed = true;
				continue;
			}
			for (const edge of result.data.products?.edges ?? []) {
				const node = edge.node;
				if (!node.isAvailableForPurchase) continue;
				const ref = byProductId.get(node.id);
				if (!ref) continue;

				// The variant is never inferred. If the exact variant the fitment data
				// names is not in this channel's catalogue, this is not the offer that
				// was verified to fit, and offering a sibling would be a guess.
				const variant = node.variants?.find((v: { id: string }) => v.id === ref.saleorVariantId);
				if (!variant) continue;

				const price = variant.pricing?.price?.gross ?? node.pricing?.priceRange?.start?.gross ?? null;

				found.set(node.id, {
					saleorProductId: node.id,
					saleorVariantId: variant.id,
					externalReference: ref.externalReference,
					name: node.name,
					slug: node.slug,
					thumbnailUrl: node.thumbnail?.url ?? null,
					thumbnailAlt: node.thumbnail?.alt ?? null,
					categoryName: node.category?.name ?? null,
					price: price ? { amount: price.amount, currency: price.currency } : null,
					quantityAvailable: variant.quantityAvailable ?? null,
					completeSetIncludes: ref.completeSet?.includes ?? null,
					facets: ref.facets ?? null,
				});
			}
		} catch (error) {
			console.error("[fitment] catalogue lookup failed for a batch:", error);
			lookupFailed = true;
		}
	}

	// Fitment order is the stable order: it comes from the dataset, not from whichever
	// batch happened to resolve first.
	const offers = refs.map((r) => found.get(r.saleorProductId)).filter((o): o is FitmentOffer => Boolean(o));

	return {
		offers,
		compatibleCount: byProductId.size,
		purchasableCount: offers.length,
		lookupFailed,
	};
}

/**
 * Confirm one variant is purchasable in this channel, immediately before adding it to
 * the cart.
 *
 * The client is not trusted for price, for the variant, or for the claim that anything
 * fits. Between rendering the configurator and pressing the button a product can be
 * unpublished or sold out, and the honest outcome then is a clear error, not a cart line
 * for something that cannot be sold.
 */
export async function verifyPurchasable(
	saleorProductId: string,
	saleorVariantId: string,
	channel: string,
): Promise<{ ok: true; offer: FitmentOffer } | { ok: false; reason: "not-found" | "lookup-failed" }> {
	try {
		const result = await executePublicGraphQL(FitmentProductsByIdsDocument, {
			variables: { ids: [saleorProductId], channel, first: 1 },
			cache: "no-store",
		});
		if (!result.ok) {
			console.error("[fitment] purchasability check failed:", result.error);
			return { ok: false, reason: "lookup-failed" };
		}
		const node = result.data.products?.edges?.[0]?.node;
		if (!node || !node.isAvailableForPurchase) return { ok: false, reason: "not-found" };
		const variant = node.variants?.find((v: { id: string }) => v.id === saleorVariantId);
		if (!variant) return { ok: false, reason: "not-found" };
		const price = variant.pricing?.price?.gross ?? node.pricing?.priceRange?.start?.gross ?? null;
		return {
			ok: true,
			offer: {
				saleorProductId: node.id,
				saleorVariantId: variant.id,
				externalReference: "",
				name: node.name,
				slug: node.slug,
				thumbnailUrl: node.thumbnail?.url ?? null,
				thumbnailAlt: node.thumbnail?.alt ?? null,
				categoryName: node.category?.name ?? null,
				price: price ? { amount: price.amount, currency: price.currency } : null,
				quantityAvailable: variant.quantityAvailable ?? null,
				completeSetIncludes: null,
				facets: null,
			},
		};
	} catch (error) {
		console.error("[fitment] purchasability check failed:", error);
		return { ok: false, reason: "lookup-failed" };
	}
}
