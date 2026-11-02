import { describe, expect, it } from "vitest";

import {
	b2bFormValuesFrom,
	b2bInputMetadataEntry,
	EMPTY_B2B_INPUT,
	parseB2bInput,
	serializeB2bInput,
	validateB2bForm,
} from "./b2b-input";
import { B2B_INPUT_METADATA_KEY } from "./contract";

const company = {
	isBusiness: true,
	companyName: "  Firma s. r. o. ",
	registrationId: "",
	taxId: "",
	vatId: "",
};

describe("maky.b2b.input.v1", () => {
	it("round-trips with a fixed key order", () => {
		const input = {
			schema: 1,
			isBusiness: true,
			registrationId: "12345678",
			taxId: "",
			vatId: "DE123456789",
		} as const;
		const serialized = serializeB2bInput(input);
		expect(serialized).toBe(
			'{"schema":1,"isBusiness":true,"registrationId":"12345678","taxId":"","vatId":"DE123456789"}',
		);
		expect(parseB2bInput(serialized)).toEqual(input);
		expect(b2bInputMetadataEntry(input)).toEqual({ key: B2B_INPUT_METADATA_KEY, value: serialized });
	});

	it("is read strictly: anything not exactly v1 is absent", () => {
		expect(parseB2bInput(null)).toBeNull();
		expect(parseB2bInput("")).toBeNull();
		expect(parseB2bInput("{nope")).toBeNull();
		expect(parseB2bInput("[]")).toBeNull();
		expect(
			parseB2bInput('{"schema":2,"isBusiness":true,"registrationId":"","taxId":"","vatId":""}'),
		).toBeNull();
		expect(
			parseB2bInput('{"schema":1,"isBusiness":"true","registrationId":"","taxId":"","vatId":""}'),
		).toBeNull();
		expect(
			parseB2bInput('{"schema":1,"isBusiness":true,"registrationId":12345678,"taxId":"","vatId":""}'),
		).toBeNull();
		expect(parseB2bInput("x".repeat(2000))).toBeNull();
	});
});

describe("validateB2bForm", () => {
	it("not a company stores isBusiness false and nothing else", () => {
		const result = validateB2bForm({ ...company, isBusiness: false, vatId: "DE123456789" }, "DE");
		expect(result).toEqual({ ok: true, input: EMPTY_B2B_INPUT, companyName: "" });
	});

	it("requires the company name", () => {
		expect(validateB2bForm({ ...company, companyName: "  " }, "DE")).toEqual({
			ok: false,
			errors: { companyName: "required" },
		});
	});

	it("a Slovak company needs an IČO; DIČ is optional but checked", () => {
		expect(validateB2bForm(company, "SK")).toEqual({ ok: false, errors: { registrationId: "required" } });
		expect(validateB2bForm({ ...company, registrationId: "123" }, "SK")).toEqual({
			ok: false,
			errors: { registrationId: "registrationIdFormat" },
		});
		expect(validateB2bForm({ ...company, registrationId: "12 345 678", taxId: "123" }, "SK")).toEqual({
			ok: false,
			errors: { taxId: "taxIdFormat" },
		});
		expect(validateB2bForm({ ...company, registrationId: "12 345 678" }, "SK")).toEqual({
			ok: true,
			companyName: "Firma s. r. o.",
			input: { schema: 1, isBusiness: true, registrationId: "12345678", taxId: "", vatId: "" },
		});
	});

	it("a foreign company keeps no Slovak registry numbers (the fields are hidden)", () => {
		const result = validateB2bForm({ ...company, registrationId: "12345678", taxId: "2122890660" }, "DE");
		expect(result).toMatchObject({ ok: true, input: { registrationId: "", taxId: "" } });
	});

	it("VAT ID is optional, normalized when given and refused when malformed", () => {
		expect(validateB2bForm({ ...company, vatId: "de 123 456 789" }, "DE")).toMatchObject({
			ok: true,
			input: { vatId: "DE123456789" },
		});
		expect(validateB2bForm({ ...company, vatId: "12" }, "DE")).toEqual({
			ok: false,
			errors: { vatId: "vatIdFormat" },
		});
	});

	it("an export market asks for the company and address only", () => {
		const result = validateB2bForm({ ...company, vatId: "junk", registrationId: "" }, "SK", {
			euMarket: false,
		});
		expect(result).toEqual({
			ok: true,
			companyName: "Firma s. r. o.",
			input: { schema: 1, isBusiness: true, registrationId: "", taxId: "", vatId: "" },
		});
	});

	it("a filled delivery 'Firma' alone does not switch the company purchase on", () => {
		expect(b2bFormValuesFrom(null, "Some Company")).toEqual({
			isBusiness: false,
			companyName: "",
			registrationId: "",
			taxId: "",
			vatId: "",
		});
	});
});
