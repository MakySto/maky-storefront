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

/**
 * The maker and the shelf a set sits on, for the line over a set's name on a phone: "NORDRIVE ·
 * Strešné nosiče".
 *
 * Unlike `cardKicker` this keeps the maker even when the name carries it — on a phone the line is
 * the first thing under the photograph and says who made it — and instead takes the maker out of the
 * shelf's name, where it is only repeated ("Nordrive strešné nosiče" → "Strešné nosiče"). A shelf that
 * is nothing but the maker's name is not a shelf and is dropped.
 */
export function setKicker(
	brand: string | null | undefined,
	category: string | null | undefined,
): { brand: string | null; category: string | null } {
	const maker = brand?.trim() || null;
	let shelf = category?.trim() || null;
	if (shelf && maker) {
		const lower = shelf.toLocaleLowerCase();
		const prefix = maker.toLocaleLowerCase();
		if (lower.startsWith(prefix) && (shelf.length === maker.length || /\s/.test(shelf[maker.length]!))) {
			shelf = shelf.slice(maker.length).trim() || null;
		}
	}
	if (shelf) shelf = shelf.charAt(0).toLocaleUpperCase() + shelf.slice(1);
	return { brand: maker, category: shelf };
}
