import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLocaleFromChannel } from "@/config/locale";
import { marketHref } from "@/lib/channel-map";

/**
 * Homepage brand strip.
 *
 * Every name here must clear two tests, and the list before 2026-09-22 cleared neither.
 *
 * 1. Approved for the homepage — CLAUDE.md §6 names Thule, Nordrive, Menabo, Yakima,
 *    Peruzzo, Pro-USER, Spinder, Green Valley, SnowDrive and DAC, and explicitly says
 *    NOT to show Cruz, HAK-SYSTEM, GALIA, ORIS or JAEGER until approved. A brand that only
 *    appears in a generated mockup (Dometic, iKamper) is not approved either.
 * 2. Actually stocked. Checked against the `cfm:attribute:manufacturer` values in Saleor.
 *    SnowDrive is approved but has no catalogue products, so it is left out until it does.
 *
 * Each name is set as a wordmark and leads somewhere real: the search for that brand. There
 * is no brand index page, so there is no "all brands" link.
 */
const BRANDS = [
	"Thule",
	"Yakima",
	"Menabo",
	"Nordrive",
	"Peruzzo",
	"Pro-USER",
	"Spinder",
	"Green Valley",
	"DAC",
];

export async function BrandsStrip({ channel }: { channel: string }) {
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "home" });

	return (
		<section className="max-w-page mx-auto px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
			<h2 className="text-text-primary text-xl font-bold tracking-[-0.02em] sm:text-2xl">
				{t("brandsTitle")}
			</h2>
			<ul className="border-border-subtle mt-6 grid grid-cols-3 items-center gap-x-4 gap-y-7 border-y py-8 sm:grid-cols-5 lg:flex lg:justify-between lg:gap-x-6">
				{BRANDS.map((name) => (
					<li key={name} className="text-center">
						<Link
							href={marketHref(channel, `/search?query=${encodeURIComponent(name)}`)}
							prefetch={false}
							// Set like a wordmark in the secondary graphite; the brand's own colour on hover.
							className="text-text-secondary hover:text-brand text-lg font-black tracking-[0.06em] whitespace-nowrap uppercase transition-colors sm:text-xl"
						>
							{name}
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
