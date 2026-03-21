import { HeaderMainRow } from "./header-main-row";
import { HeaderNavRow } from "./header-nav-row";

export async function SiteHeader({ channel }: { channel: string }) {
  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <HeaderMainRow channel={channel} />
        <HeaderNavRow channel={channel} />
      </div>
    </header>
  );
}