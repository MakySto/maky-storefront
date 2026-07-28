"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Cursor pagination.
 *
 * Saleor's `products` is a Relay connection — `first/after/before/last`, with no
 * offset — so there is no honest way to render "page 7": jumping to an arbitrary
 * page would mean either storing every cursor or refetching everything up to it.
 * Numbered pages wait for a backend that supports offsets; until then this is
 * prev/next, done properly rather than left looking like a prototype.
 *
 * Renders nothing at all when the result set fits on one page — which is the
 * case for every category today, and was previously two dead grey buttons.
 */
export function Pagination({
	pageInfo,
}: {
	pageInfo: {
		hasNextPage: boolean;
		hasPreviousPage: boolean;
		endCursor?: string | null;
		startCursor?: string | null;
	};
}) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const t = useTranslations("plp");

	if (!pageInfo.hasNextPage && !pageInfo.hasPreviousPage) return null;

	const buildUrl = (cursor: string | null | undefined, direction: "next" | "prev") => {
		const params = new URLSearchParams(searchParams);
		params.set("cursor", cursor ?? "");
		params.set("direction", direction);
		return `${pathname}?${params.toString()}`;
	};

	const link = (enabled: boolean) =>
		cn(
			"inline-flex h-11 items-center gap-1.5 rounded-md border px-4 text-sm font-medium transition-colors",
			"focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
			enabled
				? "border-border-default text-text-primary hover:bg-surface-secondary"
				: "border-border-subtle text-text-tertiary pointer-events-none",
		);

	return (
		<nav className="flex items-center justify-center gap-3 pt-12" aria-label={t("pagination")}>
			<Link
				href={pageInfo.hasPreviousPage ? buildUrl(pageInfo.startCursor, "prev") : "#"}
				className={link(pageInfo.hasPreviousPage)}
				aria-disabled={!pageInfo.hasPreviousPage}
				tabIndex={pageInfo.hasPreviousPage ? undefined : -1}
			>
				<ChevronLeft className="h-4 w-4" aria-hidden />
				{t("previousPage")}
			</Link>

			<Link
				href={pageInfo.hasNextPage ? buildUrl(pageInfo.endCursor, "next") : "#"}
				className={link(pageInfo.hasNextPage)}
				aria-disabled={!pageInfo.hasNextPage}
				tabIndex={pageInfo.hasNextPage ? undefined : -1}
			>
				{t("nextPage")}
				<ChevronRight className="h-4 w-4" aria-hidden />
			</Link>
		</nav>
	);
}
