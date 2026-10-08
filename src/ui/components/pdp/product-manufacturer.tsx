import { getTranslations } from "next-intl/server";
import { getLocaleFromChannel } from "@/config/locale";
import { manufacturerOf } from "@/lib/manufacturers";
import { cn } from "@/lib/utils";

/** The product's brand, as CFM publishes it: the `manufacturer` attribute (`lib/brands/catalog`). */
const MANUFACTURER_REF = "cfm:attribute:manufacturer";

type Attributes = readonly {
	attribute: { externalReference?: string | null };
	values: readonly { slug?: string | null }[];
}[];

/**
 * Who makes the product: the company's name, its postal address and an e-mail address, under the
 * parameters and the description.
 *
 * A product offered to consumers in the EU has to say it where it is offered (`lib/manufacturers`).
 * The block is drawn for a brand the shop has the details of and for no other: a product of any other
 * brand, or with none, has no block rather than a blank one. It is the same in every market; the
 * heading and the country are written in the market's language, the company's name and address as the
 * company writes them.
 */
export async function ProductManufacturer({
	attributes,
	channel,
	className,
}: {
	attributes: Attributes;
	channel: string;
	className?: string;
}) {
	const brand = attributes.find(({ attribute }) => attribute.externalReference === MANUFACTURER_REF)
		?.values[0]?.slug;
	const manufacturer = manufacturerOf(brand);
	if (!manufacturer) return null;

	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "product" });
	const country =
		new Intl.DisplayNames([locale], { type: "region" }).of(manufacturer.country) ?? manufacturer.country;

	return (
		<section
			aria-labelledby="product-manufacturer"
			className={cn(
				"border-border-subtle bg-surface-card rounded-sm border p-5 shadow-xs sm:px-8 sm:py-6 lg:px-10",
				className,
			)}
		>
			<h2 id="product-manufacturer" className="text-text-primary text-lg font-bold tracking-[-0.01em]">
				{t("manufacturerHeading")}
			</h2>
			<address className="text-text-secondary mt-3 text-sm leading-relaxed break-words not-italic">
				<span className="text-text-primary font-semibold">{manufacturer.name}</span>
				<br />
				{manufacturer.street}
				<br />
				{manufacturer.town}
				<br />
				{country}
				<br />
				<a
					href={`mailto:${manufacturer.email}`}
					className="text-text-link decoration-text-link/40 hover:decoration-text-link underline underline-offset-4 transition-colors"
				>
					{manufacturer.email}
				</a>
			</address>
		</section>
	);
}
