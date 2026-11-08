import { Suspense } from "react";
import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLocaleFromChannel } from "@/config/locale";
import { formatPageTitle } from "@/config/brand";
import { ConfirmAccount } from "@/ui/components/auth/confirm-account";

export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "account.meta" });
	return {
		title: formatPageTitle(t("confirmTitle")),
		// A one-off link from an e-mail, never a page to rank. Same treatment as /login.
		robots: { index: false, follow: true },
	};
}

/**
 * Where the account-activation e-mail lands (`redirectUrl` of `accountRegister`).
 *
 * Saleor appends `?email=…&token=…`. The confirmation runs in the browser after load rather
 * than during the server render, so a mail scanner that only fetches the link (Outlook Safe
 * Links does) does not use it up for the customer.
 */
export default function ConfirmAccountPage() {
	return (
		<section className="mx-auto max-w-7xl p-8 pb-24">
			<Suspense fallback={null}>
				<ConfirmAccount />
			</Suspense>
		</section>
	);
}
