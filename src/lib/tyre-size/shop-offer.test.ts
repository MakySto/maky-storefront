import { describe, expect, it } from "vitest";

import { tyreViewOf } from "./choice";
import { NO_MATCH_ANSWER } from "./questions";
import { applyShopOffer, type ShopCode } from "./shop-offer";

const hrefOf = (slug: string) => `/sk/${slug}`;

/** The three chains and socks the shop publishes today, as the shelf's code list gives them. */
const SHELF: readonly ShopCode[] = [
	{ code: "N16061", slug: "retaze-n16061" },
	{ code: "N16128", slug: "retaze-n16128" },
	{ code: "N17140", slug: "ponozky-n17140" },
];

const DURAVIS = "Bridgestone Duravis Rxxx";
const MAKE_KEY = "Continental|Kleber|Michelin";

describe("another size of the same model", () => {
	// The answer "other tyres" rules N16128 out for 215/60 R16, and the model's other code is N16105.
	const view = () => tyreViewOf("N16128", "215/60 R16", { [DURAVIS]: NO_MATCH_ANSWER })!;

	it("is linked only when the shop publishes that code, to the page the shop gives it", () => {
		const shelf = [...SHELF, { code: "N16105", slug: "retaze-n16105" }];
		const out = applyShopOffer(view(), shelf, { [DURAVIS]: NO_MATCH_ANSWER }, hrefOf);
		expect(out).toMatchObject({
			kind: "other",
			elsewhere: true,
			alternatives: [{ code: "N16105", href: "/sk/retaze-n16105" }],
		});
	});

	it("is not linked when the shop does not publish it, and does not promise other chains it does not have", () => {
		const out = applyShopOffer(view(), SHELF, { [DURAVIS]: NO_MATCH_ANSWER }, hrefOf);
		expect(out).toMatchObject({ kind: "other", alternatives: [{ code: "N16105", href: null }] });
		// 215/60 R16 on any other tyre: no published code besides the one the answer ruled out.
		expect(out).toMatchObject({ elsewhere: false });
	});

	it("keeps the promise of other chains while a published one fits the size", () => {
		// Published N16061 holds 205/55 R16; its sibling N16074 does too, but is not published.
		const sibling = tyreViewOf("N16061", "205/55 R16")!;
		expect(sibling).toMatchObject({ kind: "other", alternatives: [{ code: "N16074" }] });
		const out = applyShopOffer(sibling, SHELF, {}, hrefOf);
		expect(out).toMatchObject({ kind: "other", alternatives: [{ code: "N16074", href: null }] });
	});

	it("leaves every link absent when the shop's list could not be read, and the offer as the lists gave it", () => {
		const out = applyShopOffer(view(), null, { [DURAVIS]: NO_MATCH_ANSWER }, hrefOf);
		expect(out).toMatchObject({ kind: "other", elsewhere: true, alternatives: [{ href: null }] });
	});
});

describe("a size the product does not fit", () => {
	it("keeps 'other chains fit' while a chain the shop sells is made for the size", () => {
		const view = tyreViewOf("N16061", "195/75 R16")!;
		expect(applyShopOffer(view, SHELF, {}, hrefOf)).toEqual({
			kind: "no-fit",
			size: "195/75 R16",
			elsewhere: true,
		});
	});

	it("says nothing is on offer when only codes the shop does not sell are made for the size", () => {
		const view = tyreViewOf("N16061", "270/75 R15")!;
		expect(view).toMatchObject({ kind: "no-fit", elsewhere: true });
		expect(applyShopOffer(view, SHELF, {}, hrefOf)).toEqual({
			kind: "no-fit",
			size: "270/75 R15",
			elsewhere: false,
		});
	});

	it("reads the shopper's answer into the offer", () => {
		const answers = { [MAKE_KEY]: "Michelin" };
		const view = tyreViewOf("N16061", "195/75 R16", answers)!;
		// On Michelin tyres the chain made for the size is N16105, which the shop does not publish.
		expect(applyShopOffer(view, SHELF, answers, hrefOf)).toMatchObject({ elsewhere: false });
		expect(
			applyShopOffer(view, [...SHELF, { code: "N16105", slug: "retaze-n16105" }], answers, hrefOf),
		).toMatchObject({
			elsewhere: true,
		});
	});

	it("leaves the verdict as the lists gave it when the shop's list could not be read", () => {
		const view = tyreViewOf("N16061", "270/75 R15")!;
		expect(applyShopOffer(view, null, {}, hrefOf)).toBe(view);
	});
});

describe("every other verdict", () => {
	it("is returned as it is, without looking at the shop", () => {
		const views = [
			tyreViewOf("N16061", null),
			tyreViewOf("N16061", "205/40 R21"),
			tyreViewOf("N16061", "145/70 R12"),
			tyreViewOf("N16128", "215/60 R16"),
		];
		for (const view of views) expect(applyShopOffer(view!, [], {}, hrefOf)).toBe(view);
	});
});
