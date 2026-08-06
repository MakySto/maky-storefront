"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, Home } from "lucide-react";
import { marketHref } from "@/lib/channel-map";

/**
 * The 404 body for every route under a market.
 *
 * Without this file, every `notFound()` outside the `[productSlug]` segment —
 * categories, collections, Saleor pages, search, the seven Slovak legal pages and
 * the CMS routes — fell through to `src/app/not-found.tsx`, which is hardcoded
 * English and was being rendered inside Slovak chrome.
 *
 * Both links are market-aware. The old ones were not: `/products` is not a route
 * at all (the proxy 404s it, since `products` is not a market) and `/` bounces
 * through the root geo redirect. A 404 page whose own links 404 is a poor apology.
 */
export default function MarketNotFound() {
	const params = useParams<{ channel: string }>();
	const channel = params?.channel ?? "";
	const t = useTranslations("pages");
	const tProduct = useTranslations("product");

	const buttonBase =
		"inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16">
			<div className="mx-auto max-w-md text-center">
				<span className="bg-surface-muted text-text-secondary mb-4 inline-block rounded-full px-3 py-1 text-sm font-medium">
					404
				</span>

				<h1 className="text-text-primary mb-2 text-2xl font-bold tracking-tight">{t("notFound")}</h1>

				<p className="text-text-secondary mb-8">{t("notFoundDescription")}</p>

				<div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Link
						href={marketHref(channel, "/products")}
						className={`${buttonBase} bg-action-primary text-action-primary-text hover:bg-action-primary-hover`}
					>
						<Search className="h-4 w-4" />
						{tProduct("browseProducts")}
					</Link>

					<Link
						href={marketHref(channel)}
						className={`${buttonBase} border-border-default bg-surface-primary text-text-primary hover:bg-surface-muted border`}
					>
						<Home className="h-4 w-4" />
						{t("backToHome")}
					</Link>
				</div>
			</div>
		</div>
	);
}
