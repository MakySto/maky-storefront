import { describe, expect, it } from "vitest";
import { formatDeliveryLine, shippingMethodName } from "./checkout-summary-context";

const address = {
	id: "a",
	firstName: "Ján",
	lastName: "Novák",
	streetAddress1: "Hlavná 1",
	streetAddress2: "",
	companyName: "",
	city: "Bratislava",
	cityArea: "",
	countryArea: "",
	postalCode: "811 01",
	phone: "+421901234561",
	country: { code: "SK", country: "Slovakia" },
};

describe("formatDeliveryLine", () => {
	it("shows the phone as Saleor stored it, with its calling code, after the address", () => {
		expect(formatDeliveryLine(address, "sk-SK")).toBe(
			"Hlavná 1, 811 01 Bratislava, Slovensko · +421901234561",
		);
	});

	it("is the plain address when no phone is stored, and empty without an address", () => {
		expect(formatDeliveryLine({ ...address, phone: null }, "sk-SK")).toBe(
			"Hlavná 1, 811 01 Bratislava, Slovensko",
		);
		expect(formatDeliveryLine(null, "sk-SK")).toBe("");
	});

	it("writes the town and the postal code in the address's own order", () => {
		// Postcode first in continental Europe; town, state and code in North America (`cityLine`).
		expect(
			formatDeliveryLine(
				{
					...address,
					phone: null,
					city: "Berlin",
					postalCode: "10115",
					country: { code: "DE", country: "Germany" },
				},
				"de-DE",
			),
		).toBe("Hlavná 1, 10115 Berlin, Deutschland");
		expect(
			formatDeliveryLine(
				{
					...address,
					phone: null,
					city: "Austin",
					countryArea: "TX",
					postalCode: "78701",
					country: { code: "US", country: "United States" },
				},
				"en-US",
			),
		).toBe("Hlavná 1, Austin, TX 78701, United States");
	});
});

describe("shippingMethodName", () => {
	it("prefers Saleor's translation for the customer's language", () => {
		expect(shippingMethodName({ name: "CE 0-5kg", translation: { name: "Kurier (bis 5 kg)" } })).toBe(
			"Kurier (bis 5 kg)",
		);
	});

	it("falls back to the method's own name when there is no translation, or an empty one", () => {
		expect(shippingMethodName({ name: "CE 0-5kg", translation: null })).toBe("CE 0-5kg");
		expect(shippingMethodName({ name: "CE 0-5kg", translation: { name: "  " } })).toBe("CE 0-5kg");
		expect(shippingMethodName({ name: "CE 0-5kg" })).toBe("CE 0-5kg");
	});
});
