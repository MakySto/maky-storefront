import { describe, expect, it } from "vitest";

import { cityLine } from "./address-city-line";

const address = (code: string | null, city: string, postalCode: string, countryArea = "") => ({
	city,
	postalCode,
	countryArea,
	country: code ? { code } : null,
});

describe("cityLine", () => {
	it("writes the postal code first in continental Europe", () => {
		expect(cityLine(address("DE", "Berlin", "10115"))).toBe("10115 Berlin");
		expect(cityLine(address("AT", "Wien", "1010"))).toBe("1010 Wien");
		expect(cityLine(address("SK", "Žilina", "010 01"))).toBe("010 01 Žilina");
		expect(cityLine(address("CZ", "Praha", "110 00"))).toBe("110 00 Praha");
		expect(cityLine(address("PL", "Warszawa", "00-001"))).toBe("00-001 Warszawa");
		expect(cityLine(address("HU", "Budapest", "1011"))).toBe("1011 Budapest");
		expect(cityLine(address("FR", "Paris", "75001"))).toBe("75001 Paris");
		expect(cityLine(address("ES", "Madrid", "28001"))).toBe("28001 Madrid");
		expect(cityLine(address("RO", "București", "010011"))).toBe("010011 București");
	});

	it("puts a region after the town where the form asked for one", () => {
		expect(cityLine(address("IT", "Milano", "20121", "MI"))).toBe("20121 Milano, MI");
	});

	it("writes the town first in North America, with the state before the code", () => {
		expect(cityLine(address("US", "Austin", "78701", "TX"))).toBe("Austin, TX 78701");
		expect(cityLine(address("CA", "Toronto", "M5V 2T6", "ON"))).toBe("Toronto, ON M5V 2T6");
		expect(cityLine(address("us", "Austin", "78701", "TX"))).toBe("Austin, TX 78701");
	});

	it("follows the address's own country, whatever the market", () => {
		// The same function serves a Slovak page showing a Canadian address and the reverse.
		expect(cityLine(address("CA", "Montréal", "H2Y 1C6", "QC"))).toBe("Montréal, QC H2Y 1C6");
		expect(cityLine(address("SK", "Bratislava", "811 01"))).toBe("811 01 Bratislava");
	});

	it("leaves out what is missing without leaving separators behind", () => {
		expect(cityLine(address("DE", "Berlin", ""))).toBe("Berlin");
		expect(cityLine(address("DE", "", "10115"))).toBe("10115");
		expect(cityLine(address("US", "Austin", "", "TX"))).toBe("Austin, TX");
		expect(cityLine(address("US", "", "78701"))).toBe("78701");
		expect(cityLine(address("DE", "  Berlin ", " 10115 "))).toBe("10115 Berlin");
		expect(cityLine({ city: null, postalCode: null })).toBe("");
		expect(cityLine(null)).toBe("");
		expect(cityLine(undefined)).toBe("");
	});

	it("writes an address with no country the way the home market does", () => {
		expect(cityLine(address(null, "Žilina", "010 01"))).toBe("010 01 Žilina");
	});
});
