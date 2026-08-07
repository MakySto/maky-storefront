"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, Home } from "lucide-react";
import { marketHref } from "@/lib/channel-map";

/**
 * The 404 body for a market, used from two places.
 *
 * `[channel]/(main)/not-found.tsx` renders it for every `notFound()` inside the
 * market subtree. `[channel]/(main)/404/page.tsx` renders it as an ordinary page,
 * which is what the proxy rewrites to when the existence gate issues a real 404.
 *
 * That second one has to be an ordinary page, and the reason is the whole point
 * of this work: a rewrite target that calls `notFound()` itself goes down the
 * soft-404 path — under cacheComponents it streams its own 200 and the rewrite's
 * `status: 404` is lost. Measured, not assumed: with the target calling
 * notFound() the gate reported `x-maky-gate: product:absent` and still answered
 * HTTP 200.
 *
 * Both links are market-aware. They used to be `/products` and `/`: the first is
 * not a route at all — the proxy 404s it, since `products` is not a market — and
 * the second bounces through the root geo redirect.
 */
export function MarketNotFound() {
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
