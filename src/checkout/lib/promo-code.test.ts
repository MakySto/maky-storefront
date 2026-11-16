import { describe, expect, it } from "vitest";
import {
	appliedPromoCodes,
	hasAppliedPromoCodes,
	isUnknownCodeRefusal,
	normalizePromoCode,
	promoCodeAttempts,
	promoCodeRefusal,
	promoCodeRefusalMessage,
} from "./promo-code";

// Every code in this file is made up. The shop's real codes live in the Saleor Dashboard and nowhere in this
// repository, which is public.

describe("normalizePromoCode", () => {
	it("drops the spaces and line ends a copy from an e-mail brings along, and keeps the case", () => {
		expect(normalizePromoCode("  Fake-Code 10\n")).toBe("Fake-Code10");
		expect(normalizePromoCode("\tFAKE10 ")).toBe("FAKE10");
	});

	it("is empty for nothing", () => {
		expect(normalizePromoCode(null)).toBe("");
		expect(normalizePromoCode(undefined)).toBe("");
		expect(normalizePromoCode("   ")).toBe("");
	});
});

describe("promoCodeAttempts", () => {
	it("tries the code as typed first and in capitals second: Saleor compares letter for letter", () => {
		expect(promoCodeAttempts("fake10")).toEqual(["fake10", "FAKE10"]);
		expect(promoCodeAttempts(" Fake-ab12-cd34 ")).toEqual(["Fake-ab12-cd34", "FAKE-AB12-CD34"]);
	});

	it("does not ask twice for a code that is already in capitals", () => {
		expect(promoCodeAttempts("FAKE10")).toEqual(["FAKE10"]);
		expect(promoCodeAttempts("1234-5678")).toEqual(["1234-5678"]);
	});

	it("asks for nothing when nothing was typed", () => {
		expect(promoCodeAttempts("  ")).toEqual([]);
		expect(promoCodeAttempts(null)).toEqual([]);
	});
});

describe("promoCodeRefusal", () => {
	// The codes Saleor answered with on 2026-11-16: an unknown code, a code in the wrong case and a gift card
	// that is not active are all INVALID; a voucher under its minimum spend is VOUCHER_NOT_APPLICABLE.
	it("calls an unknown code invalid", () => {
		expect(
			promoCodeRefusal([{ code: "INVALID", field: "promoCode", message: "Promo code is invalid" }]),
		).toBe("invalid");
		expect(promoCodeRefusal([{ code: "NOT_FOUND" }])).toBe("invalid");
		expect(promoCodeRefusal([{ code: "GIFT_CARD_NOT_APPLICABLE" }])).toBe("invalid");
	});

	it("tells a voucher that exists but does not fit this cart apart from an unknown one", () => {
		expect(
			promoCodeRefusal([
				{ code: "VOUCHER_NOT_APPLICABLE", message: "Voucher is not applicable to this checkout." },
			]),
		).toBe("notApplicable");
	});

	it("puts a payment in progress first: it is a state, not a bad code", () => {
		expect(promoCodeRefusal([{ code: "INVALID" }, { code: "B2B_CHECKOUT_LOCKED" }])).toBe("locked");
		expect(promoCodeRefusal([{ code: "CHECKOUT_LOCKED" }])).toBe("locked");
	});

	it("falls back to a general failure for anything it does not know", () => {
		expect(promoCodeRefusal([{ code: "GRAPHQL_ERROR" }])).toBe("failed");
		expect(promoCodeRefusal([])).toBe("failed");
		expect(promoCodeRefusal([{ code: "REQUIRED" }])).toBe("empty");
	});

	it("retries in capitals only for a code Saleor did not know", () => {
		expect(isUnknownCodeRefusal("invalid")).toBe(true);
		for (const refusal of ["empty", "notApplicable", "locked", "failed"] as const) {
			expect(isUnknownCodeRefusal(refusal)).toBe(false);
		}
	});
});

describe("promoCodeRefusalMessage", () => {
	it("names a message key for every refusal and never passes Saleor's English on", () => {
		const t = (key: string) => key;
		expect(promoCodeRefusalMessage("empty", t)).toBe("checkout.promo.empty");
		expect(promoCodeRefusalMessage("invalid", t)).toBe("checkout.promo.invalid");
		expect(promoCodeRefusalMessage("notApplicable", t)).toBe("checkout.promo.notApplicable");
		expect(promoCodeRefusalMessage("locked", t)).toBe("checkout.promo.paymentInProgress");
		expect(promoCodeRefusalMessage("failed", t)).toBe("checkout.promo.failed");
	});
});

describe("appliedPromoCodes", () => {
	it("is empty for a checkout without a code", () => {
		const applied = appliedPromoCodes({
			voucherCode: null,
			discount: { amount: 0, currency: "EUR" },
			giftCards: [],
		});
		expect(applied).toEqual({ voucher: null, giftCards: [] });
		expect(hasAppliedPromoCodes(applied)).toBe(false);
		expect(appliedPromoCodes(null)).toEqual({ voucher: null, giftCards: [] });
	});

	it("shows the voucher with what it took off, and never the name staff gave it", () => {
		const applied = appliedPromoCodes({
			voucherCode: "FAKE5",
			discountName: "Interný názov pre obsluhu",
			translatedDiscountName: "",
			discount: { amount: 9.25, currency: "EUR" },
			giftCards: [],
		});
		expect(applied.voucher).toEqual({
			code: "FAKE5",
			name: null,
			discount: { amount: 9.25, currency: "EUR" },
		});
		expect(hasAppliedPromoCodes(applied)).toBe(true);
	});

	it("shows the translated name when the market has one and it says more than the code", () => {
		expect(
			appliedPromoCodes({ voucherCode: "FAKE5", translatedDiscountName: "Herbstaktion" }).voucher?.name,
		).toBe("Herbstaktion");
		expect(
			appliedPromoCodes({ voucherCode: "FAKE5", translatedDiscountName: "fake5" }).voucher?.name,
		).toBeNull();
	});

	it("keeps a delivery voucher that has taken nothing off yet, without an amount", () => {
		expect(
			appliedPromoCodes({ voucherCode: "FAKESHIP", discount: { amount: 0, currency: "EUR" } }).voucher,
		).toEqual({ code: "FAKESHIP", name: null, discount: null });
	});

	it("lists gift cards by the characters Saleor shows, with their balance", () => {
		const applied = appliedPromoCodes({
			voucherCode: null,
			giftCards: [{ id: "card-1", displayCode: "AB12", currentBalance: { amount: 10, currency: "EUR" } }],
		});
		expect(applied.giftCards).toEqual([
			{ id: "card-1", displayCode: "AB12", balance: { amount: 10, currency: "EUR" } },
		]);
		expect(hasAppliedPromoCodes(applied)).toBe(true);
	});
});
