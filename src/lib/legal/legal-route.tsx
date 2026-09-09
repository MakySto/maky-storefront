import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { type ReactNode } from "react";
import { formatPageTitle } from "@/config/brand";
import { marketHref } from "@/lib/channel-map";
import { LegalPage } from "@/ui/components/legal/legal-page";
import { legalLocaleFor, type LegalLocale } from "./locale";

/**
 * A static legal/content page that exists in more than one language.
 *
 * Mirrors `cmsPageRoute` on purpose — same shape, same three-outcome split, same
 * agreement between `generateMetadata` and the page component. What it removes is the
 * copy-paste that a second language would otherwise multiply: the market gate, the
 * canonical, the `notFound()` for markets with no approved copy, and the rule that
 * metadata and body must never disagree about which language they are in.
 *
 * The body receives `channel` because internal links go through `marketHref`, so a link
 * written once resolves to `/sk/...` or `/cz/...` by itself. Hardcoding `/sk/` in a body
 * would send a Czech reader to the Slovak page, and nothing would catch it.
 */
export interface LegalCopy {
	/**
	 * The `<title>`, and the `<h1>` when `heading` is absent.
	 *
	 * These started as one string because for Slovak and Czech they genuinely are one.
	 * They are not always: the delivered market packages give an `<h1>` and an SEO title
	 * separately, and several pages differ — Polish shipping is `Dostawa i płatności` on
	 * the page and `Dostawa i płatności – Polska` in the tab, because the market
	 * qualifier earns its place in a search result and is noise above the text.
	 */
	readonly title: string;
	/**
	 * The `<h1>`, when it differs from the `<title>`. Optional on purpose.
	 *
	 * Omitting it keeps the previous behaviour exactly — `heading ?? title` — so every
	 * page that had one string still renders that one string, and no existing market's
	 * output moves. Set it only where the delivered copy really does distinguish the two;
	 * inventing a third wording for a page would be worse than having one.
	 */
	readonly heading?: string;
	readonly description: string;
	readonly Body: (props: { channel: string }) => ReactNode;
}

export interface LegalRouteOptions {
	/** Path under the market prefix, leading slash — used for the canonical. */
	readonly path: string;
	/** One entry per language this page is approved in. */
	readonly copy: Readonly<Record<LegalLocale, LegalCopy>>;
}

export function legalRoute({ path, copy }: LegalRouteOptions) {
	async function resolve(params: Promise<{ channel: string }>) {
		const { channel } = await params;
		const locale = legalLocaleFor(channel);
		return { channel, locale, copy: locale ? copy[locale] : null };
	}

	return {
		async generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
			const { channel, copy: resolved } = await resolve(props.params);

			// A market with no approved copy 404s below; the metadata must agree, or the
			// 404 acquires a canonical and an indexable title.
			if (!resolved) return { robots: { index: false, follow: false } };

			return {
				title: formatPageTitle(resolved.title),
				description: resolved.description,
				alternates: { canonical: marketHref(channel, path) },
			};
		},

		async Page(props: { params: Promise<{ channel: string }> }) {
			const { channel, copy: resolved } = await resolve(props.params);
			if (!resolved) notFound();

			const { Body } = resolved;
			return (
				<LegalPage title={resolved.heading ?? resolved.title}>
					<Body channel={channel} />
				</LegalPage>
			);
		},
	};
}
