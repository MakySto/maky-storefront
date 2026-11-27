"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type ComponentProps } from "react";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";

/**
 * `href` as the address of the market `channel` is in. A path without a market gets the prefix;
 * a path that already carries this market's (`/de/dachtraeger`) is left as it is.
 *
 * Server components can hand a client link the full path (`marketHref(channel, …)`). That keeps a
 * bare `/dachtraeger` out of the page's RSC payload, where a crawler reads every string that looks
 * like a path and asks for it from the root of the domain (Search Console, November 2026: 60 500
 * 404s from the market switcher alone). The first segment of an address is always a market, so a
 * path that starts with this one's is never a bare path that happens to look like it.
 */
export function channelHref(channel: string, href: string): string {
	const market = REVERSE_MAP[channel] || channel;
	if (new RegExp(`^/${market}(?=$|[/?#])`).test(href)) return href;
	return marketHref(channel, href);
}

export const LinkWithChannel = ({
	href,
	...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) => {
	const { channel } = useParams<{ channel?: string }>();

	if (!href.startsWith("/")) {
		return <Link {...props} href={href} />;
	}

	if (!channel) {
		return <Link {...props} href={href} />;
	}

	return <Link {...props} href={channelHref(channel, href)} />;
};
