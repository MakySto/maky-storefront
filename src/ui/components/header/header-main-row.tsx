import { Suspense } from "react";
import { Logo } from "@/ui/components/logo";
import { HeaderSearch } from "./header-search";
import { HeaderActions } from "./header-actions";
import { MobileMenu } from "@/ui/components/nav/components/mobile-menu";
import { HeaderPrimaryNav } from "./header-primary-nav";

function SearchSkeleton() {
	return <div className="bg-sand-100 h-11 w-full max-w-2xl animate-pulse rounded-sm" />;
}

export async function HeaderMainRow({ channel }: { channel: string }) {
	return (
		// Nothing in this row could shrink, so at 360px CSS (a very common Android
		// width) hamburger 40 + logo 186 + actions 128 + gaps 48 = 402 against 328 of
		// usable width. The document went 42px wider than the viewport and the whole
		// page could be panned sideways while scrolling. The logo is now the flexible
		// one; the hamburger and the actions keep their size and their touch targets.
		<div className="flex h-16 items-center gap-2 sm:gap-4">
			{/* Mobile: hamburger */}
			<div className="shrink-0 lg:hidden">
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
			<div className="ml-auto shrink-0">
				<Suspense>
					<HeaderActions channel={channel} />
				</Suspense>
			</div>
		</div>
	);
}
