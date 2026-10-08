/**
 * Who makes the products of a brand, for the product page.
 *
 * A product offered to consumers in the EU has to name its manufacturer where it is offered: the name, the
 * postal address and an electronic address (General Product Safety Regulation, (EU) 2023/988, Article 19).
 * The catalogue does not carry that. Saleor holds the brand of a product (the `manufacturer` attribute,
 * `lib/brands/catalog`), not the company behind it, so the company lives here, keyed by the brand's Saleor slug.
 *
 * A brand with no entry shows no block: nothing is guessed, and a brand is added when its maker's details
 * are in hand. This is the identification of the maker only; it is not a statement that the page meets every
 * other duty of that Article (the product's identification, its warnings and safety information).
 *
 * The register and VAT numbers of a company are not part of it, and are left out on purpose: the owner's
 * source gave two different register numbers for the same company (2026-10-08), and the Article asks for a
 * name and two addresses.
 */
export interface Manufacturer {
	/** The company's name as its own terms of sale give it. */
	readonly name: string;
	readonly street: string;
	/** Postal code and town, in the order the country writes them. */
	readonly town: string;
	/** ISO 3166-1 alpha-2. The page writes the country in the market's own language. */
	readonly country: string;
	/** An electronic address at which the maker can be reached. */
	readonly email: string;
}

/**
 * Tradekar Benelux B.V., Culemborg, the Netherlands: the company behind the PRO-USER and Spinder brands (it
 * also trades as Enduro technology, Cover-it and ETM-TEC). The details are from its own terms of sale,
 * pro-user.com/en/terms-and-conditions, and were sent by the owner on 2026-10-08.
 */
const TRADEKAR: Manufacturer = {
	name: "Tradekar Benelux B.V.",
	street: "Ohmweg 1",
	town: "4140 BM Culemborg",
	country: "NL",
	email: "service@tradekar.com",
};

/** By the brand's Saleor slug, as `lib/brands/catalog` names the makers. A `Map`, so that no slug can reach a prototype. */
const BY_BRAND: ReadonlyMap<string, Manufacturer> = new Map([
	["pro-user", TRADEKAR],
	["spinder", TRADEKAR],
]);

/** The maker of a brand's products, or `null` where the shop does not hold the details. */
export function manufacturerOf(brandSlug: string | null | undefined): Manufacturer | null {
	return (brandSlug ? BY_BRAND.get(brandSlug) : undefined) ?? null;
}
