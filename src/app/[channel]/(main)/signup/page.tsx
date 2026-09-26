import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLocaleFromChannel } from "@/config/locale";
import { formatPageTitle } from "@/config/brand";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { marketHasRoute } from "@/lib/route-policy";
import { SignUpForm } from "@/ui/components/sign-up-form";

export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "account.meta" });
	return {
		// Was the English "Create Account" in every market until 2026-09-26.
		title: formatPageTitle(t("signUpTitle")),
		description: t("signUpDescription"),
		// Kept out of the index by a robots.txt Disallow until now. That rule had to go
		// so Googlebot can see the 404s on the junk URLs it already indexed, and a
		// disallowed URL can never be de-indexed. noindex is the right mechanism for a
		// page that should not rank but must stay crawlable.
		robots: { index: false, follow: true },
	};
}

/**
 * The market's terms and privacy pages for the consent line, decided exactly as the footer
 * decides its legal links (`footerLegalLinks`): only a page the market actually serves is
 * linked. Without both, the line is left out rather than pointing at a 404.
 */
function legalLinks(channel: string) {
	const market = REVERSE_MAP[channel] ?? "";
	const has = (segment: string) => marketHasRoute(market, segment);
	return has("obchodne-podmienky") && has("ochrana-osobnych-udajov")
		? {
				terms: marketHref(channel, "/obchodne-podmienky"),
				privacy: marketHref(channel, "/ochrana-osobnych-udajov"),
			}
		: null;
}

export default async function SignUpPage(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	return (
		<section className="mx-auto max-w-7xl p-8 pb-24">
			<SignUpForm legal={legalLinks(channel)} />
		</section>
	);
}
