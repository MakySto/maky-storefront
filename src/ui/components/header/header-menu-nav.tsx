import { BookOpenIcon, ChevronRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocaleFromChannel } from "@/config/locale";
import { visibleNavLinks } from "@/lib/cms/availability";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { CategoryIcon } from "@/ui/components/shared/category-icons";
import { ADVICE_NAV, ALL_CATEGORIES_NAV, localizedNavHref } from "./header.config";

const rowClass =
	"text-text-primary hover:bg-surface-muted flex min-h-12 items-center gap-3 rounded-md px-1 py-2 text-base font-medium transition-colors";
const iconClass = "bg-surface-muted text-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-md";

/**
 * The category list inside the mobile menu.
 *
 * The menu used to reuse `HeaderPrimaryNav`, whose `<nav>` is `hidden lg:flex` — right for
 * the desktop row, and invisible inside a menu that only exists below `lg`. Every phone on
 * all twelve markets opened a menu holding a search field and nothing else.
 */
export async function HeaderMenuNav({ channel }: { channel: string }) {
	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "nav" });
	const tAccount = await getTranslations({ locale, namespace: "account" });
	const [advice] = await visibleNavLinks(channel, [ADVICE_NAV]);

	return (
		<nav aria-label={tAccount("primaryNavigation")}>
			<h2 className="text-text-tertiary px-1 text-xs font-semibold tracking-wider uppercase">
				{t("categories")}
			</h2>
			<ul className="divide-border-subtle mt-2 divide-y">
				{ALL_CATEGORIES_NAV.map((item) => (
					<li key={item.key}>
						<LinkWithChannel href={localizedNavHref(channel, item.href)} className={rowClass}>
							<span className={iconClass}>
								<CategoryIcon categoryKey={item.key} className="h-5 w-5" />
							</span>
							<span className="flex-1">{t(item.key)}</span>
							<ChevronRightIcon className="text-text-tertiary h-4 w-4" aria-hidden />
						</LinkWithChannel>
					</li>
				))}
			</ul>
			{advice && (
				<div className="border-border-subtle mt-4 border-t pt-4">
					<LinkWithChannel href={advice.href} className={rowClass}>
						<span className={iconClass}>
							<BookOpenIcon className="h-5 w-5" aria-hidden />
						</span>
						<span className="flex-1">{t("advice")}</span>
						<ChevronRightIcon className="text-text-tertiary h-4 w-4" aria-hidden />
					</LinkWithChannel>
				</div>
			)}
		</nav>
	);
}
