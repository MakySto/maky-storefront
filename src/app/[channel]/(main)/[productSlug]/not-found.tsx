"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search, Home, ArrowLeft } from "lucide-react";

export default function ProductNotFound() {
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
						href="/products"
						className={`${buttonBase} bg-action-primary text-action-primary-text hover:bg-action-primary-hover`}
					>
						<Search className="h-4 w-4" />
						{t("browseProducts")}
					</Link>

					<Link
						href="/"
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
