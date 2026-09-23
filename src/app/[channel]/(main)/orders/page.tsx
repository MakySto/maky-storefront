import { redirect } from "next/navigation";
import { marketHref } from "@/lib/channel-map";

type Props = {
	params: Promise<{ channel: string }>;
};

// This page only calls redirect(). It used to answer HTTP 200 all the same, with the
// redirect done on the client: the market layout wrapped every page in a Suspense
// boundary, so the shell was flushed before this component ran (production served
// /sk/orders as 200 `index, follow`). The layout no longer does, the redirect now runs
// while the page is prerendered, and Next answers a real 307 to /account/orders —
// checked on a build of this tree. The noindex stays as the floor for anything that
// still renders the page.
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
