import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLocaleFromChannel } from "@/config/locale";

/**
 * Saleor could not say which makers this market sells. Not "no brands" and not "no such brand":
 * the same read succeeds a moment later, so the page says it is unavailable and offers to ask again,
 * instead of answering 500 (or 404) because an optional list was slow at a cold start.
 */
export async function BrandsUnavailable({ channel, retryHref }: { channel: string; retryHref: string }) {
	const locale = getLocaleFromChannel(channel);
	const [t, tCommon] = await Promise.all([
		getTranslations({ locale, namespace: "cms" }),
		getTranslations({ locale, namespace: "common" }),
	]);
	return (
		<section
			role="status"
			className="max-w-page mx-auto flex w-full flex-col items-center px-4 py-16 text-center sm:px-6 lg:px-8"
		>
			<h2 className="text-2xl font-semibold">{t("unavailableTitle")}</h2>
			<p className="text-muted-foreground mt-2 max-w-md">{t("unavailableBody")}</p>
			<Link
				href={retryHref}
				prefetch={false}
				className="hover:bg-primary/90 bg-primary text-primary-foreground mt-8 inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium transition-colors"
			>
				{tCommon("retry")}
			</Link>
		</section>
	);
}
