import { getTranslations } from "next-intl/server";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { HEADER_PRIMARY_NAV } from "./header.config";
import { visibleNavLinks } from "@/lib/cms/availability";

export async function HeaderPrimaryNav({ channel }: { channel: string }) {
	const t = await getTranslations("nav");
	const tAccount = await getTranslations("account");
	// `channel` used to be destructured away, which is how `/poradna` came to be linked
	// in twelve markets and to exist in one. The category links are untouched — they are
	// root catalogue URLs, not routes this policy knows about.
	const items = await visibleNavLinks(channel, HEADER_PRIMARY_NAV);

	return (
		<nav aria-label={tAccount("primaryNavigation")} className="hidden items-center gap-0.5 lg:flex">
			{items.map((item) => (
				<LinkWithChannel
					key={item.key}
					href={item.href}
					className="hover:bg-sand-200 rounded-xs px-3 py-2 text-[0.9375rem] font-medium text-gray-700 transition-colors hover:text-gray-900"
				>
					{t(item.key)}
				</LinkWithChannel>
			))}
		</nav>
	);
}
