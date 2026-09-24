"use client";

import { Fragment } from "react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { Menu, Transition } from "@headlessui/react";
import { UserInfo } from "./components/user-info";
import { UserAvatar } from "./components/user-avatar";
import { type UserDetailsFragment } from "@/gql/graphql";
import { logout } from "@/app/actions";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { headerActionClass, headerActionLabelClass } from "@/ui/components/header/header-action";

type Props = {
	user: UserDetailsFragment;
};

const itemClass = (active: boolean) =>
	clsx(
		active && "bg-surface-secondary text-text-primary",
		"text-text-secondary block rounded-2xs px-3 py-2 text-sm font-medium",
	);

/**
 * The signed-in account menu: the avatar where the account icon is, with the same label under
 * it on a desktop. Its entries read "My account", "My orders" and "Log Out" in every market
 * until the 2026-09 header redesign; they come from the `nav` messages now.
 */
export function UserMenu({ user }: Props) {
	const t = useTranslations("nav");
	return (
		<Menu as="div" className="relative">
			<Menu.Button className={headerActionClass}>
				<UserAvatar user={user} />
				<span className={headerActionLabelClass}>{t("myAccount")}</span>
			</Menu.Button>
			<Transition
				as={Fragment}
				enter="transition ease-out duration-100"
				enterFrom="transform opacity-0 scale-95"
				enterTo="transform opacity-100 scale-100"
				leave="transition ease-in duration-75"
				leaveFrom="transform opacity-100 scale-100"
				leaveTo="transform opacity-0 scale-95"
			>
				<Menu.Items className="border-border-subtle bg-surface-card divide-border-subtle absolute right-0 z-[var(--z-dropdown)] mt-2 w-56 origin-top-right divide-y rounded-sm border text-start shadow-lg focus:outline-hidden">
					<UserInfo user={user} />
					<div className="flex flex-col p-1">
						<Menu.Item>
							{({ active }) => (
								<LinkWithChannel href="/account" className={itemClass(active)}>
									{t("myAccount")}
								</LinkWithChannel>
							)}
						</Menu.Item>
						<Menu.Item>
							{({ active }) => (
								<LinkWithChannel href="/account/orders" className={itemClass(active)}>
									{t("myOrders")}
								</LinkWithChannel>
							)}
						</Menu.Item>
					</div>
					<div className="flex flex-col p-1">
						<Menu.Item>
							{({ active }) => (
								<form action={logout} className="w-full">
									<button type="submit" className={clsx(itemClass(active), "w-full text-start")}>
										{t("logout")}
									</button>
								</form>
							)}
						</Menu.Item>
					</div>
				</Menu.Items>
			</Transition>
		</Menu>
	);
}
