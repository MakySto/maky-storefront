/**
 * The quiet line over a card's name: the maker and the shelf the product sits on — but only what
 * the name does not already say.
 *
 * "NORDRIVE · Nordrive strešné nosiče" over "Nordrive Silenzio Silver" said "Nordrive" three times.
 * A part is dropped when the shown name already contains it, or when it is a shelf named after a
 * maker the name carries ("Nordrive strešné nosiče" for a "… Nordrive …" product). What is left can
 * still be a category that tells a shopper something ("Nosiče bicyklov na ťažné zariadenie").
 */
function mentions(text: string, part: string): boolean {
	const lower = text.toLocaleLowerCase();
	const wanted = part.toLocaleLowerCase();
	if (lower.includes(wanted)) return true;
	const first = wanted.split(/\s+/)[0] ?? "";
	return first.length > 2 && first !== wanted && lower.includes(first);
}

export function cardKicker(
	shownName: string,
	brand: string | null | undefined,
	category: string | null | undefined,
): { brand: string | null; category: string | null } {
	const keep = (part: string | null | undefined) =>
		part && part.trim() && !mentions(shownName, part.trim()) ? part.trim() : null;
	return { brand: keep(brand), category: keep(category) };
}
