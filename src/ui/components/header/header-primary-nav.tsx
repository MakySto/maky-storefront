import { getTranslations } from "next-intl/server";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { HEADER_PRIMARY_NAV } from "./header.config";

export async function HeaderPrimaryNav({}: { channel: string }) {
	const t = await getTranslations("nav");
	const tAccount = await getTranslations("account");

	return (
		<nav aria-label={tAccount("primaryNavigation")} className="hidden items-center gap-0.5 lg:flex">
			{HEADER_PRIMARY_NAV.map((item) => (
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
