import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LinkWithChannel } from "../atoms/link-with-channel";
import { CopyrightText } from "./copyright-text";
import { Logo } from "./shared/logo";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { marketHasRoute } from "@/lib/route-policy";
import { cmsRouteAvailable, isCmsRoute } from "@/lib/cms/availability";
import { PrivacySettingsLink } from "./privacy-settings-link";
import { companyInfo, companyPhoneHref } from "@/config/company";

// Which of these a market actually has is `route-policy.ts`'s answer, not a second
// list kept in step by hand: `marketHasRoute` is the same question the proxy asks
// before it 404s, so a link can never point at a route the proxy would refuse.
// Every market with approved legal copy gets the seven static pages. `/o-nas` is a
// CMS page and needs BOTH halves: `marketHasRoute` says the application offers the
// route, and `cmsRouteAvailable` says an editor has actually published a document for
// this market right now. This comment used to claim the link "follows the CMS" while
// the code read only the static table, so an unpublish changed the page and left the
// navigation advertising it.
//
// This is deliberately NOT driven by `MAKY_LIVE_MARKETS` or the indexing flag.
// Whether a market sells yet, and whether Google may index it, say nothing about
// whether the visitor may reach the mandatory information — `/kontakt` and
// `/obchodne-podmienky` must be reachable from every page (zákon 22/2004,
// Directive 2000/31/EC Art. 5, and CLAUDE.md §9).
const LEGAL_SUPPORT = [
	{ key: "contact", href: "/kontakt" },
	{ key: "shippingAndPayment", href: "/doprava-a-platba" },
	{ key: "returns", href: "/reklamacie-a-vratenie" },
	{ key: "withdrawal", href: "/odstupenie-od-zmluvy" },
] as const;

const LEGAL_COMPANY = [
	{ key: "aboutUs", href: "/o-nas" },
	{ key: "termsOfService", href: "/obchodne-podmienky" },
	{ key: "privacyPolicy", href: "/ochrana-osobnych-udajov" },
	{ key: "cookiePolicy", href: "/cookies" },
] as const;

const linkClass = "text-sm text-gray-400 transition-colors hover:text-gray-200";

/** `/kontakt` → `kontakt`, the shape `route-policy` keys on. */
const segmentOf = (href: string) => href.slice(1);

/**
 * Which legal links this market may show, given only the route policy.
 *
 * Exported and pure so it can be asserted per market: the component itself is an
 * async server component and this repo's tests run in `node` with no DOM, so the
 * decision has to be reachable without rendering. `footer.test.ts` is what stops
 * this quietly going back to hiding every legal link outside `sk`.
 */
export function footerLegalLinks(channel: string) {
	// An unrecognised channel yields "", which no policy lists — so it renders no
	// legal link rather than one that would 404.
	const market = REVERSE_MAP[channel] ?? "";
	const has = (href: string) => marketHasRoute(market, segmentOf(href));

	return {
		support: LEGAL_SUPPORT.filter((link) => has(link.href)),
		company: LEGAL_COMPANY.filter((link) => has(link.href)),
		showPrivacyPolicy: has("/ochrana-osobnych-udajov"),
		showTerms: has("/obchodne-podmienky"),
	};
}

/**
 * Drop CMS-backed links whose document is not published for this market.
 *
 * `footerLegalLinks` answers the static half — does the application offer this route
 * here. A CMS route needs the other half too, because an editor unpublishing `/o-nas`
 * must not leave the footer advertising it. Only CMS routes are asked, and only after
 * the static gate has already said yes, so a market that does not offer the route costs
 * nothing. See `cms/availability.ts` for why an outage does NOT remove the link.
 */
type FooterLink = { readonly key: string; readonly href: string };

async function withCmsAvailability(channel: string, links: readonly FooterLink[]): Promise<FooterLink[]> {
	const decisions = await Promise.all(
		links.map(async (link) => {
			const segment = segmentOf(link.href);
			if (!isCmsRoute(segment)) return true;
			return cmsRouteAvailable(channel, segment);
		}),
	);
	return links.filter((_, index) => decisions[index]);
}

export async function Footer({ channel }: { channel: string }) {
	const t = await getTranslations("footer");
	const tc = await getTranslations("common");
	const links = footerLegalLinks(channel);
	const { showPrivacyPolicy, showTerms } = links;
	const [support, company] = await Promise.all([
		withCmsAvailability(channel, links.support),
		withCmsAvailability(channel, links.company),
	]);

	return (
		<footer className="bg-gray-900 text-gray-300 print:hidden">
			<div className="mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6 sm:pb-12 lg:px-8 lg:py-16">
				<div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
					<div className="col-span-2 md:col-span-1">
						<Link href={marketHref(channel)} prefetch={false} className="mb-4 inline-block">
							<Logo className="h-7 w-auto" inverted showSlogan slogan={tc("slogan")} />
						</Link>
						<p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-400">{t("tagline")}</p>
						<a href={`mailto:${companyInfo.email}`} className={`mt-4 inline-block ${linkClass}`}>
							{companyInfo.email}
						</a>
						<a href={companyPhoneHref} className={`mt-1 block ${linkClass}`}>
							{companyInfo.phone}
						</a>
					</div>

					{support.length > 0 && (
						<div>
							<h2 className="mb-4 text-sm font-medium text-gray-200">{t("support")}</h2>
							<ul className="space-y-3">
								{support.map((link) => (
									<li key={link.href}>
										<LinkWithChannel href={link.href} prefetch={false} className={linkClass}>
											{t(link.key)}
										</LinkWithChannel>
									</li>
								))}
							</ul>
						</div>
					)}

					{company.length > 0 && (
						<div>
							<h2 className="mb-4 text-sm font-medium text-gray-200">{t("company")}</h2>
							<ul className="space-y-3">
								{company.map((link) => (
									<li key={link.href}>
										<LinkWithChannel href={link.href} prefetch={false} className={linkClass}>
											{t(link.key)}
										</LinkWithChannel>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>

				{/* No identification block here. It moved out at Marek's request: the same
				    details (legal name, address, IČO, DIČ, register entry, SOI as the
				    supervisory authority) are already in full on /kontakt,
				    /obchodne-podmienky and /reklamacie-a-vratenie — verified before removing.
				    Both /kontakt and /obchodne-podmienky are linked from this footer on every
				    page, which is what "easily, directly and permanently accessible" asks for
				    under zákon 22/2004 and Directive 2000/31/EC Art. 5. The footer itself is
				    not the required location. */}
				<div className="mt-12 border-t border-gray-800 pt-8">
					<div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
						<p className="text-xs text-gray-400">
							<CopyrightText />
						</p>
						<div className="flex items-center gap-6">
							{showPrivacyPolicy && (
								<LinkWithChannel
									href="/ochrana-osobnych-udajov"
									prefetch={false}
									className="text-xs text-gray-400 transition-colors hover:text-gray-300"
								>
									{t("privacyPolicy")}
								</LinkWithChannel>
							)}
							{showTerms && (
								<LinkWithChannel
									href="/obchodne-podmienky"
									prefetch={false}
									className="text-xs text-gray-400 transition-colors hover:text-gray-300"
								>
									{t("termsOfService")}
								</LinkWithChannel>
							)}
							<PrivacySettingsLink label={t("privacySettings")} />
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
