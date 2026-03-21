import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LinkWithChannel } from "../atoms/link-with-channel";
import { CopyrightText } from "./copyright-text";
import { Logo } from "./shared/logo";
import { marketHref } from "@/lib/channel-map";

const FOOTER_LINKS = {
  support: [
    { key: "contactUs", href: "/contact" },
    { key: "faq", href: "/faq" },
    { key: "shippingInfo", href: "/shipping" },
    { key: "returns", href: "/returns" },
  ],
  company: [
    { key: "aboutUs", href: "/about" },
    { key: "termsOfService", href: "/terms" },
    { key: "privacyPolicy", href: "/privacy" },
    { key: "claims", href: "/claims" },
  ],
} as const;

export async function Footer({ channel }: { channel: string }) {
  const t = await getTranslations("footer");
  const tc = await getTranslations("common");

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 sm:pb-12 lg:px-8 lg:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Link href={marketHref(channel)} prefetch={false} className="mb-4 inline-block">
              <Logo className="h-7 w-auto" inverted showSlogan slogan={tc("slogan")} />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-400">
              {t("tagline")}
            </p>
            <a href="mailto:info@maky.store" className="mt-4 inline-block text-sm text-gray-400 transition-colors hover:text-gray-200">
              info@maky.store
            </a>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-medium text-gray-200">{t("support")}</h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.support.map((link) => (
                <li key={link.href}>
                  <LinkWithChannel href={link.href} prefetch={false} className="text-sm text-gray-400 transition-colors hover:text-gray-200">
                    {t(link.key)}
                  </LinkWithChannel>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-medium text-gray-200">{t("company")}</h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.company.map((link) => (
                <li key={link.href}>
                  <LinkWithChannel href={link.href} prefetch={false} className="text-sm text-gray-400 transition-colors hover:text-gray-200">
                    {t(link.key)}
                  </LinkWithChannel>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-medium text-gray-200">{t("contact")}</h4>
            <ul className="space-y-3">
              <li>
                <a href="mailto:info@maky.store" className="text-sm text-gray-400 transition-colors hover:text-gray-200">
                  info@maky.store
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-800 pt-8 sm:flex-row">
          <p className="text-xs text-gray-500">
            <CopyrightText />
          </p>
          <div className="flex items-center gap-6">
            <LinkWithChannel href="/privacy" prefetch={false} className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              {t("privacyPolicy")}
            </LinkWithChannel>
            <LinkWithChannel href="/terms" prefetch={false} className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              {t("termsOfService")}
            </LinkWithChannel>
          </div>
        </div>
      </div>
    </footer>
  );
}
