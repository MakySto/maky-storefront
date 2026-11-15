import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getLocaleFromChannel } from "@/config/locale";
import { TYRE_SHELF_MARKETS } from "@/config/tyre-shelves";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { readTyreShelfOffer, tyrePagePath } from "@/lib/tyre-size/size-page-route";
import { offeredTyreRims, popularTyreSizes } from "@/lib/tyre-size/size-pages";

/** How many sizes the shelf names as shortcuts; the rim pages hold the rest. */
const POPULAR_SIZES = 30;

const CHIP =
	"border-border-default hover:border-action-primary bg-surface-primary text-text-primary inline-flex min-h-11 items-center rounded-sm border px-3 text-sm font-medium tabular-nums transition-colors";

/**
 * "Snow chains by tyre size", under the snow-chain listing: the rims, and the common sizes as shortcuts.
 *
 * The listing pages its 145 products twelve at a time, and nothing on it led to a page about a size. These are plain
 * links in the served HTML, so a visitor who would rather pick from a list than type a size has one, and a crawler
 * that arrives on the shelf reaches every size page in two steps (rim, then size).
 *
 * It says the same to everyone: it does not read the visitor's remembered size. It renders nothing in a market that
 * does not sell the shelf, and when the shop cannot be asked it links from the sealed list alone, since every size it
 * names has a page either way.
 */
export async function TyreSizeDirectory({ channel }: { channel: string }) {
	if (!TYRE_SHELF_MARKETS.has(REVERSE_MAP[channel] ?? channel)) return null;

	const onSale = await readTyreShelfOffer(channel)
		.then((offer) => offer?.onSale ?? null)
		.catch(() => null);
	const rims = offeredTyreRims(onSale);
	if (rims.length === 0) return null;
	const popular = popularTyreSizes(onSale, POPULAR_SIZES);

	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "tyrePages" });
	const href = (slug: string) => marketHref(channel, tyrePagePath(channel, slug));

	return (
		<section
			aria-labelledby="tyre-size-directory"
			data-testid="tyre-size-directory"
			className="border-border-default max-w-page mx-auto mt-10 w-full border-t px-4 pt-8 pb-4 sm:px-6 lg:px-8"
		>
			<h2
				id="tyre-size-directory"
				className="text-text-primary text-lg font-bold tracking-[-0.01em] sm:text-xl"
			>
				{t("directoryHeading")}
			</h2>
			<p className="text-text-secondary mt-1 text-sm">{t("directoryLead")}</p>
			<ul className="mt-4 flex flex-wrap gap-2">
				{rims.map((rim) => (
					<li key={rim.slug}>
						<Link href={href(rim.slug)} className={CHIP}>
							{t("rimCrumb", { rim: rim.rim })}
						</Link>
					</li>
				))}
			</ul>
			{popular.length > 0 && (
				<>
					<h3 className="text-text-tertiary mt-6 text-xs font-semibold tracking-[0.06em] uppercase">
						{t("popularHeading")}
					</h3>
					<ul className="mt-2 flex flex-wrap gap-2">
						{popular.map((size) => (
							<li key={size.slug}>
								<Link href={href(size.slug)} className={CHIP}>
									{size.label}
								</Link>
							</li>
						))}
					</ul>
				</>
			)}
		</section>
	);
}
