import { describe, expect, it } from "vitest";

import { KARGO_BASE_SLUG } from "@/config/kargo-slugs";

import { informativeNetPrice } from "./informative-net-price";

const kargo = { id: "Q2F0ZWdvcnk6MzQ=", slug: KARGO_BASE_SLUG };
const price = { gross: { amount: 154.98, currency: "EUR" }, net: { amount: 126.0, currency: "EUR" } };

describe("informativeNetPrice (PDP, EU Kargo only)", () => {
	it("returns Saleor's own net on EU markets for the Kargo shelf", () => {
		expect(informativeNetPrice({ channel: "sk-eur", category: kargo, price })).toEqual({
			amount: 126,
			currency: "EUR",
		});
		expect(informativeNetPrice({ channel: "de", category: kargo, price })).toEqual({
			amount: 126,
			currency: "EUR",
		});
	});

	it("knows the shelf by its id abroad, whatever its translated slug", () => {
		expect(
			informativeNetPrice({
				channel: "de-eur",
				category: { id: "Q2F0ZWdvcnk6MzQ=", slug: "kargo-dachtraeger" },
				price,
			}),
		).not.toBeNull();
	});

	it("nothing on export markets, other categories, or a product that only mentions Kargo", () => {
		expect(informativeNetPrice({ channel: "us-usd", category: kargo, price })).toBeNull();
		expect(informativeNetPrice({ channel: "ca-cad", category: kargo, price })).toBeNull();
		expect(
			informativeNetPrice({
				channel: "sk-eur",
				category: { id: "Q2F0ZWdvcnk6MQ==", slug: "stresne-boxy" },
				price,
			}),
		).toBeNull();
		expect(informativeNetPrice({ channel: "sk-eur", category: null, price })).toBeNull();
	});

	it("nothing where Saleor's net is missing or not below its gross", () => {
		expect(
			informativeNetPrice({ channel: "sk-eur", category: kargo, price: { gross: price.gross } }),
		).toBeNull();
		expect(
			informativeNetPrice({
				channel: "sk-eur",
				category: kargo,
				price: { gross: price.gross, net: price.gross },
			}),
		).toBeNull();
		expect(
			informativeNetPrice({
				channel: "sk-eur",
				category: kargo,
				price: { gross: price.gross, net: { amount: 126, currency: "CZK" } },
			}),
		).toBeNull();
		expect(informativeNetPrice({ channel: "sk-eur", category: kargo, price: null })).toBeNull();
	});
});
