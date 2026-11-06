"use client";

import { useTranslations } from "next-intl";

import {
	TYRE_LIST_SEPARATOR,
	tyreChoiceFromMetadata,
	type MetadataItem,
} from "@/lib/tyre-size/line-metadata";
import { cn } from "@/lib/utils";

/**
 * The tyre size a snow chain or sock was added with, under its name in the cart, the checkout summary and the
 * order: "Rozmer pneumatík: 205/55 R16", the condition on the tyres when the list attached one, or the plain
 * statement that the customer chose the product without a size.
 *
 * Reads the line's public metadata (`lib/tyre-size/line-metadata`), which the add-to-cart action wrote from a choice
 * it had checked. A line without that metadata, which is every other product in the shop, renders nothing.
 *
 * A client component on purpose, though the cart page and the order page that use it are server pages: it takes the
 * market's language from `NextIntlClientProvider`, whose `locale` the market layout and the checkout both set
 * explicitly. As a server component it would read the request's locale instead, and `locale-binding.test.ts`
 * refuses that, since it can come out in Slovak on a foreign market.
 */
export function TyreChoiceLine({
	metadata,
	className,
}: {
	metadata: readonly MetadataItem[] | null | undefined;
	className?: string;
}) {
	const t = useTranslations("tyreSize");
	const choice = tyreChoiceFromMetadata(metadata);
	if (!choice) return null;

	if (choice.mode === "code") {
		return (
			<p className={cn("text-muted-foreground text-xs break-words", className)} data-testid="tyre-choice">
				{t("lineCode")}
			</p>
		);
	}

	return (
		<div className={cn("text-xs break-words", className)} data-testid="tyre-choice">
			<p className="text-text-primary font-medium">{t("lineSize", { size: choice.size })}</p>
			{choice.condition ? (
				<p className="text-muted-foreground mt-0.5">
					{t(choice.condition.mode === "only" ? "lineOnly" : "lineNot", {
						tyres: choice.condition.tyres.join(TYRE_LIST_SEPARATOR),
					})}
				</p>
			) : null}
		</div>
	);
}
