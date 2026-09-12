import Link from "next/link";

import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { isPubliclyVisible } from "@/lib/catalog-content/publication";
import { catalogServesMarket, loadCatalogView } from "@/lib/catalog-content/resolve";

/**
 * The way into the vehicle tree from the category page.
 *
 * CFM published 1 474 vehicle pages on 2026-09-12 and, until this existed, the only way
 * to reach any of them was to type the URL. They were in the sitemap and absent from the
 * site — a crawler could find them and a visitor could not, which is both a bad link
 * graph and a worse experience than having no pages at all.
 *
 * ## What it shows
 *
 * Makes only — 62 of them, not 1 474 links. A model and a generation are one and two
 * clicks further in, and they are already listed by the tiles on each page. Dumping the
 * whole tree here would bury the product listing this page exists to show.
 *
 * ## The gates
 *
 * `isPubliclyVisible` — the same gate the route itself applies, so this cannot link to a
 * page that answers not-found. `catalogServesMarket` — the snapshot's language must be
 * the market's, so the Slovak snapshot never furnishes a German page with Slovak links.
 * That second one is also why the copy below can be plain Slovak: this section only ever
 * renders on a market whose language the snapshot carries, and today that is `sk` alone.
 *
 * The `urlPath` prefix check is what keeps a second assortment honest: these pages are
 * roof racks, and only the roof-rack category may advertise them.
 */
export async function CatalogMakeIndex({ channel, slug }: { channel: string; slug: string }) {
	const view = await loadCatalogView();
	const market = REVERSE_MAP[channel] ?? channel;
	if (!catalogServesMarket(view, market)) return null;
	if (!view.ready) return null;

	const makes = view.tree.makes
		.filter((make) => make.page && isPubliclyVisible(make.page))
		.filter((make) => make.urlPath.startsWith(`/${slug}/`));

	if (makes.length === 0) return null;

	return (
		<section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<h2 className="text-text-primary text-xl font-bold sm:text-2xl">Vyberte nosič podľa vozidla</h2>
			<p className="text-text-secondary mt-2 text-sm">
				Pri každom vozidle nájdete typ strechy, vhodné zostavy a návod na montáž.
			</p>
			<ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
				{makes.map((make) => (
					<li key={make.vehicleId}>
						<Link
							href={marketHref(channel, make.urlPath)}
							className="border-border-default hover:border-action-primary bg-surface-primary text-text-primary flex h-full items-center rounded-lg border px-3 py-2 text-sm font-medium break-words transition-colors"
						>
							{make.name}
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
