import { getTranslations } from "next-intl/server";
import { LinkWithChannel } from "../atoms/link-with-channel";
import { Logo as SharedLogo } from "./shared/logo";

export const Logo = async () => {
	const t = await getTranslations("common");

	// No aria-label on the link. The wordmark inside is real text and the slogan beside
	// it is aria-hidden, so the link already computes the accessible name "MAKY.STORE".
	// An explicit label only reintroduced the visible-text/accessible-name mismatch that
	// aria-hidden alone did not settle.
	return (
		<LinkWithChannel href="/" className="flex min-w-0 items-center">
			<SharedLogo showSlogan slogan={t("slogan")} />
		</LinkWithChannel>
	);
};
