import { describe, expect, it } from "vitest";

import { imageAlt, imageNavigationLabel } from "./image-lightbox";

describe("product image alternative text", () => {
	it("keeps a meaningful Saleor ALT value", () => {
		expect(imageAlt({ url: "/orbit.jpg", alt: "Menabo ORBIT 3 zozadu" }, "Menabo ORBIT 3", 2)).toBe(
			"Menabo ORBIT 3 zozadu",
		);
	});

	it("uses the product name only for the primary image", () => {
		const image = { url: "/orbit.jpg", alt: "  " };
		expect(imageAlt(image, "Menabo ORBIT 3", 0)).toBe("Menabo ORBIT 3");
		expect(imageAlt(image, "Menabo ORBIT 3", 1)).toBe("");
	});

	it("always gives image controls an accessible name", () => {
		const image = { url: "/orbit.jpg", alt: null };
		expect(imageNavigationLabel(image, "Menabo ORBIT 3", 1)).toBe("Menabo ORBIT 3 – 2");
	});
});
