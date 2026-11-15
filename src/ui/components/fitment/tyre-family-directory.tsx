import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getLocaleFromChannel } from "@/config/locale";
import { TYRE_SHELF_MARKETS } from "@/config/tyre-shelves";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { readTyreFamilyCards } from "@/lib/tyre-size/family-cards";
import { tyrePagePath } from "@/lib/tyre-size/size-page-route";
import { ResilientProductImage } from "@/ui/components/ui/resilient-product-image";

/**
 * "Snow chains by model", above the snow-chain listing: one card per model family, with how many of its sizes the
 * channel sells and the lowest price.
 *
 * The listing below it shows 145 products twelve at a time, and nearly all of them are one of thirteen models in
 * another size. A shopper who has not given a tyre size sees the thirteen first and opens the one they came for; a
 * crawler reaches every product in two steps (model, then size). It says the same to everyone, and it is plain links
 * in the served HTML.
 *
 * A row that scrolls sideways on a phone (thirteen cards one above another would push the listing off the first
 * three screens) and a grid from the tablet up. Nothing in a market that does not sell the shelf, and nothing when
 * the shop cannot be asked: the overview is an addition, and the listing below does not wait for it.
 */
export async function TyreFamilyDirectory({ channel }: { channel: string }) {
	if (!TYRE_SHELF_MARKETS.has(REVERSE_MAP[channel] ?? channel)) return null;

	const cards = await readTyreFamilyCards(channel).catch((error: unknown) => {
		console.warn(
			"[tyre-pages] the overview by model is left out:",
			error instanceof Error ? error.message : error,
		);
		return null;
	});
	// One family is not a choice between families.
	if (!cards || cards.length < 2) return null;

	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "tyrePages" });
	const money = (amount: number, currency: string) =>
		new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);

	return (
		<section
			aria-labelledby="tyre-family-directory"
			data-testid="tyre-family-directory"
			className="max-w-page mx-auto w-full px-4 pt-6 sm:px-6 lg:px-8"
		>
			<h2
				id="tyre-family-directory"
				className="text-text-primary text-lg font-bold tracking-[-0.01em] sm:text-xl"
			>
				{t("familiesHeading")}
			</h2>
			<p className="text-text-secondary mt-1 text-sm">{t("familiesLead")}</p>
			<ul className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
				{cards.map((card) => {
					const kind = t(card.page.product === "sock" ? "familyKindSock" : "familyKindChain");
					return (
						<li key={card.page.key} className="w-40 shrink-0 snap-start sm:w-auto">
							<Link
								href={marketHref(channel, tyrePagePath(channel, card.page.slug))}
								className="group/card border-border-subtle bg-surface-card hover:border-action-primary flex h-full flex-col rounded-sm border p-2.5 transition-colors"
							>
								<span className="bg-surface-muted relative block aspect-square w-full overflow-hidden rounded-xs">
									{card.image ? (
										<ResilientProductImage
											src={card.image}
											alt=""
											fill
											sizes="(max-width: 639px) 160px, (max-width: 1023px) 25vw, 14vw"
											className="object-contain p-1.5"
										/>
									) : null}
								</span>
								<span className="text-text-tertiary mt-2.5 text-[0.6875rem] font-semibold tracking-[0.06em] uppercase">
									{kind}
								</span>
								<span className="text-text-primary mt-0.5 text-sm leading-snug font-semibold break-words">
									{card.page.name}
								</span>
								<span className="text-text-secondary mt-1 text-xs">
									{t("familyCardSizes", { count: card.count })}
								</span>
								<span className="text-text-primary mt-auto pt-2 text-sm font-bold tabular-nums">
									{t("familyCardFrom", { price: money(card.price, card.currency) })}
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
