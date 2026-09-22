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
	// The locale is a PROP, not request state. This subtree renders on the dynamic path
	// (it reads a cookie or searchParams), where `setRequestLocale` from the market layout
	// is not guaranteed to be in scope — and `i18n/request.ts` answers a missing request
	// locale with DEFAULT_LOCALE, which is Slovak. That is how a German page comes to hold
	// a Slovak label next to a German one. Asking with the locale we were handed cannot
	// drift, whatever the render path.
	const t = await getTranslations({ locale, namespace: "product" });

	const rows = attributes
		.map((attribute) => ({
			label: attribute.attribute.name ?? "",
			values: formatProductAttributeValue(attribute, locale),
		}))
		.filter((row) => row.label && row.values.length > 0);

	const outerDimensions = formatOuterDimensions(attributes, locale);
	const hasDescription = Boolean(descriptionHtml?.length || careInstructions);
	const hasTechnicalParameters = rows.length > 0 || Boolean(outerDimensions);

	if (!hasDescription && !hasTechnicalParameters) return null;

	return (
		<section className="border-border-subtle mt-14 border-t pt-10 lg:mt-20 lg:pt-12">
			{/* Jump links only when there are two sections to choose between. With one, the
			    card sat directly above the section it pointed at and read as a collapsed
			    accordion of the same name. */}
			{hasDescription && hasTechnicalParameters && (
				<nav aria-label={t("productDetails")}>
					<ul className="grid gap-3 sm:grid-cols-2">
						{hasDescription && (
							<li>
								<a
									href="#product-description"
									className="border-border-default bg-surface-card text-text-primary hover:border-action-primary hover:bg-surface-muted focus-visible:ring-focus-ring flex min-h-14 items-center justify-between rounded-md border px-5 py-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
								>
									{t("description")}
									<span aria-hidden className="text-text-tertiary text-lg leading-none">
										↓
									</span>
								</a>
							</li>
						)}
						{hasTechnicalParameters && (
							<li>
								<a
									href="#technical-parameters"
									className="border-border-default bg-surface-card text-text-primary hover:border-action-primary hover:bg-surface-muted focus-visible:ring-focus-ring flex min-h-14 items-center justify-between rounded-md border px-5 py-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
								>
									{t("technicalParameters")}
									<span aria-hidden className="text-text-tertiary text-lg leading-none">
										↓
									</span>
								</a>
							</li>
						)}
					</ul>
				</nav>
			)}

			<div className="mt-6 space-y-6 lg:mt-8">
				{hasDescription && (
					<article
						id="product-description"
						aria-labelledby="product-description-heading"
						className="border-border-subtle bg-surface-card scroll-mt-28 rounded-lg border p-5 sm:p-7 lg:p-9"
					>
						<h2
							id="product-description-heading"
							className="text-text-primary mb-6 text-2xl font-semibold tracking-tight"
						>
							{t("description")}
						</h2>
						{descriptionHtml?.length ? (
							<div className="prose text-text-secondary prose-headings:text-text-primary prose-p:text-text-secondary prose-a:text-text-link prose-strong:text-text-primary prose-li:text-text-secondary max-w-none leading-relaxed">
								{descriptionHtml.map((html) => (
									<div key={html} dangerouslySetInnerHTML={{ __html: html }} />
								))}
							</div>
						) : null}

						{careInstructions && (
							<div className="border-border-subtle bg-surface-muted mt-8 rounded-md border p-4 sm:p-5">
								<h3 className="text-text-primary mb-2 font-semibold">{t("careInstructions")}</h3>
								<p className="text-text-secondary leading-relaxed">{careInstructions}</p>
							</div>
						)}
					</article>
				)}

				{hasTechnicalParameters && (
					<section
						id="technical-parameters"
						aria-labelledby="technical-parameters-heading"
						className="border-border-subtle bg-surface-card scroll-mt-28 rounded-lg border p-5 sm:p-7 lg:p-9"
					>
						<h2
							id="technical-parameters-heading"
							className="text-text-primary mb-6 text-2xl font-semibold tracking-tight"
						>
							{t("technicalParameters")}
						</h2>
						<dl className="grid gap-x-10 text-sm sm:grid-cols-2">
							{outerDimensions && (
								<SpecRow label={t("outerDimensions")} values={[outerDimensions]} emphasised />
							)}
							{rows.map((row) => (
								<SpecRow key={row.label} label={row.label} values={row.values} />
							))}
						</dl>
					</section>
				)}
			</div>
		</section>
	);
}

function SpecRow({ label, values, emphasised }: { label: string; values: string[]; emphasised?: boolean }) {
	return (
		<div
			className={
				"border-border-subtle grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5 border-b py-3.5" +
				(emphasised ? " bg-surface-secondary -mx-3 rounded-sm px-3" : "")
			}
		>
			<dt className="text-text-secondary break-words">{label}</dt>
			<dd className="text-text-primary text-right font-medium break-words tabular-nums">
				{values.join(", ")}
			</dd>
		</div>
	);
}
