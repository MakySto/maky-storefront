import { Suspense } from "react";
import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLocaleFromChannel } from "@/config/locale";
import { formatPageTitle } from "@/config/brand";
import { ConfirmAccount } from "@/ui/components/auth/confirm-account";

export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const t = await getTranslations({
		locale: getLocaleFromChannel(channel),
		namespace: "account.confirmAccount",
	});
	return {
		title: formatPageTitle(t("metaTitle")),
		// A personal one-time link: never indexed, and nothing on it worth following.
		robots: { index: false, follow: false },
	};
}

/** Target of the activation link in the registration e-mail (see /api/auth/confirm-account). */
export default function ConfirmAccountPage() {
	return (
		<section className="mx-auto max-w-7xl p-8 pb-24">
			<Suspense fallback={null}>
				<ConfirmAccount />
			</Suspense>
		</section>
	);
}
