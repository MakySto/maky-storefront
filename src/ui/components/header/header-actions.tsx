import { Suspense } from "react";
import { HeartIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CartNavItem } from "@/ui/components/nav/components/cart-nav-item";
import { UserMenuContainer } from "@/ui/components/nav/components/user-menu/user-menu-container";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";

function ActionSkeleton() {
  return <div className="h-10 w-10 animate-pulse rounded-xs bg-sand-100" />;
}

export async function HeaderActions({ channel }: { channel: string }) {
  const t = await getTranslations("nav");

  return (
    <div className="flex items-center gap-1">
      <Suspense fallback={<ActionSkeleton />}>
        <UserMenuContainer />
      </Suspense>

      <LinkWithChannel
        href="/wishlist"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xs text-gray-600 transition-colors hover:bg-sand-100 hover:text-gray-900"
        aria-label={t("wishlist")}
      >
        <HeartIcon className="h-5 w-5" aria-hidden />
      </LinkWithChannel>

      <Suspense fallback={<ActionSkeleton />}>
        <CartNavItem channel={channel} />
      </Suspense>
    </div>
  );
}
