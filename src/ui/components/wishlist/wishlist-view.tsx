"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { HeartIcon, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { ProductCard, type ProductCardData } from "@/ui/components/plp/product-card";
import { loadWishlistProducts } from "@/lib/wishlist/actions";
import { useWishlist } from "@/lib/wishlist/store";

type Loaded = { asked: readonly string[]; products: ProductCardData[] } | { failed: true };

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true afterwards — without a state update. */
function useHydrated() {
	return useSyncExternalStore(
		noopSubscribe,
		() => true,
		() => false,
	);
}

/**
 * The favourites grid: the saved ids from this browser, their products from Saleor in this
 * market. A heart clicked here removes the card at once — the list is the store, not a copy.
 */
export function WishlistView({ channel }: { channel: string }) {
	// Room for the list before it is read: the server and the first client render know nothing
	// of this browser's favourites, and a short placeholder let the footer ride up and be pushed
	// back down when the list or the empty state arrived (CLS 0.22 in the preview).
	return (
		<div className="min-h-[70vh]">
			<WishlistContent channel={channel} />
		</div>
	);
}

function WishlistContent({ channel }: { channel: string }) {
	const t = useTranslations("wishlist");
	const ids = useWishlist();
	const hydrated = useHydrated();
	const [loaded, setLoaded] = useState<Loaded | null>(null);

	// Ask Saleor again only when an id appears that was never asked for (another tab added
	// one); a removal just filters what is already here.
	const asked = loaded && "asked" in loaded ? loaded.asked : [];
	const shouldFetch = hydrated && !(loaded && "failed" in loaded) && ids.some((id) => !asked.includes(id));
	const key = ids.join(",");

	useEffect(() => {
		if (!shouldFetch) return;
		let cancelled = false;
		const request = [...ids];
		loadWishlistProducts(channel, request)
			.then((products) => {
				if (!cancelled) setLoaded({ asked: request, products });
			})
			.catch(() => {
				if (!cancelled) setLoaded({ failed: true });
			});
		return () => {
			cancelled = true;
		};
		// `key` stands for `ids`: the fetch reacts to the saved list changing, nothing else.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shouldFetch, key, channel]);

	if (!hydrated || (ids.length > 0 && !loaded)) {
		return (
			<p className="text-text-tertiary mt-10 flex items-center gap-2 text-sm" role="status">
				<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
				<span className="sr-only">{t("title")}</span>
			</p>
		);
	}

	if (ids.length === 0) {
		return (
			<div className="border-border-subtle bg-surface-card mt-8 flex flex-col items-center rounded-sm border px-6 py-14 text-center shadow-xs">
				<span className="bg-surface-accent text-brand flex h-14 w-14 items-center justify-center rounded-full">
					<HeartIcon className="h-7 w-7" strokeWidth={2.25} aria-hidden />
				</span>
				<h2 className="text-text-primary mt-5 text-xl font-bold">{t("emptyTitle")}</h2>
				<p className="text-text-secondary mt-2 max-w-md text-sm sm:text-base">{t("emptyBody")}</p>
				<LinkWithChannel
					href="/products"
					className="bg-cta text-cta-text hover:bg-cta-hover mt-6 inline-flex h-12 items-center rounded-xs px-6 text-sm font-semibold transition-colors"
				>
					{t("emptyCta")}
				</LinkWithChannel>
			</div>
		);
	}

	if (loaded && "failed" in loaded) {
		return <p className="text-text-secondary mt-8 text-sm">{t("unavailable")}</p>;
	}

	const products = (loaded && "products" in loaded ? loaded.products : []).filter((product) =>
		ids.includes(product.id),
	);
	// Asked for and not returned: this market's channel does not sell it.
	const missing = ids.filter((id) => asked.includes(id) && !products.some((p) => p.id === id)).length;

	return (
		<div className="mt-8">
			<p className="text-text-primary text-sm font-semibold" aria-live="polite">
				{t("count", { count: products.length })}
			</p>
			<div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:gap-5 min-[90rem]:grid-cols-5">
				{products.map((product) => (
					<ProductCard key={product.id} product={product} purchase="button" />
				))}
			</div>
			{missing > 0 && (
				<p className="text-text-tertiary mt-6 text-sm">{t("notInMarket", { count: missing })}</p>
			)}
		</div>
	);
}
