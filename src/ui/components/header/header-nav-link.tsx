"use client";

import { usePathname } from "next/navigation";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { cn } from "@/lib/utils";

/**
 * One link of the desktop category row, underlined in brand brown while its category is open.
 *
 * Matched on the last path segment: `/sk/stresne-boxy` in the address bar is the same page as
 * the `/sk-eur/categories/stresne-boxy` the proxy rewrites it to, and both end in the slug the
 * link was built from. A sub-category page underlines nothing — it has no link of its own here.
 */
export function HeaderNavLink({
	href,
	children,
	className,
}: {
	href: string;
	children: React.ReactNode;
	className?: string;
}) {
	const pathname = usePathname();
	const segment = href.split("/").filter(Boolean).at(-1);
	const current = Boolean(segment) && pathname.split("/").filter(Boolean).at(-1) === segment;

	return (
		<LinkWithChannel
			href={href}
			aria-current={current ? "page" : undefined}
			className={cn(
				"relative flex h-full items-center px-2 text-sm font-medium whitespace-nowrap transition-colors xl:px-3 xl:text-[0.9375rem]",
				"after:bg-brand after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:transition-transform after:duration-200 xl:after:inset-x-3",
				"hover:text-brand hover:after:scale-x-100",
				// The focus ring drawn INSIDE the link: the category row clips at its own height
				// (`NavOverflowRow`), and the global ring, 2px outside the box, lost its top and bottom.
				"focus-visible:-outline-offset-2",
				current ? "text-brand after:scale-x-100" : "text-text-primary",
				className,
			)}
		>
			{children}
		</LinkWithChannel>
	);
}
