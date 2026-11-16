import { describe, expect, it } from "vitest";
import {
	getAddressInputData,
	getAddressInputDataFromAddress,
} from "@/checkout/components/address-form/utils";

describe("getAddressInputData", () => {
	it("sends the address as the customer wrote it, without the empty fields", () => {
		expect(
			getAddressInputData({
				firstName: "Ján",
				lastName: "Novák",
				streetAddress1: "Hlavná 1",
				streetAddress2: "",
				city: "Bratislava",
				postalCode: "811 01",
				phone: "0901 234 561",
				countryCode: "SK",
			}),
		).toEqual({
			firstName: "Ján",
			lastName: "Novák",
			streetAddress1: "Hlavná 1",
			city: "Bratislava",
			postalCode: "811 01",
			phone: "0901234561",
			country: "SK",
		});
	});

	it("writes a postal code in capitals and without the blanks around it", () => {
		expect(getAddressInputData({ postalCode: " k1a 0b1 ", countryCode: "CA" }).postalCode).toBe("K1A 0B1");
		expect(getAddressInputData({ postalCode: "00-950", countryCode: "PL" }).postalCode).toBe("00-950");
	});

	it("drops a phone that is only blanks, so the required-phone check sees none", () => {
		expect(getAddressInputData({ phone: "   ", countryCode: "SK" })).not.toHaveProperty("phone");
	});
});

describe("getAddressInputDataFromAddress", () => {
	it("carries a saved address without a phone as an address without one", () => {
		const input = getAddressInputDataFromAddress({
			id: "QWRkcmVzczox",
			firstName: "Ján",
			lastName: "Novák",
			streetAddress1: "Hlavná 1",
			streetAddress2: "",
			companyName: "",
			city: "BRATISLAVA",
			cityArea: "",
			countryArea: "",
			postalCode: "811 01",
			phone: null,
			country: { code: "SK", country: "Slovakia" },
		});
		expect(input).not.toHaveProperty("phone");
		expect(input.country).toBe("SK");
	});
});
