"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, Home, ArrowLeft } from "lucide-react";
import { marketHref } from "@/lib/channel-map";

export default function ProductNotFound() {
	// Market-aware links. They used to be `/products` and `/`: the first is not a
	// route at all — the proxy 404s it, because `products` is not a market — and
	// the second bounces through the root geo redirect. A 404 page whose own links
	// 404 is a poor apology.
	const params = useParams<{ channel: string }>();
	const channel = params?.channel ?? "";
	const t = useTranslations("product");
	const tCommon = useTranslations("common");

	const buttonBase =
		"inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16">
			<div className="mx-auto max-w-md text-center">
				<span className="bg-surface-muted text-text-secondary mb-4 inline-block rounded-full px-3 py-1 text-sm font-medium">
					404
				</span>

				<h1 className="text-text-primary mb-2 text-2xl font-bold tracking-tight">{t("notFoundTitle")}</h1>

				<p className="text-text-secondary mb-8">{t("notFoundMessage")}</p>

				<div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Link
						href={marketHref(channel, "/products")}
						className={`${buttonBase} bg-action-primary text-action-primary-text hover:bg-action-primary-hover`}
					>
						<Search className="h-4 w-4" />
						{t("browseProducts")}
					</Link>

					<Link
						href={marketHref(channel)}
						className={`${buttonBase} border-border-default bg-surface-primary text-text-primary hover:bg-surface-muted border`}
					>
						<Home className="h-4 w-4" />
						{t("goHome")}
					</Link>
				</div>

				<button
					type="button"
					onClick={() => window.history.back()}
					className="text-text-secondary hover:text-text-primary mt-6 inline-flex items-center gap-1 text-sm"
				>
					<ArrowLeft className="h-3 w-3" />
					{tCommon("back")}
				</button>
			</div>
		</div>
	);
}
