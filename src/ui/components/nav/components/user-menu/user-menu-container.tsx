import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getLocaleFromChannel } from "@/config/locale";
import { UserIcon } from "lucide-react";
import { UserMenu } from "./user-menu";
import { CurrentUserDocument } from "@/gql/graphql";
import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { headerActionClass, headerActionLabelClass } from "@/ui/components/header/header-action";

export async function UserMenuContainer({ channel }: { channel: string }) {
	// During static generation, cookies() throws - skip user fetch entirely
	let hasCookies = false;
	try {
		const cookieStore = await cookies();
		hasCookies = cookieStore.getAll().length > 0;
	} catch {
		// Static generation - no cookies available
	}

	// Only fetch user if we have cookies (runtime request with potential session)
	let user = null;
	if (hasCookies) {
		const result = await executeAuthenticatedGraphQL(CurrentUserDocument, {
			cache: "no-cache",
		});
		// Auth failed or expired = treat as not logged in
		user = result.ok ? result.data.me : null;
	}

	if (user) {
		return <UserMenu user={user} />;
	} else {
		// Was a hardcoded English "Log in" for screen readers on all twelve markets. The visible
		// name is "Môj účet", like the approved header; the link still leads to the login page,
		// which is where an account starts.
		const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "nav" });
		return (
			<LinkWithChannel href="/login" className={headerActionClass}>
				<UserIcon className="h-5 w-5 lg:h-[1.375rem] lg:w-[1.375rem]" aria-hidden="true" />
				<span className={headerActionLabelClass}>{t("myAccount")}</span>
			</LinkWithChannel>
		);
	}
}
