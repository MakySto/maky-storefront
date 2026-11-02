import { describe, expect, it } from "vitest";

import { informativeNetPrice } from "./informative-net-price";

const price = { gross: { amount: 154.98, currency: "EUR" }, net: { amount: 126.0, currency: "EUR" } };

describe("informativeNetPrice (PDP, EU markets, every product)", () => {
	it("returns Saleor's own net on EU markets, whatever the product (a company may buy anything)", () => {
		for (const channel of ["sk-eur", "sk", "de", "de-eur", "cz-czk"]) {
			const own =
				channel === "cz-czk"
					? { gross: { amount: 3800, currency: "CZK" }, net: { amount: 3140.5, currency: "CZK" } }
					: price;
			expect(informativeNetPrice({ channel, price: own }), channel).toEqual(own.net);
		}
	});

	it("nothing on the export markets, which have no VAT line", () => {
		expect(informativeNetPrice({ channel: "us-usd", price })).toBeNull();
		expect(informativeNetPrice({ channel: "ca-cad", price })).toBeNull();
	});

	it("nothing where Saleor's net is missing or not below its gross", () => {
		expect(informativeNetPrice({ channel: "sk-eur", price: { gross: price.gross } })).toBeNull();
		expect(
			informativeNetPrice({ channel: "sk-eur", price: { gross: price.gross, net: price.gross } }),
		).toBeNull();
		expect(
			informativeNetPrice({
				channel: "sk-eur",
				price: { gross: price.gross, net: { amount: 126, currency: "CZK" } },
			}),
		).toBeNull();
		expect(
			informativeNetPrice({
				channel: "sk-eur",
				price: { gross: price.gross, net: { amount: 0, currency: "EUR" } },
			}),
		).toBeNull();
		expect(informativeNetPrice({ channel: "sk-eur", price: null })).toBeNull();
	});
});
