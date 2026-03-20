"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type ComponentProps } from "react";
import { REVERSE_MAP } from "@/lib/channel-map";

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

	// Convert Saleor slug (sk-eur) to friendly prefix (sk)
	const friendly = REVERSE_MAP[channel] || channel;
	const hrefWithChannel = `/${friendly}${href}`;

	return <Link {...props} href={hrefWithChannel} />;
};
