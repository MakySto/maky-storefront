import { buildOrganizationJsonLd, buildWebSiteJsonLd, jsonLdScriptProps } from "@/lib/seo";

/**
 * The shop's own structured data: one `OnlineStore` and one `WebSite`, on every market
 * homepage.
 *
 * The homepage is where Google looks for Organization markup, and the only page that
 * carries it — product pages refer to the same node by `@id` (`offers.seller`) instead of
 * repeating it. Two separate blocks rather than one `@graph`, so each reads on its own in the
 * Rich Results Test and a test can count them.
 *
 * Takes the params promise and awaits it itself, like the featured-products section, so
 * the page component stays synchronous.
 */
export async function HomepageStructuredData({ params }: { params: Promise<{ channel: string }> }) {
	const { channel } = await params;
	const organization = jsonLdScriptProps(buildOrganizationJsonLd(channel));
	const website = jsonLdScriptProps(buildWebSiteJsonLd(channel));

	return (
		<>
			{organization && <script {...organization} />}
			{website && <script {...website} />}
		</>
	);
}
