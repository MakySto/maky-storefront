import { isB2bEuChannel } from "@/checkout/lib/b2b/contract";
import { CHANNEL_MAP } from "@/lib/channel-map";

/**
 * The informative price without VAT under the main (gross) price on the product page, in the EU markets of
 * MAKY-B2B-V1.
 *
 * Which products: every product. A company may buy anything in the shop as a company, not only the Kargo shelf
 * (Marek, 2. 11. 2026; zadanie 02 had named only the roof racks and baskets for vans), and the backend's exemption
 * does not depend on what is in the cart either.
 * Which markets: the EU channels of MAKY-B2B-V1; US and Canada are export markets with no VAT line at all.
 * Which number: Saleor's own `pricing.price.net` of the variant on the page, never a figure worked out here from
 * the gross. When Saleor's net is not below its gross (no tax configured for that channel, a free item) the line
 * is not printed: "bez DPH" equal to "s DPH" would claim something Saleor did not compute.
 *
 * It is informative and public: the catalogue price, the same for every visitor. What a company actually pays is
 * decided in the checkout by the backend (`checkout.b2bTaxState`), not by this line.
 */

type Money = { amount: number; currency: string };

export type InformativeNetPriceInput = {
	/** The route's channel or market (`sk-eur` or `sk`). */
	channel: string;
	/** The selected variant's pricing; nothing before a variant is chosen. */
	price: { gross?: Money | null; net?: Money | null } | null | undefined;
};

export function informativeNetPrice(input: InformativeNetPriceInput): Money | null {
	const saleorChannel = CHANNEL_MAP[input.channel]?.saleorSlug ?? input.channel;
	if (!isB2bEuChannel(saleorChannel)) return null;
	const gross = input.price?.gross;
	const net = input.price?.net;
	if (!gross || !net) return null;
	if (net.currency !== gross.currency) return null;
	if (!Number.isFinite(net.amount) || !Number.isFinite(gross.amount)) return null;
	if (!(net.amount > 0) || !(net.amount < gross.amount)) return null;
	return { amount: net.amount, currency: net.currency };
}
