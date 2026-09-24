import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

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
	const words = { yes: t("yes"), no: t("no") };

	const rows = attributes
		.map((attribute) => ({
			label: attribute.attribute.name ?? "",
			values: formatProductAttributeValue(attribute, locale, words),
		}))
		.filter((row) => row.label && row.values.length > 0);

	const outerDimensions = formatOuterDimensions(attributes, locale);
	const hasDescription = Boolean(descriptionHtml?.length || careInstructions);
	const hasTechnicalParameters = rows.length > 0 || Boolean(outerDimensions);

	if (!hasDescription && !hasTechnicalParameters) return null;

	const sections = [
		hasDescription && { href: "#product-description", label: t("description") },
		hasTechnicalParameters && { href: "#technical-parameters", label: t("technicalParameters") },
	].filter((section): section is { href: string; label: string } => Boolean(section));

	return (
		<section className="mt-10 lg:mt-14">
			{/* The sections this product has, as a row of jump links in the approved design's tab
			    style. Links, not a tab widget: everything stays on the page and readable without
			    a click, and an empty section never gets a tab. */}
			{sections.length > 1 && (
				<nav aria-label={t("productDetails")} className="border-border-default border-b">
					<ul className="scrollbar-hide -mb-px flex gap-6 overflow-x-auto sm:gap-8">
						{sections.map((section) => (
							<li key={section.href}>
								<a
									href={section.href}
									className="text-text-secondary hover:text-text-primary hover:border-brand focus-visible:ring-ring inline-flex h-12 items-center border-b-2 border-transparent text-[0.9375rem] font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none"
								>
									{section.label}
								</a>
							</li>
						))}
					</ul>
				</nav>
			)}

			{/* On a wide screen the parameters stand beside the description instead of under it —
			    the description reads at a comfortable measure and the space beside it is used. */}
			<div
				className={cn(
					"mt-6 grid gap-6 lg:mt-8",
					hasDescription &&
						hasTechnicalParameters &&
						"xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:items-start",
				)}
			>
				{hasDescription && (
					<article
						id="product-description"
						aria-labelledby="product-description-heading"
						className="border-border-subtle bg-surface-card scroll-mt-40 rounded-sm border p-5 shadow-xs sm:p-8 lg:p-10"
					>
						<h2
							id="product-description-heading"
							className="text-text-primary mb-5 text-2xl font-bold tracking-[-0.02em] sm:text-[1.75rem]"
						>
							{t("productDescription")}
						</h2>
						{descriptionHtml?.length ? (
							<div className="prose text-text-secondary prose-headings:text-text-primary prose-headings:tracking-[-0.01em] prose-p:text-text-secondary prose-a:text-text-link prose-strong:text-text-primary prose-li:text-text-secondary prose-li:marker:text-cta max-w-3xl leading-relaxed">
								{descriptionHtml.map((html) => (
									<div key={html} dangerouslySetInnerHTML={{ __html: html }} />
								))}
							</div>
						) : null}

						{careInstructions && (
							<div className="border-border-subtle bg-surface-secondary mt-8 max-w-3xl rounded-xs border p-4 sm:p-5">
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
						className="border-border-subtle bg-surface-card scroll-mt-40 rounded-sm border p-5 shadow-xs sm:p-8 lg:p-10"
					>
						<h2
							id="technical-parameters-heading"
							className="text-text-primary mb-5 text-2xl font-bold tracking-[-0.02em] sm:text-[1.75rem]"
						>
							{t("technicalParameters")}
						</h2>
						<dl
							className={cn(
								"grid text-sm sm:text-[0.9375rem]",
								// Two columns across the full width; one beside the description.
								hasDescription ? "lg:grid-cols-2 lg:gap-x-12 xl:grid-cols-1" : "lg:grid-cols-2 lg:gap-x-12",
							)}
						>
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
				(emphasised ? " bg-surface-secondary -mx-3 rounded-xs px-3" : "")
			}
		>
			<dt className="text-text-secondary break-words">{label}</dt>
			<dd className="text-text-primary text-right font-semibold break-words tabular-nums">
				{values.join(", ")}
			</dd>
		</div>
	);
}
