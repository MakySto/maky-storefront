import { type ReactNode, Suspense } from "react";
import { type Metadata } from "next";
import { Footer } from "@/ui/components/footer";
import { Header } from "@/ui/components/header";
import { CartProvider, CartDrawerWrapper } from "@/ui/components/cart";
import { brandConfig } from "@/config/brand";
import { Logo } from "@/ui/components/shared/logo";
import { getLocaleFromChannel, LOCALE_MAP } from "@/config/locale";

/**
 * Dynamic metadata per channel — hreflang, canonical, OG locale.
 */
export async function generateMetadata({
	params,
}: {
	params: Promise<{ channel: string }>;
}): Promise<Metadata> {
	const { channel } = await params;
	const locale = getLocaleFromChannel(channel);
	const localeConfig = LOCALE_MAP[locale];

	return {
		// absolute: the root layout's title.template would otherwise brand the
		// site name itself ("MAKY.STORE | MAKY.STORE" on the homepage).
		title: { absolute: brandConfig.siteName },
		description: brandConfig.description,
		openGraph: {
			locale: localeConfig?.ogLocale,
		},
		// NOTE: the `noindex` for a market that is not live yet is NOT set here.
		// It is an `X-Robots-Tag` response header from src/proxy.ts.
		//
		// It was here first, and it did not work. generateMetadata has no
		// request-time input, so under cacheComponents it is evaluated once and
		// baked into the prerendered shell — measured 2026-08-06: with
		// MAKY_LIVE_MARKETS="sk,cz" the sitemap picked cz up immediately (it is a
		// dynamic route) while /cz kept serving the `noindex` baked at build time.
		// A market state that can only change at build time is not a market state.
		//
		// Canonical + hreflang are page-specific and set per page (the homepage
		// owns the market canonical). A layout-level canonical with path="" would
		// wrongly mark every page as a duplicate of the market homepage.
	};
}

/**
 * Mirrors SiteHeader row for row, because it has to reserve the same height.
 *
 * The old skeleton was a single 64px row. The real header is that row plus a
 * search row below it on mobile and tablet, plus a bordered nav row on desktop —
 * roughly 120px and 113px. So every cold load pushed the entire page down by
 * ~50px the moment the header resolved, which was the whole of the measured
 * 0.06 CLS. The wrapper classes here are copied from SiteHeader and
 * HeaderMainRow deliberately: if those rows change height, this changes with
 * them.
 */
function HeaderSkeleton() {
	return (
		<header className="sticky top-0 z-[var(--z-header)] bg-white/80 backdrop-blur-xl">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="flex h-16 items-center gap-2 sm:gap-4">
					{/* hamburger — mobile and tablet only */}
					<div className="bg-sand-100 h-10 w-10 shrink-0 animate-pulse rounded-xs lg:hidden" />
					<div className="flex shrink-0 items-center">
						<Logo className="h-7 w-auto" />
					</div>
					{/* inline search — desktop only */}
					<div className="hidden flex-1 justify-center px-8 lg:flex">
						<div className="bg-sand-100 h-11 w-full max-w-2xl animate-pulse rounded-sm" />
					</div>
					<div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
						<div className="bg-sand-100 h-10 w-10 animate-pulse rounded-xs" />
						<div className="bg-sand-100 h-10 w-10 animate-pulse rounded-xs" />
						<div className="bg-sand-100 h-10 w-10 animate-pulse rounded-xs" />
					</div>
				</div>

				{/* search row — mobile and tablet only */}
				<div className="pb-3 lg:hidden">
					<div className="bg-sand-100 h-11 w-full max-w-2xl animate-pulse rounded-sm" />
				</div>
			</div>

			{/* nav row — desktop only */}
			<div className="border-sand-200/60 bg-sand-100/50 hidden border-t backdrop-blur-xl lg:block">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex h-12 items-center" />
				</div>
			</div>
		</header>
	);
}

/**
 * Footer skeleton that matches actual footer dimensions to prevent CLS.
 */
function FooterSkeleton() {
	return (
		<footer className="animate-skeleton-delayed bg-foreground text-background opacity-0">
			<div className="mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6 sm:pb-12 lg:px-8 lg:py-16">
				<div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
					<div className="col-span-2 md:col-span-1">
						<div className="mb-4 h-7 w-24 animate-pulse rounded bg-neutral-700" />
						<div className="mt-4 space-y-2">
							<div className="h-4 w-full max-w-xs animate-pulse rounded bg-neutral-700" />
							<div className="h-4 w-3/4 max-w-xs animate-pulse rounded bg-neutral-700" />
						</div>
					</div>
					{[1, 2, 3].map((i) => (
						<div key={i} className="hidden md:block">
							<div className="mb-4 h-4 w-20 animate-pulse rounded bg-neutral-700" />
							<div className="space-y-3">
								{[1, 2, 3, 4].map((j) => (
									<div key={j} className="h-4 w-24 animate-pulse rounded bg-neutral-700" />
								))}
							</div>
						</div>
					))}
				</div>
				<div className="mt-12 flex items-center justify-between border-t border-neutral-800 pt-8">
					<div className="h-3 w-32 animate-pulse rounded bg-neutral-700" />
					<div className="flex gap-6">
						<div className="h-3 w-20 animate-pulse rounded bg-neutral-700" />
						<div className="h-3 w-24 animate-pulse rounded bg-neutral-700" />
					</div>
				</div>
			</div>
		</footer>
	);
}

export default async function RootLayout(props: {
	children: ReactNode;
	params: Promise<{ channel: string }>;
}) {
	const channel = (await props.params).channel;

	return (
		<CartProvider>
			{/* One flex column for header + content + footer, so nothing has to know
			    how tall the header is. The previous `min-h-[calc(100dvh-64px)]` hard-coded
			    a 64px header; the real one is ~120px on mobile and ~113px on desktop, and
			    it changes again whenever a row is added to it. `flex-1` on <main> pins the
			    footer to the bottom on short pages without that assumption. */}
			<div className="flex min-h-dvh flex-col">
				<Suspense fallback={<HeaderSkeleton />}>
					<Header channel={channel} />
				</Suspense>
				<main className="flex-1">
					<Suspense fallback={null}>{props.children}</Suspense>
				</main>
				<Suspense fallback={<FooterSkeleton />}>
					<Footer channel={channel} />
				</Suspense>
			</div>
			<Suspense fallback={null}>
				<CartDrawerWrapper channel={channel} />
			</Suspense>
		</CartProvider>
	);
}
