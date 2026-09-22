import { describe, expect, it } from "vitest";
import { checkoutLineDisplay } from "./checkout-line-display";

/** The shape `CheckoutFind` returns, reduced to the fields this helper reads. */
const line = (product: Record<string, unknown>) =>
	({ variant: { product } }) as unknown as Parameters<typeof checkoutLineDisplay>[0];

describe("what a checkout line is called", () => {
	it("uses the market's translation over Saleor's base row", () => {
		// The defect this exists for: a German basket holding a Slovak product name while the
		// product page above it said something else. Same product, two names, one language.
		const display = checkoutLineDisplay(
			line({
				name: "Strešný nosič Nordrive Helio Black",
				slug: "stresny-nosic-nordrive-helio-black",
				translation: {
					name: "Dachträger Nordrive Helio Black",
					slug: "dachtrager-nordrive-helio-black",
				},
				category: { name: "Strešné nosiče", translation: { name: "Dachträger" } },
			}),
		);

		expect(display.name).toBe("Dachträger Nordrive Helio Black");
		expect(display.slug).toBe("dachtrager-nordrive-helio-black");
		expect(display.categoryName).toBe("Dachträger");
		expect(display.localized).toBe(true);
	});

	it("falls back to the base row rather than showing nothing", () => {
		// A translation can legitimately be missing abroad. An empty product name in a basket
		// is indistinguishable from a broken cart, so the Slovak name is the better answer.
		const display = checkoutLineDisplay(
			line({
				name: "Strešný nosič Nordrive Helio Black",
				slug: "stresny-nosic-nordrive-helio-black",
				translation: null,
				category: { name: "Strešné nosiče", translation: null },
			}),
		);

		expect(display.name).toBe("Strešný nosič Nordrive Helio Black");
		expect(display.slug).toBe("stresny-nosic-nordrive-helio-black");
		expect(display.categoryName).toBe("Strešné nosiče");
		expect(display.localized).toBe(false);
	});

	it("treats an empty translation as absent, not as the answer", () => {
		// Saleor returns "" for a translation row that exists with nothing in it. Rendering
		// that would replace the product name with blank space on exactly the markets whose
		// translations are still landing.
		const display = checkoutLineDisplay(
			line({
				name: "Strešný nosič",
				slug: "stresny-nosic",
				translation: { name: "   ", slug: "" },
				category: { name: "Strešné nosiče", translation: { name: "" } },
			}),
		);

		expect(display.name).toBe("Strešný nosič");
		expect(display.slug).toBe("stresny-nosic");
		expect(display.categoryName).toBe("Strešné nosiče");
		expect(display.localized).toBe(false);
	});

	it("says a line has no category rather than inventing one", () => {
		const display = checkoutLineDisplay(
			line({ name: "Strešný nosič", slug: "stresny-nosic", translation: null, category: null }),
		);
		expect(display.categoryName).toBeNull();
	});
});
