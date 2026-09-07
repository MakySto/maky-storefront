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
	readonly title: string;
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
				<LegalPage title={resolved.title}>
					<Body channel={channel} />
				</LegalPage>
			);
		},
	};
}
