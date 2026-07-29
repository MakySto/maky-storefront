import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LinkWithChannel } from "../atoms/link-with-channel";
import { CopyrightText } from "./copyright-text";
import { Logo } from "./shared/logo";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { PrivacySettingsLink } from "./privacy-settings-link";
import { companyInfo, companyPhoneHref } from "@/config/company";

// Legal/content pages are SK-only and SK-channel-gated, so these links render
// only on the SK market (otherwise they would 404 on /de, /pl, … — CLAUDE.md §6).
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

export async function Footer({ channel }: { channel: string }) {
	const t = await getTranslations("footer");
	const tc = await getTranslations("common");
	const isSk = REVERSE_MAP[channel] === "sk";

	return (
		<footer className="bg-gray-900 text-gray-300">
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

					{isSk && (
						<>
							<div>
								<h2 className="mb-4 text-sm font-medium text-gray-200">{t("support")}</h2>
								<ul className="space-y-3">
									{LEGAL_SUPPORT.map((link) => (
										<li key={link.href}>
											<LinkWithChannel href={link.href} prefetch={false} className={linkClass}>
												{t(link.key)}
											</LinkWithChannel>
										</li>
									))}
								</ul>
							</div>

							<div>
								<h2 className="mb-4 text-sm font-medium text-gray-200">{t("company")}</h2>
								<ul className="space-y-3">
									{LEGAL_COMPANY.map((link) => (
										<li key={link.href}>
											<LinkWithChannel href={link.href} prefetch={false} className={linkClass}>
												{t(link.key)}
											</LinkWithChannel>
										</li>
									))}
								</ul>
							</div>
						</>
					)}
				</div>

				<div className="mt-12 border-t border-gray-800 pt-8">
					{isSk && (
						<div className="mb-6 text-xs leading-relaxed text-gray-400">
							<p>
								{companyInfo.legalName} · {companyInfo.street}, {companyInfo.city} · IČO: {companyInfo.ico} ·
								DIČ: {companyInfo.dic}
							</p>
							<p className="mt-1">{companyInfo.registry}</p>
							<p className="mt-1">
								Orgán dozoru: {companyInfo.supervisoryAuthority.name},{" "}
								{companyInfo.supervisoryAuthority.department}
							</p>
						</div>
					)}

					<div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
						<p className="text-xs text-gray-400">
							<CopyrightText />
						</p>
						<div className="flex items-center gap-6">
							{isSk && (
								<>
									<LinkWithChannel
										href="/ochrana-osobnych-udajov"
										prefetch={false}
										className="text-xs text-gray-400 transition-colors hover:text-gray-300"
									>
										{t("privacyPolicy")}
									</LinkWithChannel>
									<LinkWithChannel
										href="/obchodne-podmienky"
										prefetch={false}
										className="text-xs text-gray-400 transition-colors hover:text-gray-300"
									>
										{t("termsOfService")}
									</LinkWithChannel>
								</>
							)}
							<PrivacySettingsLink label={t("privacySettings")} />
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
