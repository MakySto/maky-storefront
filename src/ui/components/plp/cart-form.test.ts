import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useOpenCart } from "@/ui/components/cart/cart-context";
import { shouldOpenCartAfter } from "./cart-form";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

/**
 * A confirmed add opens the cart drawer (owner, 2026-11-27; audit of the live store, S1). Before it the
 * only sign was a small line under the button and the way to the checkout stayed behind the header icon.
 */
describe("which add-to-cart outcome opens the cart drawer", () => {
	it("a confirmed add does", () => {
		expect(shouldOpenCartAfter({ status: "added" })).toBe(true);
	});

	it("nothing else does: not the first render, not a refusal, not an answer we do not know", () => {
		expect(shouldOpenCartAfter(null)).toBe(false);
		expect(shouldOpenCartAfter({ status: "rejected", reason: "rejected", message: "Nedá sa pridať." })).toBe(
			false,
		);
		// The line may or may not be in the cart: opening the drawer would read as "it is".
		expect(shouldOpenCartAfter({ status: "unconfirmed", message: "Nevieme, či sa pridalo." })).toBe(false);
	});
});

describe("the form outside the shop's layout", () => {
	it("has no drawer to open and says so with null, where `useCart` would throw", () => {
		function Probe() {
			return createElement("span", null, useOpenCart() === null ? "no drawer" : "drawer");
		}
		expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>no drawer</span>");
	});
});

describe("how the form is wired", () => {
	// The effect itself runs only in a browser; this holds the two lines that connect the outcome to the
	// drawer, so that a refactor which drops one of them fails here and not on the live site.
	const source = readFileSync(path.join(__dirname, "cart-form.tsx"), "utf8");

	it("opens the drawer from an effect on the action's result", () => {
		expect(source).toMatch(
			/useEffect\(\(\) => \{\s*if \(shouldOpenCartAfter\(result\)\) openCart\?\.\(\);\s*\}, \[result, openCart\]\);/,
		);
	});

	it("is the one form every add-to-cart button uses", () => {
		const users = [
			"../pdp/variant-section-dynamic.tsx",
			"./product-card.tsx",
			"./listing-add-to-cart.tsx",
		].map((file) => readFileSync(path.join(__dirname, file), "utf8"));
		for (const file of users) expect(file).toMatch(/<CartForm\b/);
	});
});
