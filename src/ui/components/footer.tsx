import { getLocaleFromChannel } from "@/config/locale";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { liveMarkets } from "@/lib/market-state";
import { HeaderMarketControls } from "./header/header-market-controls";
import { CopyrightText } from "./copyright-text";
import { Logo } from "./shared/logo";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { marketHasRoute } from "@/lib/route-policy";
import { visibleNavLinks } from "@/lib/cms/availability";
import { getMarketAssortment, offersFullRange } from "@/lib/market-assortment";
import { PrivacySettingsLink } from "./privacy-settings-link";
import { companyInfo, companyPhoneHref } from "@/config/company";
import { ALL_CATEGORIES_NAV, localizedNavHref } from "./header/header.config";

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

const linkClass = "text-text-inverse/65 hover:text-text-inverse text-sm transition-colors";
const headingClass = "text-text-inverse mb-4 text-[0.9375rem] font-semibold";

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
 * The market and its currency, switchable — in the footer since the owner moved it out of the
 * header (2026-09-24).
 *
 * The live set is read per request, not per build: `MAKY_LIVE_MARKETS` is the one control that
 * promotes a market without a rebuild, and reading it in a prerendered shell would bake the
 * launch-day list into the HTML. `connection()` opts this one control out of the shell; its
 * fallback is the same words, unswitchable, at the same size.
 */
async function FooterMarketControls() {
	await connection();
	return <HeaderMarketControls markets={liveMarkets()} tone="dark" />;
}

export async function Footer({ channel }: { channel: string }) {
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "footer" });
	const tc = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "common" });
	const tNav = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "nav" });
	const links = footerLegalLinks(channel);
	const { showPrivacyPolicy, showTerms } = links;
	// The same rule the header uses, so the two cannot drift apart again.
	const [support, company, categories, assortment] = await Promise.all([
		visibleNavLinks(channel, links.support),
		visibleNavLinks(channel, links.company),
		visibleNavLinks(channel, ALL_CATEGORIES_NAV),
		getMarketAssortment(channel),
	]);

	return (
		// Dark graphite with a copper mountain line drawn along the right edge, as in the approved
		// design. The drawing sits behind a column that holds nothing, so it never runs under a link.
		<footer className="bg-surface-inverse relative overflow-hidden print:hidden">
			<div
				aria-hidden="true"
				className="art-mountains bg-copper-400/55 pointer-events-none absolute right-4 bottom-16 hidden h-52 w-[34rem] xl:block 2xl:right-[calc((100vw-88rem)/2+1rem)]"
			/>
			<div className="max-w-page relative mx-auto px-4 pt-14 pb-24 sm:px-6 sm:pb-10 lg:px-8 lg:pt-16">
				<div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4 xl:grid-cols-[1.25fr_1fr_1fr_1fr_1.6fr]">
					<div className="col-span-2 md:col-span-1">
						<Link href={marketHref(channel)} prefetch={false} className="inline-block">
							<Logo className="h-7 w-auto" inverted showSlogan slogan={tc("slogan")} />
						</Link>
						<p className="text-text-inverse/65 mt-5 max-w-xs text-sm leading-relaxed">
							{/* The line names the shelves, so it says only what this market sells. */}
							{offersFullRange(assortment) ? t("tagline") : t("taglineRoofRacks")}
						</p>
						<div className="mt-5 flex flex-col gap-1.5">
							<a href={`mailto:${companyInfo.email}`} className={linkClass}>
								{companyInfo.email}
							</a>
							<a href={companyPhoneHref} className={linkClass}>
								{companyInfo.phone}
							</a>
						</div>
					</div>

					{/* The categories, on every page. The mobile menu listed none of them until
					    the same change, so on a phone this column was the only way from a product
					    page to another category; it is also every page's crawlable link to all six. */}
					<div>
						<h2 className={headingClass}>{tNav("categories")}</h2>
						<ul className="space-y-2.5">
							{categories.map((item) => (
								<li key={item.key}>
									<Link
										href={marketHref(channel, localizedNavHref(channel, item.href))}
										prefetch={false}
										className={linkClass}
									>
										{tNav(item.key)}
									</Link>
								</li>
							))}
						</ul>
					</div>

					{support.length > 0 && (
						<div>
							<h2 className={headingClass}>{t("support")}</h2>
							<ul className="space-y-2.5">
								{support.map((link) => (
									<li key={link.href}>
										<Link href={marketHref(channel, link.href)} prefetch={false} className={linkClass}>
											{t(link.key)}
										</Link>
									</li>
								))}
							</ul>
						</div>
					)}

					{company.length > 0 && (
						<div>
							<h2 className={headingClass}>{t("company")}</h2>
							<ul className="space-y-2.5">
								{company.map((link) => (
									<li key={link.href}>
										<Link href={marketHref(channel, link.href)} prefetch={false} className={linkClass}>
											{t(link.key)}
										</Link>
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
				<div className="border-text-inverse/10 mt-12 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-text-inverse/55 text-xs">
						<Suspense fallback={<>© {companyInfo.legalName}</>}>
							<CopyrightText />
						</Suspense>
					</p>
					<div className="text-text-inverse/55 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
						{/* The market this page belongs to, and the switch to another one. */}
						<Suspense
							fallback={
								<span className="inline-flex h-9 items-center">
									{tc("country")} | {tc("currency")}
								</span>
							}
						>
							<FooterMarketControls />
						</Suspense>
						{showPrivacyPolicy && (
							<Link
								href={marketHref(channel, "/ochrana-osobnych-udajov")}
								prefetch={false}
								className="text-text-inverse/55 hover:text-text-inverse transition-colors"
							>
								{t("privacyPolicy")}
							</Link>
						)}
						{showTerms && (
							<Link
								href={marketHref(channel, "/obchodne-podmienky")}
								prefetch={false}
								className="text-text-inverse/55 hover:text-text-inverse transition-colors"
							>
								{t("termsOfService")}
							</Link>
						)}
						<PrivacySettingsLink label={t("privacySettings")} />
					</div>
				</div>
			</div>
		</footer>
	);
}
