import "./globals.css";
import Link from "next/link";
import { Home, Search } from "lucide-react";
import { brandConfig } from "@/config/brand";
import {
	NOT_FOUND_BLOCK_ATTRIBUTE,
	NOT_FOUND_DEFAULT_BLOCK,
	NOT_FOUND_MARKET_ATTRIBUTE,
	NOT_FOUND_MARKET_CSS,
	NOT_FOUND_MARKET_SCRIPT,
	NOT_FOUND_MARKETS,
} from "@/lib/not-found-markets";
import { NotFoundMarketMarker } from "@/ui/components/not-found-market-marker";
import { Logo } from "@/ui/components/shared/logo";

/**
 * The static 404: what every proxy rewrite to `/_not-found` shows.
 *
 * Two kinds of address arrive here. One has no market in it (/wishlist, /admin.php,
 * /does.not.exist) and gets the English block, which is the honest answer for a URL with no
 * market. The other has one: the existence gate found no product, category or page at
 * `/de/gibt-es-nicht`, and it has to rewrite here and not to a route under `[channel]`, because
 * only a fully static route keeps the rewrite's 404 status (`src/proxy.ts`). Until 2026-11-27
 * that customer read the same English page with no logo and a link to `/`; now the page carries
 * a block per market and the address picks one (`src/lib/not-found-markets.ts`). An in-app
 * `notFound()` still renders `[channel]/(main)/not-found.tsx`, inside the market's layout.
 *
 * The "Browse Products" link that used to sit here pointed at `/products`, which
 * this very proxy 404s — `products` is not a market. A 404 page whose own link
 * 404s is a poor apology, and there is no market-neutral catalogue URL to replace
 * it with, so it is gone rather than guessed.
 *
 * This file sits at the app root, ABOVE both root layouts, because that is the only place
 * Next will use for a URL that matched no route at all — put it inside a group and the
 * unmatched-URL case falls back to Next's own built-in "404: This page could not be found",
 * which is neither branded nor styled. Measured on a real build; nothing else reveals it.
 *
 * Having no layout, it must bring its own stylesheet (the `globals.css` import above) —
 * otherwise the page is correct and completely unstyled. It must NOT bring its own `<html>`:
 * Next wraps this file in a minimal document of its own, and rendering a second one nests
 * `<html>` inside `<body>`, which only works because the HTML parser hoists the attributes
 * back out. That wrapper is why the document itself has no `lang`: each block states its own,
 * and the inline script sets the document's once it knows the market.
 *
 * `<title>` is an element rather than a `metadata` export for the same reason — no layout
 * means nothing merges a metadata object here, and React hoists the element into `<head>`.
 * No robots meta: Next already emits `noindex` for this route, and a second one is just a
 * duplicate tag saying the same thing.
 *
 * Known and accepted: without JavaScript the wrapper carries no `lang` and the English block is
 * the one shown. Giving the document a real one on the server means not using Next's
 * unmatched-URL route at all, which would mean a crawlable `/404` URL.
 */
const BUTTON_BASE =
	"inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

interface NotFoundBlockProps {
	/** The market, or `NOT_FOUND_DEFAULT_BLOCK`. */
	block: string;
	lang: string;
	title: string;
	description: string;
	homeLabel: string;
	homeHref: string;
	products?: { label: string; href: string };
	search?: { action: string; label: string; ariaLabel: string; placeholder: string };
}

function NotFoundBlock({
	block,
	lang,
	title,
	description,
	homeLabel,
	homeHref,
	products,
	search,
}: NotFoundBlockProps) {
	return (
		<div {...{ [NOT_FOUND_BLOCK_ATTRIBUTE]: block }} lang={lang}>
			<header className="border-border-default border-b">
				<div className="mx-auto flex max-w-5xl items-center px-4 py-3">
					<Link href={homeHref} className="flex min-w-0 items-center">
						<Logo />
					</Link>
				</div>
			</header>

			<div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
				<div className="mx-auto w-full max-w-md text-center">
					<span className="bg-surface-muted text-text-secondary mb-4 inline-block rounded-full px-3 py-1 text-sm font-medium">
						404
					</span>

					<h1 className="text-text-primary mb-2 text-2xl font-bold tracking-tight">{title}</h1>

					<p className="text-text-secondary mb-8">{description}</p>

					{search && (
						<form action={search.action} method="get" role="search" className="relative mb-6 w-full">
							<label className="block">
								<span className="sr-only">{search.ariaLabel}</span>
								<input
									type="text"
									name="query"
									pattern=".*\S.*"
									placeholder={search.placeholder}
									autoComplete="off"
									required
									className="border-border-default bg-surface-card text-text-primary placeholder:text-text-tertiary hover:border-border-strong focus:border-brand focus:ring-brand h-11 w-full rounded-xs border py-2 pr-14 pl-4 text-left text-sm transition-colors focus:ring-1 focus:outline-hidden"
								/>
							</label>
							<button
								type="submit"
								aria-label={search.label}
								className="bg-surface-secondary text-text-secondary hover:bg-surface-muted hover:text-text-primary focus-visible:ring-ring rounded-2xs absolute inset-y-1 right-1 flex w-10 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
							>
								<Search className="h-[1.125rem] w-[1.125rem]" aria-hidden />
							</button>
						</form>
					)}

					<div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
						{products && (
							<Link
								href={products.href}
								className={`${BUTTON_BASE} bg-action-primary text-action-primary-text hover:bg-action-primary-hover`}
							>
								<Search className="h-4 w-4" aria-hidden />
								{products.label}
							</Link>
						)}
						<Link
							href={homeHref}
							className={
								products
									? `${BUTTON_BASE} border-border-default bg-surface-primary text-text-primary hover:bg-surface-muted border`
									: `${BUTTON_BASE} bg-action-primary text-action-primary-text hover:bg-action-primary-hover`
							}
						>
							<Home className="h-4 w-4" aria-hidden />
							{homeLabel}
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function NotFound() {
	return (
		<>
			<title>{brandConfig.siteName}</title>
			<style dangerouslySetInnerHTML={{ __html: NOT_FOUND_MARKET_CSS }} />
			{/* Before the blocks, so the market is known before any of them is painted. */}
			<script dangerouslySetInnerHTML={{ __html: NOT_FOUND_MARKET_SCRIPT }} />
			<NotFoundMarketMarker
				attribute={NOT_FOUND_MARKET_ATTRIBUTE}
				locales={Object.fromEntries(NOT_FOUND_MARKETS.map(({ market, locale }) => [market, locale]))}
			/>

			<NotFoundBlock
				block={NOT_FOUND_DEFAULT_BLOCK}
				lang="en"
				title="Page Not Found"
				description="The page you're looking for doesn't exist or has been moved."
				homeLabel="Go Home"
				homeHref="/"
			/>

			{NOT_FOUND_MARKETS.map((entry) => (
				<NotFoundBlock
					key={entry.market}
					block={entry.market}
					lang={entry.locale}
					title={entry.title}
					description={entry.description}
					homeLabel={entry.homeLabel}
					homeHref={entry.homeHref}
					products={{ label: entry.productsLabel, href: entry.productsHref }}
					search={{
						action: entry.searchAction,
						label: entry.searchLabel,
						ariaLabel: entry.searchAriaLabel,
						placeholder: entry.searchPlaceholder,
					}}
				/>
			))}
		</>
	);
}
