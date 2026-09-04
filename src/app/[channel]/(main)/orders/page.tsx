import { redirect } from "next/navigation";
import { marketHref } from "@/lib/channel-map";

type Props = {
	params: Promise<{ channel: string }>;
};

// This page only calls redirect(), but it still answers HTTP 200: under
// cacheComponents the shell is flushed before the component runs, so the
// redirect happens on the client and a crawler sees a 200 with metadata.
// Verified against production, which serves /sk/orders as 200 `index, follow`.
export const metadata = {
	robots: { index: false, follow: true },
};

/**
 * Redirect legacy /orders route to the new /account/orders route.
 */
export default async function LegacyOrdersPage({ params }: Props) {
	const { channel } = await params;
	redirect(marketHref(channel, "/account/orders"));
}
