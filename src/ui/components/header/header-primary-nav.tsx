import { getTranslations } from "next-intl/server";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { HEADER_PRIMARY_NAV } from "./header.config";

export async function HeaderPrimaryNav({ channel }: { channel: string }) {
  const t = await getTranslations("nav");

  return (
    <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
      {HEADER_PRIMARY_NAV.map((item) => (
        <LinkWithChannel
          key={item.key}
          href={item.href}
          className="rounded-xs px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-sand-100 hover:text-gray-900"
        >
          {t(item.key)}
        </LinkWithChannel>
      ))}
    </nav>
  );
}
