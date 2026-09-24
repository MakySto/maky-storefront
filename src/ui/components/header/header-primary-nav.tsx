import { getLocaleFromChannel } from "@/config/locale";
import { getTranslations } from "next-intl/server";
import { HEADER_PRIMARY_NAV, localizedNavHref } from "./header.config";
import { HeaderNavLink } from "./header-nav-link";
import { visibleNavLinks } from "@/lib/cms/availability";

export async function HeaderPrimaryNav({ channel }: { channel: string }) {
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "nav" });
	const tAccount = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "account" });
	// `channel` used to be destructured away, which is how `/poradna` came to be linked
	// in twelve markets and to exist in one. The category links are untouched — they are
	// root catalogue URLs, not routes this policy knows about.
	const items = await visibleNavLinks(channel, HEADER_PRIMARY_NAV);

	return (
		<nav aria-label={tAccount("primaryNavigation")} className="hidden h-full items-stretch lg:flex">
			{items.map((item) => (
				<HeaderNavLink key={item.key} href={localizedNavHref(channel, item.href)}>
					{t(item.key)}
				</HeaderNavLink>
			))}
		</nav>
	);
}
