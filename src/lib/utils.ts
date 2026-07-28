import { ProductsPerPage } from "@/app/config";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatPrice, formatDate as formatLocaleDate } from "@/config/locale";
import { productPath } from "@/lib/product-url";

/** Merge class names with clsx and tailwind-merge for proper Tailwind class deduplication */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** @deprecated Use formatDate from @/config/locale instead */
export const formatDate = formatLocaleDate;

/** @deprecated Use formatPrice from @/config/locale instead */
export const formatMoney = formatPrice;

export const formatMoneyRange = (
	range: {
		start?: { amount: number; currency: string } | null;
		stop?: { amount: number; currency: string } | null;
	} | null,
) => {
	const { start, stop } = range || {};
	const startMoney = start && formatMoney(start.amount, start.currency);
	const stopMoney = stop && formatMoney(stop.amount, stop.currency);

	if (startMoney === stopMoney) {
		return startMoney;
	}

	return `${startMoney} - ${stopMoney}`;
};

/**
 * Market-relative product href used by cart lines and order rows.
 * Delegates to the single product URL helper — see `@/lib/product-url`.
 */
export function getHrefForVariant({
	productSlug,
	variantId,
}: {
	productSlug: string;
	variantId?: string;
}): string {
	return productPath(productSlug, variantId);
}

export type PaginatedListVariables = {
	first?: number;
	after?: string | null;
	last?: number;
	before?: string | null;
};

export const getPaginatedListVariables = ({
	params,
}: {
	params: { [key: string]: unknown };
}): PaginatedListVariables => {
	const cursor = typeof params?.cursor === "string" ? params?.cursor : null;
	const direction = params?.direction === "prev" ? "prev" : "next";

	return direction === "prev"
		? { last: ProductsPerPage, before: cursor }
		: { first: ProductsPerPage, after: cursor };
};
