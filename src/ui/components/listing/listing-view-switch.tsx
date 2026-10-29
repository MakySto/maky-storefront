"use client";

import { useTranslations } from "next-intl";

import { ListingViewToggle } from "./listing-view";

/** The toggle with its words from the `listing` messages, for client toolbars that have a translation context. */
export function ListingViewSwitch({ className }: { className?: string }) {
	const t = useTranslations("listing");
	return (
		<ListingViewToggle
			className={className}
			labels={{ group: t("viewLabel"), grid: t("viewGrid"), list: t("viewList") }}
		/>
	);
}
