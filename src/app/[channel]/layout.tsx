import "../globals.css";
import { type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { executePublicGraphQL } from "@/lib/graphql";
import { ChannelsListDocument } from "@/gql/graphql";
import { DefaultChannelSlug } from "@/app/config";
import { getLocaleFromChannel, LOCALE_MAP } from "@/config/locale";
import { LocaleProvider } from "@/providers/locale-provider";
import { CookieConsent } from "@/ui/components/cookie-consent";
import { DocumentShell } from "@/ui/components/document-shell";
import { rootMetadata } from "@/lib/seo";

export const metadata = rootMetadata;

export const generateStaticParams = async () => {
	const channels: string[] = [];

	if (DefaultChannelSlug) {
		channels.push(DefaultChannelSlug);
	}

	if (process.env.SALEOR_APP_TOKEN) {
		const result = await executePublicGraphQL(ChannelsListDocument, {
			headers: {
				Authorization: `Bearer ${process.env.SALEOR_APP_TOKEN}`,
			},
		});

		if (result.ok && result.data.channels) {
			const activeChannelSlugs = result.data.channels.filter((ch) => ch.isActive).map((ch) => ch.slug);

			for (const slug of activeChannelSlugs) {
				if (!channels.includes(slug)) {
					channels.push(slug);
				}
			}
		} else if (!result.ok) {
			console.warn("[Channels] Failed to fetch additional channels from API:", result.error.message);
		}
	}

	if (channels.length === 0) {
		console.warn("[Channels] No channels configured. Set NEXT_PUBLIC_DEFAULT_CHANNEL.");
		return [];
	}

	return channels.map((channel) => ({ channel }));
};

/**
 * A ROOT layout: it renders `<html>` for everything under a market.
 *
 * That is the whole reason this is a root and not a nested layout. `<html lang>` has to be
 * the language the page is actually in, and only a root layout can emit it — so a single
 * root at `app/` could only ever name one language for all twelve markets. It named `sk`.
 * Measured on production 2026-09-20: `/at`, `/cz` and `/us` were all served `lang="sk"`,
 * corrected to `de`, `cs` and `en` only after hydration, and never corrected at all for
 * anything that does not execute JavaScript.
 *
 * The full BCP 47 locale, not the bare language: `htmlLang` is two letters, which made
 * Austria and Germany both claim `de` and the US and Canada both claim `en` — the same
 * collision hreflang already avoids by annotating with the market's locale.
 *
 * Routes with no market render `app/(site)/layout.tsx` instead.
 */
export default async function ChannelLayout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ channel: string }>;
}) {
	const { channel } = await params;
	const locale = getLocaleFromChannel(channel);

	setRequestLocale(locale);
	const messages = await getMessages();

	return (
		<DocumentShell lang={LOCALE_MAP[locale]?.locale ?? locale}>
			<NextIntlClientProvider locale={locale} messages={messages}>
				<LocaleProvider locale={locale}>
					{children}
					<CookieConsent />
				</LocaleProvider>
			</NextIntlClientProvider>
		</DocumentShell>
	);
}
