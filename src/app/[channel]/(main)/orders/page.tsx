import { redirect } from "next/navigation";
import { marketHref } from "@/lib/channel-map";

type Props = {
	params: Promise<{ channel: string }>;
};

/**
 * Redirect legacy /orders route to the new /account/orders route.
 */
export default async function LegacyOrdersPage({ params }: Props) {
	const { channel } = await params;
	redirect(marketHref(channel, "/account/orders"));
}
