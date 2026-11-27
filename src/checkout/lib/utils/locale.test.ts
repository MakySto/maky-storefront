import { describe, expect, it } from "vitest";

import { countryOptions } from "./locale";
import type { CountryCode } from "@/checkout/graphql";

const codes = (...list: string[]) => list as CountryCode[];

describe("countryOptions", () => {
	it("names each country in the market's language", () => {
		const german = countryOptions(codes("AT", "DE"), "de-DE");
		expect(german.map((option) => option.label)).toEqual(["Deutschland", "Österreich"]);
		const slovak = countryOptions(codes("AT", "DE"), "sk-SK");
		expect(slovak.map((option) => option.label)).toEqual(["Nemecko", "Rakúsko"]);
	});

	it("orders by the name the customer reads, not by the ISO code", () => {
		// By code this list is AT, BE, CZ, DE, ES, FI, SK: "Österreich" first and "Spanien" above "Finnland".
		const german = countryOptions(codes("AT", "BE", "CZ", "DE", "ES", "FI", "SK"), "de-DE");
		expect(german.map((option) => option.label)).toEqual([
			"Belgien",
			"Deutschland",
			"Finnland",
			"Österreich",
			"Slowakei",
			"Spanien",
			"Tschechien",
		]);
		expect(german.map((option) => option.value)).toEqual(["BE", "DE", "FI", "AT", "SK", "ES", "CZ"]);
	});

	it("sorts accented names by the language's own alphabet", () => {
		// Slovak: "Česko" belongs after "Belgicko" and before "Dánsko", not after "Z".
		const slovak = countryOptions(codes("DK", "CZ", "BE", "SE"), "sk-SK");
		expect(slovak.map((option) => option.label)).toEqual(["Belgicko", "Česko", "Dánsko", "Švédsko"]);
	});

	it("keeps every code it was given, once", () => {
		const input = codes("SK", "CZ", "DE", "AT", "PL", "HU", "IT", "FR", "ES", "RO", "US", "CA");
		const options = countryOptions(input, "sk-SK");
		expect(options).toHaveLength(input.length);
		expect(new Set(options.map((option) => option.value))).toEqual(new Set(input));
	});

	it("does not change the list it was handed", () => {
		const input = codes("SK", "AT");
		countryOptions(input, "de-DE");
		expect(input).toEqual(["SK", "AT"]);
	});
});
