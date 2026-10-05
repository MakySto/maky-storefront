import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { ComparisonScrollToCurrent } from "./comparison-scroll";

import {
	formatOuterDimensions,
	formatProductAttributeValue,
	formatTemperatureRange,
	type AttributeInput,
} from "@/lib/product-attributes";
import {
	groupParameters,
	templateFor,
	TEMPERATURE_RANGE_REF,
	type PageSections,
	type ParameterRow,
	type ProductTemplate,
} from "@/lib/product-templates";

interface ProductSpecsProps {
	/** The blocks of the description that stay in its card. */
	descriptionHtml?: string[] | null;
	/** The model comparison, when the page's template sets it in a card of its own. */
	comparisonHtml?: PageSections["comparison"];
	/** The documents, when the page's template sets them in a card of their own. */
	documents?: PageSections["documents"];
	/** The description's own parameter sheet, when the page's template sets it in a card of its own. */
	specs?: PageSections["specs"];
	/** How this kind of product is put together; the generic page when it is not given. */
	template?: ProductTemplate;
	attributes: readonly AttributeInput[];
	careInstructions?: string | null;
	locale: string;
	/** A photo from the product's own gallery for beside the description, or none. */
	image?: { url: string; alt: string } | null;
}

/**
 * The description's typography, as the approved page sets it: the first paragraph is the lead —
 * larger and in the text colour. The HTML is Saleor's (one `<div>` per EditorJS block), so the
 * styling reaches into it by structure.
 *
 * Lists are plain, with a quiet brown bullet (third pass, 2026-09-24). They used to be green
 * ticks, one per item, and a supplier's list holds anything: the product's advantages, but also
 * the contents of the box, dimensions, and "check the fastening before every journey" — a green
 * tick on a warning reads as a promise. Nothing in the data says which list is which, and
 * guessing it from a heading's wording in twelve languages would be worse than no ticks.
 */
const DESCRIPTION_PROSE = cn(
	"prose text-text-secondary max-w-none leading-relaxed",
	"prose-headings:text-text-primary prose-headings:tracking-[-0.01em] prose-p:text-text-secondary prose-a:text-text-link prose-strong:text-text-primary prose-li:text-text-secondary",
	"[&>div:first-child>p:first-child]:text-text-primary [&>div:first-child>p:first-child]:text-[1.0625rem] [&>div:first-child>p:first-child]:font-medium sm:[&>div:first-child>p:first-child]:text-lg",
	"prose-ul:pl-5 prose-li:my-1 prose-li:marker:text-brand",
);

/** The scrolling box `parseEditorJSToHtml` puts around a model comparison table. */
const COMPARISON_REGION_CLASS = "maky-cmp-scroll";

/** A value longer than this reads as a sentence: it gets the row's full width, left-aligned. */
const LONG_VALUE = 32;

/** One card of the page: the description, the comparison, the parameters, the documents. */
const CARD =
	"border-border-subtle bg-surface-card scroll-mt-[calc(var(--header-offset)+1rem)] rounded-sm border p-5 shadow-xs sm:p-8 lg:p-10";
const CARD_TITLE = "text-text-primary mb-5 text-2xl font-extrabold tracking-[-0.025em] sm:text-[1.875rem]";

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
	comparisonHtml = null,
	documents = null,
	specs = null,
	template = templateFor(null),
	attributes,
	careInstructions,
	locale,
	image = null,
}: ProductSpecsProps) {
	// The locale is a PROP, not request state. This subtree renders on the dynamic path
	// (it reads a cookie or searchParams), where `setRequestLocale` from the market layout
	// is not guaranteed to be in scope — and `i18n/request.ts` answers a missing request
	// locale with DEFAULT_LOCALE, which is Slovak. That is how a German page comes to hold
	// a Slovak label next to a German one. Asking with the locale we were handed cannot
	// drift, whatever the render path.
	const t = await getTranslations({ locale, namespace: "product" });
	const words = { yes: t("yes"), no: t("no") };
	const years = (count: number) => t("content.years", { count });

	const attributeRows: ParameterRow[] = attributes
		.map((attribute) => ({
			ref: attribute.attribute.externalReference ?? "",
			label: attribute.attribute.name ?? "",
			// The row prints the attribute's name beside its values, so a name that already says the unit
			// ("Záruka (roky)") must not get it said a second time.
			values: formatProductAttributeValue(attribute, locale, words, years, { nameBesideValue: true }),
		}))
		.filter((row) => row.label && row.values.length > 0);

	// A template that names the temperature range writes the two ends as one row ("−20 °C až
	// +20 °C"), at the place the first of them stood; with one end missing both stay as they are.
	const range = template.groups.some((group) => group.refs.includes(TEMPERATURE_RANGE_REF))
		? formatTemperatureRange(attributes, locale, (min, max) => t("content.range", { min, max }))
		: null;
	const rows = range
		? withTemperatureRange(attributeRows, range.full, t("content.temperatureRange"))
		: attributeRows;
	const groups = groupParameters(template, rows);

	const outerDimensions = formatOuterDimensions(attributes, locale);
	const hasDescription = Boolean(descriptionHtml?.length || careInstructions);
	const hasAttributeParameters = rows.length > 0 || Boolean(outerDimensions);
	const hasTechnicalParameters = hasAttributeParameters || Boolean(specs);
	const hasComparison = Boolean(comparisonHtml);
	const hasDocuments = Boolean(documents);

	if (!hasDescription && !hasTechnicalParameters && !hasComparison && !hasDocuments) return null;

	// The sections in the order the cards follow each other.
	const sections = [
		hasDescription && { href: "#product-description", label: t("description") },
		hasComparison && { href: "#model-comparison", label: t("content.navComparison") },
		hasTechnicalParameters && { href: "#technical-parameters", label: t("technicalParameters") },
		hasDocuments && { href: "#product-documents", label: t("content.navDocuments") },
	].filter((section): section is { href: string; label: string } => Boolean(section));

	return (
		<section className="mt-10 lg:mt-14">
			{/* The sections this product has, as a row of jump links: one hairline under the row, the
			    current one underlined in brown — not another raised panel. Links, not a tab widget:
			    everything stays on the page and readable without a click, and an empty section never
			    gets a tab. */}
			{sections.length > 1 && (
				<nav aria-label={t("productDetails")} className="border-border-default border-b">
					<ul className="scrollbar-hide -mb-px flex gap-7 overflow-x-auto sm:gap-10">
						{sections.map((section, index) => (
							<li key={section.href}>
								<a
									href={section.href}
									className={cn(
										"hover:text-brand hover:border-brand focus-visible:ring-ring inline-flex h-12 items-center border-b-2 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none sm:text-base",
										// The first section opens under the row, so it reads as the one in view.
										index === 0 ? "text-brand border-brand" : "text-text-primary border-transparent",
									)}
								>
									{section.label}
								</a>
							</li>
						))}
					</ul>
				</nav>
			)}

			{/* The description with the product's photo beside its opening, then the parameters at
			    full width in two columns — the approved page's order. */}
			<div className="mt-5 grid gap-4 lg:mt-6 lg:gap-5">
				{hasDescription && (
					<article
						id="product-description"
						aria-labelledby="product-description-heading"
						className={cn(CARD, "flow-root")}
					>
						{/* The product's own photo floats beside the opening of the description, and the
						    text runs on at full width under it. It used to stand in a sticky column of
						    its own for the description's whole length, which held a long description — a
						    Nordrive set's runs to three screens — to 55% of the page. */}
						{image && (
							<div className="bg-surface-card relative mb-6 ml-10 hidden aspect-[4/3] w-[40%] overflow-hidden rounded-sm xl:float-right xl:block">
								<Image
									src={image.url}
									alt={image.alt}
									fill
									sizes="(min-width: 1440px) 520px, 38vw"
									className="object-contain"
								/>
							</div>
						)}
						<h2 id="product-description-heading" className={CARD_TITLE}>
							{t("productDescription")}
						</h2>
						{descriptionHtml?.length ? (
							<div className={DESCRIPTION_PROSE}>
								{descriptionHtml.map((html) => (
									<div key={html} dangerouslySetInnerHTML={{ __html: html }} />
								))}
							</div>
						) : null}
						{/* Only a description with a model comparison ships the few lines that start its
						    scrolling table at the current model. */}
						{descriptionHtml?.some((html) => html.includes(COMPARISON_REGION_CLASS)) && (
							<ComparisonScrollToCurrent />
						)}

						{careInstructions && (
							<div className="border-border-subtle bg-surface-secondary mt-8 rounded-xs border p-4 sm:p-5">
								<h3 className="text-text-primary mb-2 font-semibold">{t("careInstructions")}</h3>
								<p className="text-text-secondary leading-relaxed">{careInstructions}</p>
							</div>
						)}
					</article>
				)}

				{/* The model comparison, in a card of its own when the template says so. The table is the
				    description's block, set by the same renderer; only where it stands differs. */}
				{comparisonHtml && (
					<article id="model-comparison" aria-label={t("content.navComparison")} className={CARD}>
						<div
							className="[&_.maky-cmp]:mt-0 [&_.maky-cmp]:mb-0"
							dangerouslySetInnerHTML={{ __html: comparisonHtml }}
						/>
						<ComparisonScrollToCurrent />
					</article>
				)}

				{hasTechnicalParameters && (
					<section id="technical-parameters" aria-labelledby="technical-parameters-heading" className={CARD}>
						{specs?.title ? (
							<h2
								id="technical-parameters-heading"
								className={CARD_TITLE}
								dangerouslySetInnerHTML={{ __html: specs.title }}
							/>
						) : (
							<h2 id="technical-parameters-heading" className={CARD_TITLE}>
								{t("technicalParameters")}
							</h2>
						)}
						{/* The description's own parameter sheet, when the template lifts it: the block the
						    reader drew, only where it stands differs. `maky-blk` is the box its columns are
						    measured against. */}
						{specs && <div className="maky-blk mt-0" dangerouslySetInnerHTML={{ __html: specs.body }} />}
						{hasAttributeParameters && groups ? (
							/* The template's groups: one definition list each, titled, in the sheet's two
							   columns that read down. */
							<div className="maky-specs">
								{groups.map((group, index) => (
									<section key={group.id} className="maky-sg">
										<h3 className="maky-sg-t">{t(`content.groups.${group.id}`)}</h3>
										<dl>
											{index === 0 && outerDimensions && (
												<SpecRow label={t("outerDimensions")} values={[outerDimensions]} emphasised grouped />
											)}
											{group.rows.map((row) => (
												<SpecRow key={row.ref || row.label} label={row.label} values={row.values} grouped />
											))}
										</dl>
									</section>
								))}
							</div>
						) : hasAttributeParameters ? (
							/* Two columns that read DOWN, each a list of its own with a rule between them — not
							   a grid read across in zig-zag pairs. */
							<dl className="text-sm sm:text-[0.9375rem] lg:columns-2 lg:gap-x-14 lg:[column-rule:1px_solid_var(--border-subtle)]">
								{outerDimensions && (
									<SpecRow label={t("outerDimensions")} values={[outerDimensions]} emphasised />
								)}
								{rows.map((row) => (
									<SpecRow key={row.label} label={row.label} values={row.values} />
								))}
							</dl>
						) : null}
					</section>
				)}

				{documents && (
					<article id="product-documents" aria-labelledby="product-documents-heading" className={CARD}>
						{documents.title ? (
							<h2
								id="product-documents-heading"
								className={CARD_TITLE}
								dangerouslySetInnerHTML={{ __html: documents.title }}
							/>
						) : (
							<h2 id="product-documents-heading" className={CARD_TITLE}>
								{t("content.navDocuments")}
							</h2>
						)}
						{/* `maky-blk` is the box the documents' columns are measured against. */}
						<div className="maky-blk mt-0" dangerouslySetInnerHTML={{ __html: documents.body }} />
					</article>
				)}
			</div>
		</section>
	);
}

/**
 * The two ends of the temperature range as one row, at the place the first of them stood.
 * Without both ends the rows are returned as they were.
 */
function withTemperatureRange(rows: ParameterRow[], value: string, label: string): ParameterRow[] {
	const ends = new Set(["cfm:attribute:temperature_min", "cfm:attribute:temperature_max"]);
	const first = rows.findIndex((row) => ends.has(row.ref));
	if (first === -1) return rows;
	const merged: ParameterRow = { ref: TEMPERATURE_RANGE_REF, label, values: [value] };
	return rows.flatMap((row, index) => (index === first ? [merged] : ends.has(row.ref) ? [] : [row]));
}

function SpecRow({
	label,
	values,
	emphasised,
	grouped,
}: {
	label: string;
	values: string[];
	emphasised?: boolean;
	/** A row of a template's group: the shared sheet's own classes (`brand.css`), not the flat list's. */
	grouped?: boolean;
}) {
	const value = values.join(", ");
	// A short value — a number, a unit, "Áno" — sits at the row's right edge, where a column of
	// them can be scanned. A sentence ("max. šírka kolies 80 mm vzdialenosť…") was squeezed into
	// the right half, right-aligned; it gets the row's width and reads from the left.
	const long = value.length > LONG_VALUE;
	if (grouped) {
		return (
			<div
				className={cn(
					"maky-sr",
					long && "maky-sr-long",
					emphasised && "bg-surface-secondary -mx-3 rounded-xs px-3",
				)}
			>
				<dt>{label}</dt>
				<dd>{value}</dd>
			</div>
		);
	}
	return (
		<div
			className={cn(
				"border-border-subtle break-inside-avoid border-b py-3.5",
				long ? "grid gap-1" : "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5",
				emphasised && "bg-surface-secondary -mx-3 rounded-xs px-3",
			)}
		>
			<dt className="text-text-secondary break-words">{label}</dt>
			<dd
				className={cn(
					"text-text-primary font-semibold break-words tabular-nums",
					long ? "text-left leading-relaxed" : "text-right",
				)}
			>
				{value}
			</dd>
		</div>
	);
}
