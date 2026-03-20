import { type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { executePublicGraphQL } from "@/lib/graphql";
import { ChannelsListDocument } from "@/gql/graphql";
import { DefaultChannelSlug } from "@/app/config";
import { getLocaleFromChannel } from "@/config/locale";
import { LocaleProvider } from "@/providers/locale-provider";
import { HtmlLangUpdater } from "@/providers/html-lang-updater";

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
			const activeChannelSlugs = result.data.channels
				.filter((ch) => ch.isActive)
				.map((ch) => ch.slug);

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
		<NextIntlClientProvider locale={locale} messages={messages}>
			<LocaleProvider locale={locale}>
				<HtmlLangUpdater />
				{children}
			</LocaleProvider>
		</NextIntlClientProvider>
	);
}