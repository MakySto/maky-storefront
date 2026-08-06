import Link from "next/link";
import { Home } from "lucide-react";

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
 */
export default function NotFound() {
	const buttonBase =
		"inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

	return (
		<div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16">
			<div className="mx-auto max-w-md text-center">
				{/* 404 Badge */}
				<span className="mb-4 inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
					404
				</span>

				{/* Heading */}
				<h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">Page Not Found</h1>

				{/* Message */}
				<p className="mb-8 text-muted-foreground">
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
	);
}
