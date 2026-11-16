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
			"Hlavná 1, Bratislava 811 01, Slovensko · +421901234561",
		);
	});

	it("is the plain address when no phone is stored, and empty without an address", () => {
		expect(formatDeliveryLine({ ...address, phone: null }, "sk-SK")).toBe(
			"Hlavná 1, Bratislava 811 01, Slovensko",
		);
		expect(formatDeliveryLine(null, "sk-SK")).toBe("");
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
