import { type ReactNode, Suspense } from "react";
import { type Metadata } from "next";
import { Footer } from "@/ui/components/footer";
import { Header } from "@/ui/components/header";
import { CartProvider, CartDrawerWrapper } from "@/ui/components/cart";
import { brandConfig } from "@/config/brand";
import { Logo } from "@/ui/components/shared/logo";
import { isChannelIndexable, PREVIEW_MARKET_ROBOTS_META } from "@/lib/market-state";
import { marketOpenGraph } from "@/lib/seo/metadata";

/**
 * Dynamic metadata per channel — hreflang, canonical, OG locale.
 */
export async function generateMetadata({
	params,
}: {
	params: Promise<{ channel: string }>;
}): Promise<Metadata> {
	const { channel } = await params;

	return {
		// absolute: the root layout's title.template would otherwise brand the
		// site name itself ("MAKY.STORE | MAKY.STORE" on the homepage).
		title: { absolute: brandConfig.siteName },
		description: brandConfig.description,
		// The whole object, not just the locale.
		//
		// Next replaces `openGraph` wholesale at the deepest segment that declares it;
		// it does not merge field by field. This one declared `locale` alone, so it
		// silently dropped `type`, `siteName` AND `images` from the root metadata, and
		// it also blocked the `opengraph-image.png` file convention from filling the
		// gap. Measured on production 2026-09-07: every page except a product PDP —
		// which sets its own — shipped og:title, og:description and og:locale and no
		// og:image at all. The share card existed as a file that nothing pointed at.
		//
		// `marketOpenGraph` is that whole object, shared with every page that declares its
		// own `openGraph` to add an og:url — so they replace this with the same fields.
		openGraph: marketOpenGraph(channel),
		// The SECOND `noindex` for a market no index GO has been given for. The first
		// is the `X-Robots-Tag` header from src/proxy.ts, and it remains the one that
		// reacts to a restart.
		//
		// This one was here alone once, and alone it did not work: generateMetadata has
		// no request-time input, so under cacheComponents it is evaluated once and baked
		// into the prerendered shell — measured 2026-08-06, with MAKY_LIVE_MARKETS="sk,cz"
		// the sitemap picked cz up immediately (it is a dynamic route) while /cz kept
		// serving the `noindex` baked at build time. A market state that can only change
		// at build time is not a market state.
		//
		// That is still true, and it is why this is a floor rather than the control. Baked
		// is exactly the property wanted from a backstop: it survives the header going
		// missing, whether because a response did not come through `marketRewrite()` or
		// because somebody edited an env var. Lifting it needs a deploy, which is what
		// "explicit index GO" means for a step Google will not let us take back.
		//
		// For an indexable market the key is ABSENT, not `undefined`, so pages keep
		// deciding for themselves and everything else inherits the root's `index, follow,
		// max-image-preview:large`. The difference is not cosmetic: Next merges metadata
		// with `for (key in metadata)`, and a key that is present with the value `undefined`
		// still runs `resolveRobots(undefined)` and resets the parent's robots to nothing.
		// That is what this line did from 2026-09-20 — no page on an indexable market
		// emitted a robots meta at all. The floor itself is unchanged.
		...(isChannelIndexable(channel) ? {} : { robots: PREVIEW_MARKET_ROBOTS_META }),
		//
		// Canonical + hreflang are page-specific and set per page (the homepage
		// owns the market canonical). A layout-level canonical with path="" would
		// wrongly mark every page as a duplicate of the market homepage.
	};
}

/**
 * Mirrors SiteHeader row for row, because it has to reserve the same height.
 *
 * The old skeleton was a single 64px row while the real header was taller, so every cold load
 * pushed the page down by ~50px when the header resolved — the whole of a measured 0.06 CLS.
 * Since the 2026-09 redesign the header is 64px + a 56px search row on a phone and a 72px +
 * 52px pair of rows on a desktop; the wrapper classes here are copied from SiteHeader and
 * HeaderMainRow deliberately, so if those rows change height, this changes with them.
 */
function HeaderSkeleton() {
	return (
		<header className="border-border-subtle bg-surface-card sticky top-0 z-[var(--z-header)] border-b print:hidden">
			<div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex h-16 items-center gap-2 sm:gap-4 lg:h-[4.5rem] lg:gap-8">
					{/* hamburger — mobile and tablet only */}
					<div className="bg-surface-secondary h-10 w-10 shrink-0 animate-pulse rounded-xs lg:hidden" />
					<div className="flex shrink-0 items-center">
						<Logo className="h-7 w-auto" />
					</div>
					{/* inline search — desktop only */}
					<div className="hidden flex-1 justify-center lg:flex">
						<div className="bg-surface-secondary h-12 w-full max-w-3xl animate-pulse rounded-xs" />
					</div>
					<div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 lg:ml-0 lg:gap-2">
						<div className="bg-surface-secondary h-10 w-10 animate-pulse rounded-xs lg:h-14 lg:w-16" />
						<div className="bg-surface-secondary h-10 w-10 animate-pulse rounded-xs lg:h-14 lg:w-16" />
						<div className="bg-surface-secondary h-10 w-10 animate-pulse rounded-xs lg:h-14 lg:w-16" />
					</div>
				</div>

				{/* search row — mobile and tablet only: the field and the 44px vehicle square */}
				<div className="flex items-center gap-2 pb-3 lg:hidden">
					<div className="bg-surface-secondary h-11 min-w-0 flex-1 animate-pulse rounded-xs" />
					<div className="bg-surface-secondary h-11 w-11 shrink-0 animate-pulse rounded-xs" />
				</div>
			</div>

			{/* nav row — desktop only */}
			<div className="border-border-subtle hidden border-t lg:block">
				<div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex h-[3.25rem] items-center" />
				</div>
			</div>
		</header>
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
				{/* No Suspense around the page. There was one here — `fallback={null}`, from the
				    Paper template — and it put the footer on screen before the content on
				    every page of the site.

				    React 19.2 does not write a finished boundary in place when doing so would
				    take the flush past 12 800 bytes (`progressiveChunkSize`); it "outlines"
				    it: an empty <template> here, the content after the footer, and a `$RC`
				    script to move it in. The head and the header already fill ~11 KB, so any
				    page body over ~1.5 KB was outlined — the homepage, every category, every
				    legal page, measured in `.next/server/app/sk-eur*.html`. And `$RC` waits
				    until 300 ms after the first frame once one has been painted. When the
				    browser painted before reaching it, the first frame was the header with
				    the footer right under it, and 300 ms later the page pushed the footer
				    off-screen: CLS 0.87 on /sk and 0.61 on a product page in Lighthouse, and
				    the same race for real visitors on a slow parse.

				    Without the boundary the body is written inline and the first frame holds
				    the real page. A route that needs request-time data before it can render
				    anything declares its own boundary at page level, with a fallback tall
				    enough to keep the footer below the fold (`RouteLoading`). The build
				    enforces it: without one, `next build` fails with "Uncached data was
				    accessed outside of Suspense". */}
				<main className="flex-1">{props.children}</main>
				<Footer channel={channel} />
			</div>
			<Suspense fallback={null}>
				<CartDrawerWrapper channel={channel} />
			</Suspense>
		</CartProvider>
	);
}
