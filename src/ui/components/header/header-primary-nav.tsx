import { getLocaleFromChannel } from "@/config/locale";
import { getTranslations } from "next-intl/server";
import { HEADER_CATEGORY_NAV, HEADER_UTILITY_NAV, localizedNavHref } from "./header.config";
import { HeaderNavLink } from "./header-nav-link";
import { NavOverflowRow } from "./nav-overflow-row";
import { visibleNavLinks } from "@/lib/cms/availability";

/**
 * The desktop category row: the categories from the left, "Značky" and "Poradňa" at its right.
 *
 * It used to show links by VIEWPORT width (the fridges from 1280px, the skis from 1536px). The
 * page stops growing at 88rem, though, and the labels are market-dependent — so from 1536px up
 * the Slovak row held 897px of links in 865px of room and "Poradňa" ran under the vehicle button,
 * and the Polish and Romanian rows were wider still. Now the row takes the room that is actually
 * left beside "Všetky kategórie" and the vehicle button, and the categories that do not fit give
 * way from the end (`NavOverflowRow`), in every market and at every width.
 */
export async function HeaderPrimaryNav({ channel }: { channel: string }) {
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "nav" });
	const tAccount = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "account" });
	// `channel` used to be destructured away, which is how `/poradna` came to be linked
	// in twelve markets and to exist in one. The category links are untouched — they are
	// root catalogue URLs, not routes this policy knows about.
	const [categories, utility] = await Promise.all([
		visibleNavLinks(channel, HEADER_CATEGORY_NAV),
		visibleNavLinks(channel, HEADER_UTILITY_NAV),
	]);

	return (
		<nav
			aria-label={tAccount("primaryNavigation")}
			className="hidden h-full min-w-0 flex-1 items-stretch gap-2 lg:flex xl:gap-3"
		>
			<NavOverflowRow className="flex h-full min-w-0 flex-1 flex-wrap items-stretch overflow-hidden">
				{categories.map((item) => (
					<HeaderNavLink key={item.key} href={localizedNavHref(channel, item.href)}>
						{t(item.key)}
					</HeaderNavLink>
				))}
			</NavOverflowRow>
			{utility.length > 0 && (
				// A short rule sets them apart from the shelves: they are ways into the catalogue, not
				// categories of it.
				<div className="before:bg-border-default relative flex h-full shrink-0 items-stretch pl-2 before:absolute before:top-1/2 before:left-0 before:h-5 before:w-px before:-translate-y-1/2 xl:pl-3">
					{utility.map((item) => (
						<HeaderNavLink key={item.key} href={localizedNavHref(channel, item.href)}>
							{t(item.key)}
						</HeaderNavLink>
					))}
				</div>
			)}
		</nav>
	);
}
