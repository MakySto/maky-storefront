import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getLocaleFromChannel } from "@/config/locale";
import { WishlistView } from "@/ui/components/wishlist/wishlist-view";

/**
 * Favourites — the products this browser marked with the heart (`lib/wishlist`).
 *
 * `noindex, nofollow`: the page is one visitor's list, and an empty shell to everyone else.
 * The page itself is static; the list is read in the browser and its products are asked for in
 * this market's channel, so prices and availability are today's.
 */
export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "wishlist" });
	return {
		title: t("title"),
		robots: { index: false, follow: false },
	};
}

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "wishlist" });

	return (
		<section className="max-w-page mx-auto w-full px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-10">
			<header className="max-w-2xl">
				<h1 className="text-text-primary text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">
					{t("title")}
				</h1>
				<p className="text-text-secondary mt-2 text-sm sm:text-base">{t("intro")}</p>
			</header>
			<WishlistView channel={channel} />
		</section>
	);
}
