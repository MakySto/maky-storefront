import "./globals.css";
import Link from "next/link";
import { Home } from "lucide-react";
import { brandConfig } from "@/config/brand";

/**
 * The 404 body for requests with NO market context.
 *
 * Reached through the proxy's rewrite for an invalid first segment — /wishlist,
 * /admin.php, /does.not.exist. English is correct here precisely because there is
 * no market to localize to; routes that DO have one render
 * `[channel]/(main)/not-found.tsx` instead.
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
 * back out. That wrapper is why there is no `lang` here — and why the copy is English, which
 * is the honest answer for a URL with no market in it. Today's production says `lang="sk"`
 * over this same English text.
 *
 * `<title>` is an element rather than a `metadata` export for the same reason — no layout
 * means nothing merges a metadata object here, and React hoists the element into `<head>`.
 * No robots meta: Next already emits `noindex` for this route, and a second one is just a
 * duplicate tag saying the same thing.
 *
 * Known and accepted: the wrapper carries no `lang`. The copy is English, which is the
 * honest answer for a URL with no market in it, and today's production instead claims
 * `lang="sk"` over that same English text. Giving it a real one means not using Next's
 * unmatched-URL route at all, which would mean a crawlable `/404` URL.
 */
export default function NotFound() {
	const buttonBase =
		"inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

	return (
		<>
			<title>{brandConfig.siteName}</title>
			<div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16">
				<div className="mx-auto max-w-md text-center">
					{/* 404 Badge */}
					<span className="bg-muted text-muted-foreground mb-4 inline-block rounded-full px-3 py-1 text-sm font-medium">
						404
					</span>

					{/* Heading */}
					<h1 className="text-foreground mb-2 text-2xl font-bold tracking-tight">Page Not Found</h1>

					{/* Message */}
					<p className="text-muted-foreground mb-8">
						The page you&apos;re looking for doesn&apos;t exist or has been moved.
					</p>

					{/* Actions */}
					<div className="flex justify-center">
						<Link href="/" className={`${buttonBase} hover:bg-primary/90 bg-primary text-primary-foreground`}>
							<Home className="h-4 w-4" />
							Go Home
						</Link>
					</div>
				</div>
			</div>
		</>
	);
}
