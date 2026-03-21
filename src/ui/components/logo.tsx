import { getTranslations } from "next-intl/server";
import { LinkWithChannel } from "../atoms/link-with-channel";
import { Logo as SharedLogo } from "./shared/logo";

export const Logo = async () => {
  const t = await getTranslations("common");

  return (
    <LinkWithChannel href="/" className="flex shrink-0 items-center" aria-label="MAKY.STORE">
      <SharedLogo showSlogan slogan={t("slogan")} />
    </LinkWithChannel>
  );
};