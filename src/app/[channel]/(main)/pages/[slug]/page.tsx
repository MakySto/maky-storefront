import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import edjsHTML from "editorjs-html";
import xss from "xss";
import { PageGetBySlugDocument } from "@/gql/graphql";
import { executePublicGraphQL } from "@/lib/graphql";
import { buildPageMetadata } from "@/lib/seo";
import { marketHref } from "@/lib/channel-map";

const parser = edjsHTML();

export const generateMetadata = async (props: {
	params: Promise<{ slug: string; channel: string }>;
}): Promise<Metadata> => {
	const params = await props.params;
	const result = await executePublicGraphQL(PageGetBySlugDocument, {
		variables: { slug: params.slug },
		revalidate: 60,
	});

	const page = result.ok ? result.data.page : null;

	if (!page) {
		// Streaming/PPR can't set a 404 status after the shell is flushed, so the
		// noindex robots meta is the only crawler-visible not-found signal here.
		const t = await getTranslations("pages");
		return {
			title: t("notFound"),
			robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
		};
	}

	return buildPageMetadata({
		title: page.seoTitle || page.title,
		description: page.seoDescription || page.seoTitle || page.title,
		url: marketHref(params.channel, `/pages/${encodeURIComponent(params.slug)}`),
	});
};

export default async function Page(props: { params: Promise<{ slug: string }> }) {
	const params = await props.params;
	const result = await executePublicGraphQL(PageGetBySlugDocument, {
		variables: { slug: params.slug },
		revalidate: 60,
	});

	if (!result.ok || !result.data.page) {
		notFound();
	}

	const page = result.data.page;

	const { title, content } = page;

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
