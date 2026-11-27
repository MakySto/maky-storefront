import { describe, expect, it } from "vitest";

import { launcherHint, type LauncherHintWords } from "./launcher-hint";

/**
 * The second line of the header's vehicle button. Before 2026-11-27 it never named the roof, so a
 * shopper could not see which roof the sets on screen were chosen for.
 */
const WORDS: LauncherHintWords = {
	changeVehicle: "Zmeniť vozidlo",
	changeShort: "Zmeniť",
	selectVehicleHint: "Pre jednoduchší výber",
	sizeHint: (size) => `${size} · Zmeniť`,
};
const hint = (car: string | null, roof: string | null, size: string | null) =>
	launcherHint({ car, roof, size }, WORDS);

describe("the second line of the header's vehicle button", () => {
	it("names the confirmed roof beside the car", () => {
		expect(hint("Ford Kuga DFK · 2024", "Integrované lyžiny", null)).toBe("Integrované lyžiny · Zmeniť");
	});

	it("names the roof and the tyre size without the repeated word, which the button never had room for", () => {
		// On the live header "Hladká strecha · 205/65 R16 · Zmeniť" was cut to "… · Zme…".
		expect(hint("Ford Kuga DFK · 2024", "Integrované lyžiny", "205/55 R16")).toBe(
			"Integrované lyžiny · 205/55 R16",
		);
	});

	it("says what it said before for a car without a confirmed roof", () => {
		expect(hint("Ford Kuga DFK · 2024", null, null)).toBe("Zmeniť vozidlo");
		expect(hint("Ford Kuga DFK · 2024", null, "205/55 R16")).toBe("205/55 R16 · Zmeniť");
	});

	it("never names a roof without a car", () => {
		expect(hint(null, "Integrované lyžiny", null)).toBe("Pre jednoduchší výber");
		expect(hint(null, "Integrované lyžiny", "205/55 R16")).toBe("Zmeniť");
		expect(hint(null, null, null)).toBe("Pre jednoduchší výber");
	});
});
