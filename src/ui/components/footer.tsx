import Link from "next/link";
import { LinkWithChannel } from "../atoms/link-with-channel";
import { ChannelSelect } from "./channel-select";
import { CopyrightText } from "./copyright-text";
import { Logo } from "./shared/logo";
import { marketHref } from "@/lib/channel-map";

const footerLinks = {
  support: [
    { label: "Kontaktujte nás", href: "/contact" },
    { label: "Často kladené otázky", href: "/faq" },
    { label: "Doprava a doručenie", href: "/shipping" },
    { label: "Vrátenie tovaru", href: "/returns" },
  ],
  company: [
    { label: "O nás", href: "/about" },
    { label: "Obchodné podmienky", href: "/terms" },
    { label: "Ochrana súkromia", href: "/privacy" },
    { label: "Reklamačný poriadok", href: "/claims" },
  ],
};

export function Footer({ channel }: { channel: string }) {
  return (
    <footer className="bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 sm:pb-12 lg:px-8 lg:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Link href={marketHref(channel)} prefetch={false} className="mb-4 inline-block">
              <Logo className="h-7 w-auto" inverted />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-400">
              Strešné nosiče, nosiče bicyklov, ťažné zariadenia a príslušenstvo pre vaše auto.
            </p>
            <a href="mailto:info@maky.store" className="mt-4 inline-block text-sm text-neutral-400 transition-colors hover:text-neutral-200">
              info@maky.store
            </a>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-medium text-neutral-300">Podpora</h4>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.href}>
                  <LinkWithChannel href={link.href} prefetch={false} className="text-sm text-neutral-400 transition-colors hover:text-neutral-200">
                    {link.label}
                  </LinkWithChannel>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-medium text-neutral-300">Spoločnosť</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <LinkWithChannel href={link.href} prefetch={false} className="text-sm text-neutral-400 transition-colors hover:text-neutral-200">
                    {link.label}
                  </LinkWithChannel>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-medium text-neutral-300">Kontakt</h4>
            <ul className="space-y-3">
              <li>
                <a href="mailto:info@maky.store" className="text-sm text-neutral-400 transition-colors hover:text-neutral-200">
                  info@maky.store
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex items-center gap-3">
          <span className="text-sm text-neutral-400">🌍</span>
          <ChannelSelect />
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-800 pt-8 sm:flex-row">
          <p className="text-xs text-neutral-500">
            <CopyrightText />
          </p>
          <div className="flex items-center gap-6">
            <LinkWithChannel href="/privacy" prefetch={false} className="text-xs text-neutral-500 transition-colors hover:text-neutral-300">
              Ochrana súkromia
            </LinkWithChannel>
            <LinkWithChannel href="/terms" prefetch={false} className="text-xs text-neutral-500 transition-colors hover:text-neutral-300">
              Obchodné podmienky
            </LinkWithChannel>
          </div>
        </div>
      </div>
    </footer>
  );
}