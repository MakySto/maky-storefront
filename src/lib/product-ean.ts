/**
 * The EAN a customer is allowed to see, and the GTIN a crawler is allowed to be told.
 *
 * CFM owns the number (`Product.ean`) and publishes it as the public variant metafield `cfm_ean`
 * (CFM repository, `docs/contracts/PUBLIC_VARIANT_METADATA_V1.md`), and only when it can be a real
 * GTIN. This reads it again by the same rule, so a value typed by hand in Saleor is held to it too.
 * The rule is the CFM one, `apps/saleor_sync/gtin.py`; the cases in `product-ean.test.ts` are the
 * ones in `test_gtin.py`, so a number one side shows and the other refuses is a failing test.
 *
 * Printing a barcode on a page, and sending it to a search engine as a GTIN, is a claim about the
 * product. A missing one is a gap a shopper can live with; a wrong one is a claim about another
 * product. So `null` is a real answer here and callers render it as silence.
 *
 * Valid is: ASCII digits only, a GTIN length (8, 12, 13 or 14), a correct GS1 check digit, not all
 * zeros (it passes the check digit and means nothing), and not a restricted circulation number
 * (GS1 prefixes 02, 04 and 20 to 29: for in-store use, not unique across shops, and refused by
 * search engines as a GTIN).
 */

/** The Saleor variant metafield the number is read from. The GraphQL document names it too. */
export const EAN_METAFIELD_KEY = "cfm_ean";

const GTIN_LENGTHS: readonly number[] = [8, 12, 13, 14];

/** GS1 mod-10: from the right, the digits before the check digit weigh 3, 1, 3, 1... */
function checkDigitIsCorrect(digits: string): boolean {
	let total = 0;
	for (let position = 0; position < digits.length - 1; position += 1) {
		const digit = Number(digits[digits.length - 2 - position]);
		total += digit * (position % 2 === 0 ? 3 : 1);
	}
	return (10 - (total % 10)) % 10 === Number(digits[digits.length - 1]);
}

/**
 * A number the company that holds it may give out only inside its own shops. Read in the 13-digit
 * form: a GTIN-12 is that form with a leading zero, a GTIN-14 a packaging indicator in front of one.
 */
function isRestrictedCirculation(digits: string): boolean {
	if (digits.length === 8) return false;
	const thirteen = digits.length === 12 ? `0${digits}` : digits.length === 14 ? digits.slice(1) : digits;
	return thirteen.startsWith("02") || thirteen.startsWith("04") || thirteen.startsWith("2");
}

/** The GTIN as it may be shown and published, or `null` when it may not. */
export function publicGtin(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const text = value.normalize("NFKC").trim();
	if (!/^[0-9]+$/.test(text) || !GTIN_LENGTHS.includes(text.length)) return null;
	if (/^0+$/.test(text)) return null;
	if (!checkDigitIsCorrect(text) || isRestrictedCirculation(text)) return null;
	return text;
}

/** What a variant shows as its EAN: the declared number, or nothing. */
export function publicEan(variant: { ean?: string | null } | null | undefined): string | null {
	return publicGtin(variant?.ean);
}

/**
 * The schema.org property for a GTIN, named by its length (`gtin13` for an EAN-13), or no property
 * at all. Spread it into a `Product` or an `Offer`; a value that is not a valid GTIN adds nothing.
 */
export function gtinProperty(
	value: unknown,
): { gtin8: string } | { gtin12: string } | { gtin13: string } | { gtin14: string } | Record<string, never> {
	const gtin = publicGtin(value);
	if (!gtin) return {};
	switch (gtin.length) {
		case 8:
			return { gtin8: gtin };
		case 12:
			return { gtin12: gtin };
		case 13:
			return { gtin13: gtin };
		default:
			return { gtin14: gtin };
	}
}
