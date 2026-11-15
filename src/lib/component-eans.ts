import { carriesInternalMarker } from "@/lib/product-code";
import { publicGtin } from "@/lib/product-ean";

/**
 * The EANs of the parts a set is made of, as CFM publishes them on the variant.
 *
 * A roof-rack set is put together by the shop from parts that each have a maker's EAN (bars, feet, a
 * fitting kit); the set itself has none. CFM writes the parts into the PUBLIC variant metadata key
 * `cfm_component_eans` as JSON text, an array in the order of the set's composite code:
 *
 *   [{"code":"N21401","role":"bars","ean":"8010000000000","qty":1}, …]
 *
 * `role` is `bars`, `feet`, `kit` or `other`, decided by CFM from its catalogue, never from a name. A
 * part without a valid EAN arrives with no `ean`. Shape agreed with CFM on 2026-11-15.
 *
 * ## Where these numbers go, and where they do not
 *
 * On the page, beside the set's own code: a shopper, and a search for the number, finds the set.
 *
 * NOT into the set's `gtin` in structured data. A GTIN there says "this offer IS that product", and the
 * same bars are in thousands of sets: every one of them would claim to be the bars, at the price of a
 * whole set. Google's rule for a set the merchant puts together is the main part's GTIN together with
 * `is_bundle`, and that flag exists in a product feed only, not in schema.org markup.
 */
export const COMPONENT_EANS_METAFIELD_KEY = "cfm_component_eans";

export type ComponentRole = "bars" | "feet" | "kit" | "other";

export interface ComponentEan {
	readonly code: string;
	readonly role: ComponentRole;
	readonly ean: string;
	/** How many of the part the set holds; 1 when CFM says nothing usable. */
	readonly qty: number;
}

const ROLES: ReadonlySet<string> = new Set(["bars", "feet", "kit", "other"]);
/** A maker's part code: short, printable, no markup. Anything else is not shown. */
const CODE = /^[A-Za-z0-9][A-Za-z0-9 ._/+-]{0,39}$/;
/** More parts than any set has; a longer list is not a set's parts. */
const MAX_PARTS = 12;
const MAX_QTY = 99;

/**
 * The parts that may be shown: each with a code that is a maker's code and an EAN that is a real GTIN
 * (`publicGtin`, the check every EAN on the site passes). Whatever does not parse, or is not this shape,
 * is nothing: a blank beside the code, never a repaired number.
 */
export function publicComponentEans(raw: unknown): ComponentEan[] {
	if (typeof raw !== "string" || raw.trim() === "") return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed) || parsed.length > MAX_PARTS) return [];

	const parts: ComponentEan[] = [];
	const seen = new Set<string>();
	for (const entry of parsed) {
		if (!entry || typeof entry !== "object") continue;
		const { code, role, ean, qty } = entry as Record<string, unknown>;
		if (typeof code !== "string" || !CODE.test(code) || carriesInternalMarker(code)) continue;
		const gtin = publicGtin(ean);
		if (!gtin || seen.has(gtin)) continue;
		seen.add(gtin);
		parts.push({
			code,
			role: typeof role === "string" && ROLES.has(role) ? (role as ComponentRole) : "other",
			ean: gtin,
			qty: typeof qty === "number" && Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY ? qty : 1,
		});
	}
	return parts;
}
