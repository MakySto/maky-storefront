import { type Metadata } from "next";
import { formatPageTitle } from "@/config/brand";
import { LOCALE_MAP, getLocaleFromChannel } from "@/config/locale";
import { seoConfig, getMetadataBase } from "./config";

/**
 * The generic share card, `src/app/opengraph-image.png`.
 *
 * The one image on the site whose size is known, because it is ours: 1200×630, and the
 * metadata test reads the file to keep that true. Product and CMS images are whatever was
 * uploaded, so they are published without dimensions rather than with this card's.
 */
export const DEFAULT_OG_IMAGE = {
	url: "/opengraph-image.png",
	width: 1200,
	height: 630,
	alt: seoConfig.siteName,
} as const;

/**
 * The Open Graph fields every page of a market shares: type, site name, the market's
 * `og:locale`, the generic share card — and the page's own `og:url` when it has one.
 *
 * One builder because Next replaces `openGraph` WHOLESALE at the deepest segment that
 * declares it; it does not merge field by field. A page that sets `openGraph` for the sake
 * of one field silently drops the rest — which is how every page except the PDP once lost
 * its og:image (see the market layout). The layout and every page that adds an og:url start
 * from this, so none of them can forget a field.
 *
 * `channel` is the Saleor slug the route params carry (`sk-eur`).
 */
export function marketOpenGraph(channel: string, url?: string) {
	return {
		type: "website" as const,
		siteName: seoConfig.siteName,
		locale: LOCALE_MAP[getLocaleFromChannel(channel)]?.ogLocale,
		images: [DEFAULT_OG_IMAGE],
		...(url ? { url } : {}),
	};
}

/**
 * Root Metadata
 *
 * Default metadata for the entire site.
 * Import and export this from your root layout.tsx
 *
 * @example
 * // In a root layout (src/app/(site)/layout.tsx or src/app/[channel]/layout.tsx)
 * export { rootMetadata as metadata } from "@/lib/seo";
 */
export const rootMetadata: Metadata = {
	// Title configuration
	title: {
		default: seoConfig.siteName,
		template: seoConfig.titleTemplate,
	},
	description: seoConfig.description,

	// Base URL for resolving relative URLs
	metadataBase: getMetadataBase(),

	// OpenGraph defaults
	...(seoConfig.enableOpenGraph && {
		openGraph: {
			type: "website",
			siteName: seoConfig.siteName,
			locale: seoConfig.locale,
			images: [DEFAULT_OG_IMAGE],
		},
	}),

	// Twitter/X card defaults
	...(seoConfig.enableTwitterCards && {
		twitter: {
			card: "summary_large_image",
			...(seoConfig.twitterHandle && {
				site: `@${seoConfig.twitterHandle}`,
				creator: `@${seoConfig.twitterHandle}`,
			}),
		},
	}),

	// Icons - with light/dark mode support
	icons: {
		icon: [
			{
				url: "/android-chrome-192x192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{ url: "/favicon.ico", sizes: "32x32" },
			// Light mode (dark icon on light tabs)
			{
				url: "/favicon-16x16.png",
				sizes: "16x16",
				type: "image/png",
				media: "(prefers-color-scheme: light)",
			},
			{
				url: "/favicon-32x32.png",
				sizes: "32x32",
				type: "image/png",
				media: "(prefers-color-scheme: light)",
			},
			// Dark mode (light icon on dark tabs)
			{
				url: "/favicon-dark-16x16.png",
				sizes: "16x16",
				type: "image/png",
				media: "(prefers-color-scheme: dark)",
			},
			{
				url: "/favicon-dark-32x32.png",
				sizes: "32x32",
				type: "image/png",
				media: "(prefers-color-scheme: dark)",
			},
		],
		apple: "/apple-icon.png",
	},

	// Web App Manifest
	manifest: "/site.webmanifest",

	// Crawler configuration
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
};

/**
 * Truncate text to a maximum length at word boundary
 * Used for SEO-friendly titles and descriptions
 */
export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	const truncated = text.slice(0, maxLength);
	const lastSpace = truncated.lastIndexOf(" ");
	return lastSpace > 0 ? truncated.slice(0, lastSpace) + "…" : truncated + "…";
}

/**
 * Build page metadata with OpenGraph and Twitter cards
 *
 * @example
 * export async function generateMetadata(): Promise<Metadata> {
 *   const product = await getProduct(slug);
 *   return buildPageMetadata({
 *     channel,
 *     title: product.name,
 *     description: product.description,
 *     image: product.thumbnail?.url,
 *     url: `/products/${slug}`,
 *   });
 * }
 */
export function buildPageMetadata(options: {
	/**
	 * The Saleor channel of the page (`sk-eur`), for `og:locale`. Required, like the locale
	 * `formatPrice` takes: a default would be Slovak, and a German page announcing `sk_SK`
	 * is the same defect in a place nobody looks.
	 */
	channel: string;
	title: string;
	/** Preserve an accepted product SEO title; fallback names keep legacy trim. */
	titleSource?: "seo" | "fallback";
	description?: string;
	/**
	 * The page's own image, when it has one. No dimensions are declared for it — they are
	 * not known — and without one the page falls back to the generic share card instead of
	 * shipping no og:image at all.
	 */
	image?: string | null;
	url?: string;
	/** Additional OpenGraph properties */
	openGraph?: Record<string, string>;
}): Metadata {
	const { channel, title, titleSource = "fallback", description, image, url, openGraph: extraOg } = options;

	// Truncate for optimal display
	const renderedTitle = titleSource === "seo" ? title : truncateText(title, 60);
	const truncatedDescription = description ? truncateText(description, 155) : undefined;

	// The channel (main) layout defines a plain string title, which resets
	// Next's title.template inheritance below it — the brand suffix must be
	// applied here. Saleor seoTitle content may already include the site name,
	// so only append when it is missing. OG/Twitter titles stay unbranded
	// (og:site_name carries the brand).
	const brandedCandidate = formatPageTitle(renderedTitle);
	const brandedTitle = renderedTitle.endsWith(seoConfig.siteName)
		? renderedTitle
		: titleSource === "seo" && brandedCandidate.length > 65
			? renderedTitle
			: brandedCandidate;

	return {
		title: brandedTitle,
		description: truncatedDescription,

		// Canonical URL
		...(url && {
			alternates: {
				canonical: url,
			},
		}),

		// OpenGraph — the market's shared fields, then this page's own. The page image carries
		// no width/height: 1200×630 used to be claimed for every product photo, and only the
		// generic card is that size.
		...(seoConfig.enableOpenGraph && {
			openGraph: {
				...marketOpenGraph(channel, url),
				title: renderedTitle,
				description: truncatedDescription,
				images: image ? [{ url: image, alt: title }] : [DEFAULT_OG_IMAGE],
				...extraOg,
			},
		}),

		// Twitter
		...(seoConfig.enableTwitterCards && {
			twitter: {
				card: "summary_large_image",
				title: renderedTitle,
				description: truncatedDescription,
				images: image ? [image] : undefined,
			},
		}),
	};
}
