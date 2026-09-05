/**
 * The product code a customer is allowed to see.
 *
 * Saleor's `variant.sku` is an integration identity, not a label. On this
 * catalogue it is the short code with an internal suffix appended:
 *
 *     name  N21048|N20003|N15428|N15428
 *     sku   N21048|N20003|N15428|N15428|CFMP-B-NOR-57acce2f8ef56b-000000
 *
 * so rendering `sku` puts a CFM-internal string in front of a shopper. Every
 * customer-facing surface used to do exactly that.
 *
 * The tempting fix is to cut the suffix off the SKU, and it is tempting for a
 * reason: measured across the whole public sk-eur catalogue on 2026-09-05, the
 * name is a prefix of the SKU on 417 of 417 variants, and the two are
 * byte-identical on 414. Only three variants — all Nordrive roof-rack sets —
 * carry a suffix at all. String surgery would therefore pass every test anyone
 * is likely to write, and still be a guess about a format nobody has promised.
 *
 * So the source is DECLARED rather than derived: `variant.name`, accepted only
 * when it looks like a code, and nothing at all otherwise. `sku` is never a
 * fallback — falling back to it is precisely the leak this exists to close.
 *
 * The result is a label. It is not unique — several products may legitimately
 * share one — so it must never be used as a key for joining, deduplication or
 * fitment. Use `variant.id` for those.
 */

/**
 * Characters observed across all 417 variant names in the live catalogue:
 * digits, Latin letters, and the four separators `- | / .`. No whitespace
 * occurs, and the repeated segments of a bundle (`N15428|N15428`, two
 * crossbars) are meaningful, so nothing here collapses or reorders them.
 */
const CODE_SHAPE = /^[A-Za-z0-9|/.-]+$/;

/** The internal marker that must never reach a customer, in any casing. */
const INTERNAL_MARKER = /CFMP-/i;

const MIN_LENGTH = 3;
const MAX_LENGTH = 40;

/**
 * Whether a variant name is a product code rather than a human label.
 *
 * A digit is required, and that is the load-bearing clause. Every code in the
 * catalogue today contains one ("A7604", "605503", "PZ-GP001bag"), while the
 * variant names this catalogue does NOT yet have — a colour or a size on the
 * dog crates and seat covers that are coming — would not: "Black" and "XL"
 * satisfy the character set and would otherwise be printed under a "SKU:" label.
 * Measured: 417 of 417 names pass every clause below, and none is letters-only.
 */
function isPublicCode(value: string): boolean {
	return (
		value.length >= MIN_LENGTH &&
		value.length <= MAX_LENGTH &&
		CODE_SHAPE.test(value) &&
		/[0-9]/.test(value) &&
		!INTERNAL_MARKER.test(value)
	);
}

/**
 * The code to show for a variant, or `null` to show nothing.
 *
 * `null` is a real answer and callers must render it as silence. A missing code
 * tells a shopper nothing; the internal SKU tells them something false.
 */
export function publicProductCode(
	variant: { name?: string | null; id?: string | null } | null | undefined,
): string | null {
	const name = variant?.name?.trim();
	if (!name) return null;
	// Saleor names a single unnamed variant after its own id on some shapes.
	if (variant?.id && name === variant.id) return null;
	return isPublicCode(name) ? name : null;
}
