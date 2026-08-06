import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import edjsHTML from "editorjs-html";
import xss from "xss";
import { cacheLife, cacheTag } from "next/cache";
import { PageGetBySlugDocument, type PageGetBySlugQuery } from "@/gql/graphql";
import { executePublicGraphQL } from "@/lib/graphql";
import {
	catchUpstreamError,
	logUpstreamError,
	refuseToCacheUpstreamError,
	toOutcome,
	type AuthoritativeOutcome,
	type ResourceOutcome,
} from "@/lib/saleor/resource-outcome";
import { buildPageMetadata } from "@/lib/seo";
import { marketHref } from "@/lib/channel-map";

const parser = edjsHTML();

type SaleorPage = NonNullable<PageGetBySlugQuery["page"]>;

/**
 * One resolver for the page and its metadata.
 *
 * They used to issue two independent, uncached `executePublicGraphQL` calls —
 * the highest drift risk in the app. Straddle a revalidation or a transient
 * failure and they disagree: the metadata says the page exists while the body
 * 404s, or the reverse, which is exactly how a soft 404 acquires a
 * self-canonical. `src/lib/cms/page-route.tsx` was built to make that
 * structurally impossible for the Payload routes; this does the same here.
 *
 * `page(slug:)` takes no channel argument, so a Saleor page is global — the
 * cache key deliberately carries no channel either.
 */
async function getSaleorPageCached(slug: string): Promise<AuthoritativeOutcome<SaleorPage>> {
	"use cache";
	cacheLife("minutes");
	cacheTag(`saleor-page:${slug}`);

	const result = await executePublicGraphQL(PageGetBySlugDocument, {
		variables: { slug },
		revalidate: 60,
	});

	return refuseToCacheUpstreamError(toOutcome(result, (data) => data.page));
}

async function getSaleorPage(slug: string): Promise<ResourceOutcome<SaleorPage>> {
	return catchUpstreamError(() => getSaleorPageCached(slug));
}

export const generateMetadata = async (props: {
	params: Promise<{ slug: string; channel: string }>;
}): Promise<Metadata> => {
	const params = await props.params;
	const outcome = await getSaleorPage(params.slug);

	if (outcome.status === "upstream-error") {
		// Could not verify. `noindex`, no canonical, and no "not found" title.
		return { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };
	}

	if (outcome.status === "not-found") {
		// Streaming/PPR can't set a 404 status after the shell is flushed, so the
		// noindex robots meta is the only crawler-visible not-found signal here
		// until the proxy gate lands.
		const t = await getTranslations("pages");
		return {
			title: t("notFound"),
			robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
		};
	}

	const page = outcome.resource;

	return buildPageMetadata({
		title: page.seoTitle || page.title,
		description: page.seoDescription || page.seoTitle || page.title,
		url: marketHref(params.channel, `/pages/${encodeURIComponent(params.slug)}`),
	});
};

export default async function Page(props: { params: Promise<{ slug: string }> }) {
	const params = await props.params;
	const outcome = await getSaleorPage(params.slug);

	// `!result.ok || !page` used to fold a Saleor outage into the same branch as
	// a genuinely missing page, so a blip rendered "not found" over a live one.
	if (outcome.status === "upstream-error") {
		logUpstreamError("saleor-page", outcome, { slug: params.slug });
		throw new Error(`page lookup failed for ${params.slug}: ${outcome.message}`);
	}

	if (outcome.status === "not-found") {
		notFound();
	}

	const { title, content } = outcome.resource;

	const contentHtml = content ? parser.parse(JSON.parse(content)) : null;

	return (
		<div className="mx-auto max-w-7xl p-8 pb-16">
			<h1 className="text-3xl font-semibold">{title}</h1>
			{contentHtml && (
				<div className="prose">
					{contentHtml.map((content) => (
						<div key={content} dangerouslySetInnerHTML={{ __html: xss(content) }} />
					))}
				</div>
			)}
		</div>
	);
}
