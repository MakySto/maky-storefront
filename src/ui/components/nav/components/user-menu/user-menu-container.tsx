import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getLocaleFromChannel } from "@/config/locale";
import { UserIcon } from "lucide-react";
import { UserMenu } from "./user-menu";
import { CurrentUserDocument } from "@/gql/graphql";
import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";

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
		// Was a hardcoded English "Log in" for screen readers on all twelve markets.
		const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "nav" });
		return (
			<LinkWithChannel
				href="/login"
				className="hover:bg-accent hover:text-accent-foreground inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors"
			>
				<UserIcon className="h-5 w-5" aria-hidden="true" />
				<span className="sr-only">{t("login")}</span>
			</LinkWithChannel>
		);
	}
}
