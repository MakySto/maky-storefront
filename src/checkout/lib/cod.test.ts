import { describe, expect, it } from "vitest";
import {
	COD_FOR_KEY,
	COD_MAX_KEY,
	codFeeInDelivery,
	codOffer,
	codTotal,
	customerDeliveryMethodId,
	customerDeliveryMethods,
	isCodMethod,
	isWithinCodMax,
} from "./cod";

/**
 * Delivery methods as Saleor offers them for a Slovak parcel under 5 kg and one between 5 and 15 kg would, with
 * the cash-on-delivery version of the first one. The ids are made up.
 */
const BASE = { id: "method-small", price: { amount: 3.99, currency: "EUR" }, metadata: [] };
const OTHER = { id: "method-pickup", price: { amount: 2.5, currency: "EUR" }, metadata: [] };
const cod = (overrides: { max?: string | null; price?: number; base?: string } = {}) => ({
	id: "method-small-cod",
	price: { amount: overrides.price ?? 6.99, currency: "EUR" },
	metadata: [
		{ key: COD_FOR_KEY, value: overrides.base ?? BASE.id },
		...(overrides.max === null ? [] : [{ key: COD_MAX_KEY, value: overrides.max ?? "500" }]),
	],
});
const checkoutOn = (deliveryMethodId: string | null, methods = [BASE, OTHER, cod()]) => ({
	deliveryMethod: deliveryMethodId ? { id: deliveryMethodId } : null,
	shippingMethods: methods,
});

describe("the delivery step", () => {
	it("does not list the cash-on-delivery version as a delivery", () => {
		expect(customerDeliveryMethods([BASE, OTHER, cod()]).map((method) => method.id)).toEqual([
			BASE.id,
			OTHER.id,
		]);
	});

	it("shows the delivery it belongs to as chosen when the checkout is on cash on delivery", () => {
		const methods = [BASE, OTHER, cod()];
		expect(customerDeliveryMethodId("method-small-cod", methods)).toBe(BASE.id);
		expect(customerDeliveryMethodId(BASE.id, methods)).toBe(BASE.id);
	});

	it("shows nothing as chosen for a method that is not offered, or whose delivery is gone", () => {
		expect(customerDeliveryMethodId(null, [BASE])).toBeUndefined();
		expect(customerDeliveryMethodId("warehouse-1", [BASE, cod()])).toBeUndefined();
		expect(customerDeliveryMethodId("method-small-cod", [OTHER, cod()])).toBeUndefined();
	});

	it("treats a method without the key, or with an empty value, as an ordinary delivery", () => {
		expect(isCodMethod(BASE)).toBe(false);
		expect(isCodMethod({ metadata: null })).toBe(false);
		expect(isCodMethod({ metadata: [{ key: COD_FOR_KEY, value: "  " }] })).toBe(false);
		expect(isCodMethod(cod())).toBe(true);
	});
});

describe("codOffer", () => {
	it("offers cash on delivery for a delivery that has a version of it, at the difference of the prices", () => {
		const offer = codOffer(checkoutOn(BASE.id));
		expect(offer).toMatchObject({ fee: 3, max: 500, selected: false });
		expect([offer?.base.id, offer?.cod.id]).toEqual([BASE.id, "method-small-cod"]);
	});

	it("knows the checkout is on cash on delivery", () => {
		const offer = codOffer(checkoutOn("method-small-cod"));
		expect(offer).toMatchObject({ fee: 3, max: 500, selected: true });
		expect(offer?.base.id).toBe(BASE.id);
	});

	it("offers none before a delivery is chosen, or for a delivery without a version of it", () => {
		expect(codOffer(checkoutOn(null))).toBeNull();
		expect(codOffer(checkoutOn(OTHER.id))).toBeNull();
		expect(codOffer({ deliveryMethod: { id: BASE.id }, shippingMethods: null })).toBeNull();
	});

	it("offers none when the delivery it belongs to is not offered, or when it would be cheaper than it", () => {
		expect(codOffer(checkoutOn("method-small-cod", [OTHER, cod()]))).toBeNull();
		expect(codOffer(checkoutOn(BASE.id, [BASE, cod({ price: 2.99 })]))).toBeNull();
	});

	it("does not take a cash-on-delivery version for the base of another one", () => {
		const chained = { ...cod({ base: "method-small-cod" }), id: "method-chained" };
		expect(codOffer(checkoutOn("method-chained", [BASE, cod(), chained]))).toBeNull();
	});

	it("reads the limit, and has none when Saleor names none or names nonsense", () => {
		expect(codOffer(checkoutOn(BASE.id, [BASE, cod({ max: "499,90" })]))?.max).toBe(499.9);
		expect(codOffer(checkoutOn(BASE.id, [BASE, cod({ max: null })]))?.max).toBeNull();
		expect(codOffer(checkoutOn(BASE.id, [BASE, cod({ max: "veľa" })]))?.max).toBeNull();
		expect(codOffer(checkoutOn(BASE.id, [BASE, cod({ max: "0" })]))?.max).toBeNull();
	});

	it("accepts a fee of nothing", () => {
		expect(codOffer(checkoutOn(BASE.id, [BASE, cod({ price: 3.99 })]))).toMatchObject({ fee: 0 });
	});
});

describe("the limit", () => {
	const offer = { max: 500 };

	it("holds the order total with the fee against the limit", () => {
		expect(isWithinCodMax(offer, 500)).toBe(true);
		expect(isWithinCodMax(offer, 500.01)).toBe(false);
		expect(isWithinCodMax(offer, 12)).toBe(true);
	});

	it("allows any total without a limit, and no total that is not a number", () => {
		expect(isWithinCodMax({ max: null }, 9999)).toBe(true);
		expect(isWithinCodMax(offer, null)).toBe(false);
		expect(isWithinCodMax(offer, Number.NaN)).toBe(false);
	});

	it("adds the fee to the total only while the checkout is not yet on cash on delivery", () => {
		expect(codTotal({ fee: 3, selected: false }, 497.5)).toBe(500.5);
		expect(codTotal({ fee: 3, selected: true }, 500.5)).toBe(500.5);
		expect(codTotal({ fee: 3, selected: false }, null)).toBeNull();
	});
});

describe("codFeeInDelivery", () => {
	it("is the fee while the checkout is on cash on delivery and nothing otherwise", () => {
		expect(codFeeInDelivery(checkoutOn("method-small-cod"))).toBe(3);
		expect(codFeeInDelivery(checkoutOn(BASE.id))).toBe(0);
		expect(codFeeInDelivery(checkoutOn(null))).toBe(0);
	});
});
