import { afterEach, describe, expect, it, vi } from "vitest";
import { validateContact, CONTACT_FIELD_LIMITS } from "./validate";
import { contactFormMarkets, contactFormBlockReason, isContactFormServable } from "./servable";

const good = {
	name: "Meno Priezvisko",
	email: "Customer@Example.COM",
	phone: "",
	topic: "productAdvice",
	order: "",
	message: "Text správy.",
};

describe("contact validation", () => {
	it("accepts a minimal valid message", () => {
		const result = validateContact(good);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.email).toBe("customer@example.com"); // normalised
		// Empty optional fields are null on the wire, not "". The provider's schema
		// distinguishes "not given" from "given as blank".
		expect(result.value.phone).toBeNull();
		expect(result.value.order).toBeNull();
	});

	it("reports the first problem in field order, so focus lands on it", () => {
		const result = validateContact({ ...good, name: "", email: "" });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.focus).toBe("name");
		expect(Object.keys(result.errors).sort()).toEqual(["email", "name"]);
	});

	it("emits codes, never sentences — one validator for twelve markets", () => {
		const result = validateContact({ ...good, email: "not-an-email" });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.email).toBe("email:invalid");
	});

	it("refuses a topic outside the provider's list", () => {
		const result = validateContact({ ...good, topic: "somethingElse" });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.topic).toBe("topic:invalid");
	});

	it("bounds every free-text field", () => {
		for (const [field, limit] of Object.entries(CONTACT_FIELD_LIMITS)) {
			const result = validateContact({ ...good, [field]: "x".repeat(limit + 1) });
			expect(result.ok, `${field} should be bounded`).toBe(false);
			if (result.ok) continue;
			expect(result.errors[field as keyof typeof result.errors]).toBe(`${field}:tooLong`);
		}
	});

	it("treats whitespace-only as missing", () => {
		const result = validateContact({ ...good, message: "   \n  " });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.message).toBe("message:required");
	});
});

describe("the form gate", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("offers the form nowhere when unset", () => {
		vi.stubEnv("MAKY_CONTACT_FORM_MARKETS", "");
		expect(contactFormMarkets().size).toBe(0);
		for (const market of ["sk", "de", "us"]) expect(isContactFormServable(market)).toBe(false);
	});

	// Deliberately unlike `isWithdrawalFormServable()`, which returns true whenever
	// NODE_ENV is not production — that offers a live form on staging without anyone
	// choosing to.
	it("has no development exemption", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("MAKY_CONTACT_FORM_MARKETS", "");
		expect(isContactFormServable("sk")).toBe(false);
	});

	it("offers it only where it is listed", () => {
		vi.stubEnv("MAKY_CONTACT_FORM_MARKETS", "sk, cz");
		expect(isContactFormServable("sk")).toBe(true);
		expect(isContactFormServable("cz")).toBe(true);
		expect(isContactFormServable("de")).toBe(false);
	});

	it("ignores an entry that is not a market", () => {
		vi.stubEnv("MAKY_CONTACT_FORM_MARKETS", "sk,zz,../etc");
		expect([...contactFormMarkets()]).toEqual(["sk"]);
	});

	it("explains the absence rather than omitting it silently", () => {
		vi.stubEnv("MAKY_CONTACT_FORM_MARKETS", "");
		expect(contactFormBlockReason("sk")).toContain("offered nowhere");
		vi.stubEnv("MAKY_CONTACT_FORM_MARKETS", "sk");
		expect(contactFormBlockReason("de")).toContain("not in");
		expect(contactFormBlockReason("sk")).toBeNull();
	});
});
