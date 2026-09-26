import { getLocaleFromChannel } from "@/config/locale";
import { redirect } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { marketHref } from "@/lib/channel-map";
import { getMarketAssortment, offersFullRange } from "@/lib/market-assortment";

/**
 * The header search: one wide field with its button inside the right edge.
 *
 * A server action, so it searches without JavaScript. The button is a real submit button —
 * Enter was the only way to search before, which a pointer user had to know.
 */
export async function HeaderSearch({ channel }: { channel: string }) {
	const locale = getLocaleFromChannel(channel);
	const [t, tCommon, assortment] = await Promise.all([
		getTranslations({ locale, namespace: "nav" }),
		getTranslations({ locale, namespace: "common" }),
		getMarketAssortment(channel),
	]);

	async function onSubmit(formData: FormData) {
		"use server";
		const search = formData.get("search") as string;
		if (search && search.trim().length > 0) {
			redirect(marketHref(channel, `/search?query=${encodeURIComponent(search.trim())}`));
		}
	}

	return (
		<form action={onSubmit} role="search" className="group relative w-full max-w-3xl">
			<label className="block">
				<span className="sr-only">{t("searchAriaLabel")}</span>
				<input
					type="text"
					name="search"
					// The example names shelves, so it names only what this market sells.
					placeholder={offersFullRange(assortment) ? t("searchPlaceholder") : t("searchPlaceholderRoofRacks")}
					autoComplete="off"
					required
					className="border-border-default bg-surface-card text-text-primary placeholder:text-text-tertiary hover:border-border-strong focus:border-brand focus:ring-brand h-11 w-full rounded-xs border py-2 pr-14 pl-4 text-sm transition-colors focus:ring-1 focus:outline-hidden lg:h-12 lg:text-[0.9375rem]"
				/>
			</label>
			<button
				type="submit"
				aria-label={tCommon("search")}
				className="bg-surface-secondary text-text-secondary hover:bg-surface-muted hover:text-text-primary focus-visible:ring-ring rounded-2xs absolute inset-y-1 right-1 flex w-10 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-hidden lg:w-12"
			>
				<SearchIcon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
			</button>
		</form>
	);
}
