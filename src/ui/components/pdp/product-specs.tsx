import { getTranslations } from "next-intl/server";

import {
	formatOuterDimensions,
	formatProductAttributeValue,
	type AttributeInput,
} from "@/lib/product-attributes";

interface ProductSpecsProps {
	descriptionHtml?: string[] | null;
	attributes: readonly AttributeInput[];
	careInstructions?: string | null;
	locale: string;
}

/**
 * Description and technical parameters, full width below the hero.
 *
 * These used to sit in the right-hand column beside the gallery, which is what
 * produced the dead area on desktop: fifteen parameter rows in a half-width
 * column ran far past the bottom of the image while the left half stayed empty.
 * Full width also lets the parameters run as two columns of a definition list
 * instead of one long ladder.
 *
 * A server component on purpose — this is static content and needs no client
 * bundle. No accordion either: specifications are the reason a customer scrolls
 * this far, so they are not hidden behind a click.
 */
export async function ProductSpecs({
	descriptionHtml,
	attributes,
	careInstructions,
	locale,
}: ProductSpecsProps) {
	const t = await getTranslations("product");

	const rows = attributes
		.map((attribute) => ({
			label: attribute.attribute.name ?? "",
			values: formatProductAttributeValue(attribute, locale),
		}))
		.filter((row) => row.label && row.values.length > 0);

	const outerDimensions = formatOuterDimensions(attributes, locale);
	const hasDescription = Boolean(descriptionHtml && descriptionHtml.length > 0);

	if (!hasDescription && rows.length === 0) return null;

	return (
		<section className="border-border-subtle mt-14 border-t pt-12 lg:mt-20">
			<div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
				{hasDescription && (
					<div>
						<h2 className="text-text-primary mb-5 text-xl font-semibold tracking-tight">
							{t("description")}
						</h2>
						<div className="prose prose-sm text-text-secondary prose-headings:text-text-primary prose-p:text-text-secondary prose-a:text-text-link prose-strong:text-text-primary max-w-none leading-relaxed">
							{descriptionHtml?.map((html) => <div key={html} dangerouslySetInnerHTML={{ __html: html }} />)}
						</div>

						{careInstructions && (
							<div className="mt-8">
								<h3 className="text-text-primary mb-2 text-sm font-semibold">{t("careInstructions")}</h3>
								<p className="text-text-secondary text-sm leading-relaxed">{careInstructions}</p>
							</div>
						)}
					</div>
				)}

				{rows.length > 0 && (
					<div>
						<h2 className="text-text-primary mb-5 text-xl font-semibold tracking-tight">
							{t("technicalParameters")}
						</h2>
						<dl className="text-sm">
							{outerDimensions && (
								<SpecRow label={t("outerDimensions")} values={[outerDimensions]} emphasised />
							)}
							{rows.map((row) => (
								<SpecRow key={row.label} label={row.label} values={row.values} />
							))}
						</dl>
					</div>
				)}
			</div>
		</section>
	);
}

function SpecRow({ label, values, emphasised }: { label: string; values: string[]; emphasised?: boolean }) {
	return (
		<div
			className={
				"border-border-subtle flex items-baseline justify-between gap-6 border-b py-2.5 last:border-b-0" +
				(emphasised ? " bg-surface-secondary -mx-3 rounded-sm px-3" : "")
			}
		>
			<dt className="text-text-secondary">{label}</dt>
			<dd className="text-text-primary text-right font-medium tabular-nums">{values.join(", ")}</dd>
		</div>
	);
}
