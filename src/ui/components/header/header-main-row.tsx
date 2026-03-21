import { Suspense } from "react";
import { Logo } from "@/ui/components/logo";
import { HeaderSearch } from "./header-search";
import { HeaderActions } from "./header-actions";
import { MobileMenu } from "@/ui/components/nav/components/mobile-menu";
import { HeaderPrimaryNav } from "./header-primary-nav";

function SearchSkeleton() {
  return <div className="h-11 w-full max-w-2xl animate-pulse rounded-sm bg-sand-100" />;
}

export async function HeaderMainRow({ channel }: { channel: string }) {
  return (
    <div className="flex h-16 items-center gap-4">
      {/* Mobile: hamburger */}
      <div className="lg:hidden">
        <Suspense>
          <MobileMenu>
            <Suspense fallback={<SearchSkeleton />}>
              <HeaderSearch channel={channel} />
            </Suspense>
            <Suspense>
              <HeaderPrimaryNav channel={channel} />
            </Suspense>
          </MobileMenu>
        </Suspense>
      </div>

      {/* Logo */}
      <Logo />

      {/* Search — desktop only, dominant center */}
      <div className="hidden flex-1 justify-center px-8 lg:flex">
        <Suspense fallback={<SearchSkeleton />}>
          <HeaderSearch channel={channel} />
        </Suspense>
      </div>

      {/* Actions: account, wishlist, cart */}
      <div className="ml-auto">
        <Suspense>
          <HeaderActions channel={channel} />
        </Suspense>
      </div>
    </div>
  );
}
