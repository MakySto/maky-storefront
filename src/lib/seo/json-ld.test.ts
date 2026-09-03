import { describe, expect, it } from "vitest";
import { buildProductJsonLd } from "./json-ld";

describe("product JSON-LD truthfulness", () => {
	it("does not invent MAKY.STORE as a product brand", () => {
		const data = buildProductJsonLd({ name: "Nosič" });
		expect(data).not.toHaveProperty("brand");
		expect(data).not.toHaveProperty("offers");
		expect(data).not.toHaveProperty("image");
	});

	it("emits known brand, source SKU and MPN", () => {
		const data = buildProductJsonLd({ name: "Nosič", brand: "Nordrive", sku: "N15011", mpn: "N15011" });
		expect(data).toMatchObject({
			brand: { "@type": "Brand", name: "Nordrive" },
			sku: "N15011",
			mpn: "N15011",
		});
	});
});
