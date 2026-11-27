/**
 * The second line of the header's vehicle button: what is chosen beside the car, and what a press does.
 *
 * The first line names the car and its year. The roof type changes which sets fit as much as the year does, so
 * a shopper who confirmed one sees it here (owner's review, 2026-11-27: a list for "Kuga 2024" did not say which
 * roof it was for). Only a roof the shopper CONFIRMED is named: an unconfirmed one is not a fact about the car.
 *
 * The line is cut at the end when the button is too narrow, so the order is the order of importance: the roof,
 * the tyre size, and last the word that only repeats what the button is.
 *
 * Pure, with the words passed in: the launcher translates, and the tests need no translator.
 */
export type LauncherHintWords = {
	/** "Zmeniť vozidlo" */
	changeVehicle: string;
	/** "Zmeniť" */
	changeShort: string;
	/** "Pre jednoduchší výber" */
	selectVehicleHint: string;
	/** "{size} · Zmeniť" */
	sizeHint: (size: string) => string;
};

const SEPARATOR = " · ";

export function launcherHint(
	chosen: { car: string | null; roof: string | null; size: string | null },
	words: LauncherHintWords,
): string {
	const { car, roof, size } = chosen;
	if (!car) return size ? words.changeShort : words.selectVehicleHint;
	if (roof) return [roof, size, words.changeShort].filter(Boolean).join(SEPARATOR);
	return size ? words.sizeHint(size) : words.changeVehicle;
}
