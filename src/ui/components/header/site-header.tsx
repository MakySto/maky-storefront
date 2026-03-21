import { HeaderMainRow } from "./header-main-row";
import { HeaderNavRow } from "./header-nav-row";
import { HeaderSearch } from "./header-search";

export async function SiteHeader({ channel }: { channel: string }) {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <HeaderMainRow channel={channel} />

        {/* Search visible on mobile + tablet, hidden on desktop (where it's inline) */}
        <div className="pb-3 lg:hidden">
          <HeaderSearch channel={channel} />
        </div>
      </div>

      {/* Nav row — desktop only */}
      <div className="hidden border-t border-sand-200/60 bg-sand-100/50 backdrop-blur-xl lg:block">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <HeaderNavRow channel={channel} />
        </div>
      </div>
    </header>
  );
}