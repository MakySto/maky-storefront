import { describe, expect, it } from "vitest";

import {
	evaluateCode,
	fittingCodes,
	tyreCardFitOf,
	tyreViewOf,
	withPublishedOffer,
	type TyreAnswers,
} from "./choice";
import { tyreFamilyCodes, tyreSizeLabelOf } from "./families";
import { NO_MATCH_ANSWER, tyreQuestionOf } from "./questions";
import { resolveTyreSelection } from "./selection";
import { isManufacturerListSource, tyreSizeIndex, tyreSizeProduct } from "./size-index";
import { isKnownTyreSize, tyreSizeEntries } from "./size-lookup";

const index = tyreSizeIndex();
const products = Object.entries(index.products);

/** The keys of the two questions the pilot products meet. */
const MAKE_KEY = "Continental|Kleber|Michelin";
const DURAVIS = "Bridgestone Duravis Rxxx";

/** A tyre that exists (21-inch rims on an SUV) and that no chain of the list is made for. */
const UNLISTED = "205/40 R21";

describe("one code against one size and what the shopper said about their tyres", () => {
	it("says nothing about a code that is not size-controlled", () => {
		for (const other of ["A7604", "n16061", "", null, undefined, "constructor", "__proto__"]) {
			expect(evaluateCode(other as string | null | undefined, "205/55 R16"), String(other)).toBeNull();
		}
	});

	it("is a yes for a plain row, from the manufacturer's list, with nothing asked", () => {
		expect(evaluateCode("N16061", "145/70 R12")).toEqual({
			kind: "yes",
			fromManufacturerList: true,
			answer: null,
			question: null,
		});
	});

	it("tells the manufacturer's own list from the previous shop's card", () => {
		const supplier = products.find(([, product]) => !isManufacturerListSource(product.source))!;
		const manufacturer = products.find(([, product]) => isManufacturerListSource(product.source))!;
		expect(evaluateCode(manufacturer[0], manufacturer[1].sizes[0][0])).toMatchObject({
			fromManufacturerList: true,
		});
		expect(evaluateCode(supplier[0], supplier[1].sizes[0][0])).toMatchObject({ fromManufacturerList: false });
	});

	it("is a no for a size the code's list does not hold, even when another code's does", () => {
		expect(evaluateCode("N16061", "205/55 R16")).toEqual({ kind: "no" });
		expect(evaluateCode("N16061", UNLISTED)).toEqual({ kind: "no" });
	});

	it("asks when the row carries a condition on the tyres and nothing has been said", () => {
		const result = evaluateCode("N16105", "195/75 R16");
		expect(result).toEqual({
			kind: "ask",
			fromManufacturerList: true,
			question: { key: MAKE_KEY, subject: "make", options: ["Kleber", "Michelin", "Continental"] },
		});
	});

	it("applies the answer: 195/75 R16 goes to N16105 on Kleber, Michelin or Continental, to N16128 on anything else", () => {
		expect(evaluateCode("N16105", "195/75 R16", { [MAKE_KEY]: "Michelin" })).toMatchObject({
			kind: "yes",
			answer: "Michelin",
		});
		expect(evaluateCode("N16105", "195/75 R16", { [MAKE_KEY]: NO_MATCH_ANSWER })).toEqual({ kind: "no" });
		expect(evaluateCode("N16128", "195/75 R16", { [MAKE_KEY]: NO_MATCH_ANSWER })).toMatchObject({
			kind: "yes",
			answer: NO_MATCH_ANSWER,
		});
		expect(evaluateCode("N16128", "195/75 R16", { [MAKE_KEY]: "Michelin" })).toEqual({ kind: "no" });
	});

	it("applies the answer: 215/60 R16 goes to N16128 on a Bridgestone Duravis Rxxx, to N16105 on any other tyre", () => {
		expect(evaluateCode("N16128", "215/60 R16", { [DURAVIS]: DURAVIS })).toMatchObject({
			kind: "yes",
			answer: DURAVIS,
		});
		expect(evaluateCode("N16128", "215/60 R16", { [DURAVIS]: NO_MATCH_ANSWER })).toEqual({ kind: "no" });
		expect(evaluateCode("N16105", "215/60 R16", { [DURAVIS]: NO_MATCH_ANSWER })).toMatchObject({
			kind: "yes",
		});
		expect(evaluateCode("N16105", "215/60 R16", { [DURAVIS]: DURAVIS })).toEqual({ kind: "no" });
	});

	it("keeps an answer to one question out of another: a Michelin is not a Duravis", () => {
		expect(evaluateCode("N16128", "215/60 R16", { [MAKE_KEY]: "Michelin" })).toMatchObject({ kind: "ask" });
		expect(evaluateCode("N16105", "195/75 R16", { [DURAVIS]: NO_MATCH_ANSWER })).toMatchObject({
			kind: "ask",
		});
	});

	it("does not take as an answer what is not one, nor what the object only inherits", () => {
		expect(evaluateCode("N16105", "195/75 R16", { [MAKE_KEY]: "Pirelli" })).toMatchObject({ kind: "ask" });
		expect(evaluateCode("N16105", "195/75 R16", { [MAKE_KEY]: "michelin" })).toMatchObject({ kind: "ask" });
		expect(evaluateCode("N16105", "195/75 R16", { [MAKE_KEY]: "" })).toMatchObject({ kind: "ask" });
		const inherited = Object.create({ [MAKE_KEY]: "Michelin" }) as Record<string, string>;
		expect(evaluateCode("N16105", "195/75 R16", inherited)).toMatchObject({ kind: "ask" });
	});

	it("never says yes where the add-to-cart check would refuse, and never no where it would accept", () => {
		// Every code against every size, with every answer that could be given. The page, the listing and the cards
		// read this function; the server checks the cart line with `resolveTyreSelection`. They are one rule.
		const sizes = new Set(products.flatMap(([, product]) => product.sizes.map(([label]) => label)));
		let checked = 0;
		for (const size of sizes) {
			for (const [code, product] of products) {
				const row = product.sizes.find(([label]) => label === size);
				if (!row || row[2] === "") {
					const evaluation = evaluateCode(code, size);
					const accepted = resolveTyreSelection(code, { mode: "size", size, answer: "" }).ok;
					expect(evaluation?.kind === "yes", `${code} ${size}`).toBe(accepted);
					checked += 1;
					continue;
				}
				const question = tyreQuestionOf(index.conditions[row[2]]);
				expect(evaluateCode(code, size)?.kind, `${code} ${size} unanswered`).toBe("ask");
				for (const answer of [...question.options, NO_MATCH_ANSWER]) {
					const evaluation = evaluateCode(code, size, { [question.key]: answer });
					const accepted = resolveTyreSelection(code, { mode: "size", size, answer }).ok;
					expect(evaluation?.kind === "yes", `${code} ${size} ${answer}`).toBe(accepted);
					expect(evaluation?.kind === "no", `${code} ${size} ${answer}`).toBe(!accepted);
					checked += 1;
				}
			}
		}
		expect(checked).toBeGreaterThan(100_000);
	});
});

describe("what the product page says", () => {
	it("says nothing for a product that is not size-controlled, whatever the size", () => {
		for (const other of ["A7604", null, undefined, "constructor"]) {
			expect(tyreViewOf(other as string | null | undefined, "205/55 R16"), String(other)).toBeNull();
			expect(tyreViewOf(other as string | null | undefined, null), String(other)).toBeNull();
		}
	});

	it("asks for a size when the shopper has told the shop none", () => {
		for (const size of [null, undefined, ""]) expect(tyreViewOf("N16061", size)).toEqual({ kind: "no-size" });
	});

	it("keeps a size the list does not hold apart from a size that does not fit", () => {
		expect(isKnownTyreSize(UNLISTED)).toBe(false);
		expect(tyreViewOf("N16061", UNLISTED)).toEqual({ kind: "unlisted", size: UNLISTED });
		expect(tyreViewOf("N16128", UNLISTED, { [DURAVIS]: NO_MATCH_ANSWER })).toEqual({
			kind: "unlisted",
			size: UNLISTED,
		});
	});

	it("says it fits, and by whose list, when the size is the code's", () => {
		expect(tyreViewOf("N16061", "145/70 R12")).toEqual({
			kind: "fits",
			size: "145/70 R12",
			fromManufacturerList: true,
			answer: null,
			question: null,
		});
	});

	it("asks its one question when the size splits the model between two codes", () => {
		expect(tyreViewOf("N16105", "195/75 R16")).toEqual({
			kind: "ask",
			size: "195/75 R16",
			question: { key: MAKE_KEY, subject: "make", options: ["Kleber", "Michelin", "Continental"] },
		});
		expect(tyreViewOf("N16128", "215/60 R16")).toMatchObject({
			kind: "ask",
			question: { key: DURAVIS, subject: "model", options: [DURAVIS] },
		});
	});

	it("says it fits, and for which tyres, once the question is answered", () => {
		expect(tyreViewOf("N16128", "215/60 R16", { [DURAVIS]: DURAVIS })).toMatchObject({
			kind: "fits",
			answer: DURAVIS,
			question: { subject: "model" },
		});
		expect(tyreViewOf("N16105", "195/75 R16", { [MAKE_KEY]: "Kleber" })).toMatchObject({
			kind: "fits",
			answer: "Kleber",
		});
	});

	it("names the other code of the same model when the answer rules this one out", () => {
		const view = tyreViewOf("N16128", "215/60 R16", { [DURAVIS]: NO_MATCH_ANSWER });
		expect(view).toEqual({
			kind: "other",
			size: "215/60 R16",
			alternatives: [{ code: "N16105", sizeLabel: "22,5", href: null }],
			elsewhere: true,
		});
		const michelin = tyreViewOf("N16128", "195/75 R16", { [MAKE_KEY]: "Michelin" });
		expect(michelin).toMatchObject({ kind: "other", alternatives: [{ code: "N16105" }] });
	});

	it("names the model's other size when this one is not made for the size: a sibling, not 'does not fit'", () => {
		const view = tyreViewOf("N16061", "205/55 R16");
		expect(view?.kind).toBe("other");
		if (view?.kind !== "other") return;
		expect(view.alternatives.map((alt) => alt.code)).toEqual(["N16074"]);
		expect(view.alternatives[0].sizeLabel).toBe(tyreSizeLabelOf("N16074"));
		expect(view.alternatives[0].href).toBeNull();
	});

	it("offers only siblings of the same model that fit the size, never itself, never one the answer rules out", () => {
		for (const [code] of products) {
			for (const size of ["205/55 R16", "195/75 R16", "215/60 R16", "175 R13", "145/70 R12"]) {
				for (const answers of [
					{},
					{ [MAKE_KEY]: "Michelin" },
					{ [MAKE_KEY]: NO_MATCH_ANSWER },
					{ [DURAVIS]: DURAVIS },
				] as TyreAnswers[]) {
					const view = tyreViewOf(code, size, answers);
					if (view?.kind !== "other") continue;
					for (const alt of view.alternatives) {
						expect(alt.code, `${code} ${size}`).not.toBe(code);
						expect(tyreFamilyCodes(code), `${code} ${size}`).toContain(alt.code);
						expect(evaluateCode(alt.code, size, answers)?.kind, `${code} ${size} ${alt.code}`).not.toBe("no");
					}
					expect(evaluateCode(code, size, answers)?.kind, `${code} ${size}`).toBe("no");
				}
			}
		}
	});

	it("names the sibling by its code where the family gives its sizes no name (the socks)", () => {
		const view = tyreViewOf("N17140", "215/60 R16");
		expect(view).toMatchObject({
			kind: "other",
			alternatives: [{ code: "N17143", sizeLabel: "N17143", href: null }],
		});
	});

	it("says it does not fit when no code of the model does, and whether the shop has anything for the size at all", () => {
		// 195/75 R16 exists in the list, but not for the R-9 model: other models of the shop have it.
		expect(
			tyreFamilyCodes("N16061").some(
				(code) => tyreSizeProduct(code)?.sizes.some(([l]) => l === "195/75 R16"),
			),
		).toBe(false);
		expect(tyreViewOf("N16061", "195/75 R16")).toEqual({
			kind: "no-fit",
			size: "195/75 R16",
			elsewhere: true,
		});
	});

	it("does not claim that other chains fit a size when the answer rules out the only one that did", () => {
		// 270/75 R15 is made only for N16119 and only on a Nokian TRI-2.
		expect(tyreSizeEntries("270/75 R15").map((entry) => entry.code)).toEqual(["N16119"]);
		const nokian = "Nokian TRI-2";
		expect(tyreViewOf("N16061", "270/75 R15")).toEqual({
			kind: "no-fit",
			size: "270/75 R15",
			elsewhere: true,
		});
		expect(tyreViewOf("N16061", "270/75 R15", { [nokian]: NO_MATCH_ANSWER })).toEqual({
			kind: "no-fit",
			size: "270/75 R15",
			elsewhere: false,
		});
		expect(tyreViewOf("N16119", "270/75 R15", { [nokian]: NO_MATCH_ANSWER })).toEqual({
			kind: "no-fit",
			size: "270/75 R15",
			elsewhere: false,
		});
		expect(tyreViewOf("N16119", "270/75 R15", { [nokian]: nokian })).toMatchObject({
			kind: "fits",
			answer: nokian,
		});
	});

	it("carries nothing internal into the page", () => {
		for (const [code, product] of products) {
			for (const answers of [{}, { [MAKE_KEY]: "Michelin" }] as TyreAnswers[]) {
				const text = JSON.stringify(tyreViewOf(code, product.sizes[0][0], answers)).toLowerCase();
				expect(text.includes("cfmp"), code).toBe(false);
				expect(text.includes("tazar"), code).toBe(false);
			}
		}
	});
});

describe("the codes a narrowed listing shows", () => {
	it("is every code of the list that holds the size when nothing is conditional", () => {
		expect([...fittingCodes("205/55 R16")].sort()).toEqual(
			tyreSizeEntries("205/55 R16").map((entry) => entry.code),
		);
		expect(fittingCodes("205/55 R16").size).toBe(11);
	});

	it("keeps both codes of a split size while the question is open, so the card can ask it", () => {
		const open = fittingCodes("195/75 R16");
		expect(open.has("N16105")).toBe(true);
		expect(open.has("N16128")).toBe(true);
		expect(open.size).toBe(10);
	});

	it("drops the code an answer rules out", () => {
		const michelin = fittingCodes("195/75 R16", { [MAKE_KEY]: "Michelin" });
		expect(michelin.has("N16105")).toBe(true);
		expect(michelin.has("N16128")).toBe(false);
		const other = fittingCodes("195/75 R16", { [MAKE_KEY]: NO_MATCH_ANSWER });
		expect(other.has("N16105")).toBe(false);
		expect(other.has("N16128")).toBe(true);
		expect(other.size).toBe(9);
	});

	it("holds nothing for a size the list does not hold", () => {
		expect(fittingCodes(UNLISTED).size).toBe(0);
	});

	it("can come out empty for a size the list holds, when the answer rules out its only code", () => {
		expect(fittingCodes("270/75 R15").size).toBe(1);
		expect(fittingCodes("270/75 R15", { "Nokian TRI-2": NO_MATCH_ANSWER }).size).toBe(0);
	});

	it("is exactly the codes the product page does not call 'no fit' or 'other'", () => {
		for (const size of ["205/55 R16", "195/75 R16", "215/60 R16", "145/70 R12", "270/75 R15"]) {
			for (const answers of [
				{},
				{ [MAKE_KEY]: "Michelin" },
				{ [DURAVIS]: NO_MATCH_ANSWER },
			] as TyreAnswers[]) {
				const shown = fittingCodes(size, answers);
				for (const [code] of products) {
					const view = tyreViewOf(code, size, answers);
					const holds = view?.kind === "fits" || view?.kind === "ask";
					expect(shown.has(code), `${code} ${size}`).toBe(holds);
				}
			}
		}
	});
});

describe("what a listing card says", () => {
	it("says nothing for a card that is not size-controlled", () => {
		expect(tyreCardFitOf("A7604", "205/55 R16")).toBeNull();
		expect(tyreCardFitOf(null, "205/55 R16")).toBeNull();
		expect(tyreCardFitOf(undefined, "205/55 R16")).toBeNull();
	});

	it("says 'fits' alike on the manufacturer's list and on the previous shop's card (owner, 2026-11-07)", () => {
		const manufacturer = products.find(([, product]) => isManufacturerListSource(product.source))!;
		const supplier = products.find(([, product]) => !isManufacturerListSource(product.source))!;
		const plain = (product: (typeof products)[number][1]) =>
			product.sizes.find(([, , condition]) => condition === "")![0];
		expect(tyreCardFitOf(manufacturer[0], plain(manufacturer[1]))).toEqual({
			size: plain(manufacturer[1]),
			kind: "fits",
			answer: null,
		});
		expect(tyreCardFitOf(supplier[0], plain(supplier[1]))).toEqual({
			size: plain(supplier[1]),
			kind: "fits",
			answer: null,
		});
	});

	it("asks while the question is open, and says fits or no-fit once it is answered", () => {
		expect(tyreCardFitOf("N16105", "195/75 R16")).toEqual({ size: "195/75 R16", kind: "ask" });
		// The answer that decided it travels with the verdict: the card's add sends it back to the server.
		expect(tyreCardFitOf("N16105", "195/75 R16", { [MAKE_KEY]: "Kleber" })).toEqual({
			size: "195/75 R16",
			kind: "fits",
			answer: "Kleber",
		});
		expect(tyreCardFitOf("N16105", "195/75 R16", { [MAKE_KEY]: NO_MATCH_ANSWER })).toEqual({
			size: "195/75 R16",
			kind: "no-fit",
		});
	});

	it("says no-fit for a size the code's list does not hold", () => {
		expect(tyreCardFitOf("N16061", "205/55 R16")).toEqual({ size: "205/55 R16", kind: "no-fit" });
	});
});

describe("a card's one-click add and the server", () => {
	// The card adds with the pair it shows (its size, and the answer that decided it). The server checks that pair against
	// the product's own list again, so a card that said "fits" must never be refused, and a card that said anything else
	// must never have its pair accepted: the card's button cannot promise what the server will not do.
	const SIZES = [
		"205/55 R16",
		"195/75 R16",
		"215/60 R16",
		"145/70 R12",
		"270/75 R15",
		"165/75 R14",
		UNLISTED,
	];
	const ANSWER_SETS: TyreAnswers[] = [
		{},
		{ [MAKE_KEY]: "Michelin" },
		{ [MAKE_KEY]: NO_MATCH_ANSWER },
		{ [DURAVIS]: NO_MATCH_ANSWER },
	];

	it("is accepted for every product, size and answer where the card says fits, whichever list holds the size", () => {
		let checked = 0;
		for (const size of SIZES) {
			for (const answers of ANSWER_SETS) {
				for (const [code] of products) {
					const fit = tyreCardFitOf(code, size, answers);
					if (fit?.kind !== "fits") continue;
					const refused = resolveTyreSelection(code, {
						mode: "size",
						size: fit.size,
						answer: fit.answer ?? "",
					});
					expect(refused.ok, `${code} ${size} ${JSON.stringify(answers)}`).toBe(true);
					checked += 1;
				}
			}
		}
		expect(checked).toBeGreaterThan(100);
	});

	it("is refused for every product, size and answer where the card does not say fits", () => {
		for (const size of SIZES) {
			for (const answers of ANSWER_SETS) {
				for (const [code] of products) {
					const fit = tyreCardFitOf(code, size, answers);
					if (!fit || fit.kind === "fits") continue;
					const result = resolveTyreSelection(code, { mode: "size", size, answer: "" });
					expect(result.ok, `${code} ${size} ${fit.kind}`).toBe(false);
				}
			}
		}
	});

	it("carries the previous shop's products too: a held size is a fit, with no warning kind left to say otherwise", () => {
		const supplier = products.filter(([, product]) => !isManufacturerListSource(product.source));
		expect(supplier.length).toBeGreaterThan(0);
		for (const [code, product] of supplier) {
			const [size, , condition] = product.sizes[0];
			const fit = tyreCardFitOf(code, size);
			expect(fit, code).toEqual(
				condition === "" ? { size, kind: "fits", answer: null } : { size, kind: "ask" },
			);
		}
	});
});

describe("the verdict once the shop's own offer is known", () => {
	// The three chains and socks the shop publishes today.
	const PUBLISHED = new Set(["N16061", "N16128", "N17140"]);

	it("keeps 'other chains fit' while a chain the shop sells is made for the size", () => {
		// 195/75 R16 is not made for N16061; it is for N16128 (depending on the tyres), and N16128 is on sale.
		const view = tyreViewOf("N16061", "195/75 R16")!;
		expect(view).toEqual({ kind: "no-fit", size: "195/75 R16", elsewhere: true });
		expect(withPublishedOffer(view, PUBLISHED)).toEqual(view);
	});

	it("takes it back when only codes the shop does not sell are made for the size", () => {
		// 270/75 R15 is made for N16119 only, which is not on sale.
		const view = tyreViewOf("N16061", "270/75 R15")!;
		expect(view).toEqual({ kind: "no-fit", size: "270/75 R15", elsewhere: true });
		expect(withPublishedOffer(view, PUBLISHED)).toEqual({
			kind: "no-fit",
			size: "270/75 R15",
			elsewhere: false,
		});
		expect(withPublishedOffer(view, new Set())).toMatchObject({ elsewhere: false });
	});

	it("reads the shopper's answer into the offer: a chain the answer rules out is not on offer", () => {
		const answers: TyreAnswers = { [MAKE_KEY]: "Michelin" };
		const view = tyreViewOf("N16061", "195/75 R16", answers)!;
		// On Michelin tyres the chain made for the size is N16105, not N16128.
		expect(view).toEqual({ kind: "no-fit", size: "195/75 R16", elsewhere: true });
		expect(withPublishedOffer(view, PUBLISHED, answers)).toMatchObject({ elsewhere: false });
		expect(withPublishedOffer(view, new Set([...PUBLISHED, "N16105"]), answers)).toMatchObject({
			elsewhere: true,
		});
	});

	it("leaves the verdict as the lists gave it when the shop's offer could not be read", () => {
		const view = tyreViewOf("N16061", "270/75 R15")!;
		expect(withPublishedOffer(view, null)).toBe(view);
	});

	it("promises nothing for 'the right size is another code of the model' when the shop sells no chain for the size", () => {
		// 205/55 R16 is made for N16074, the sibling of N16061; N16074 is not published, and neither is any other holder.
		const view = tyreViewOf("N16061", "205/55 R16")!;
		expect(view).toMatchObject({ kind: "other", elsewhere: true });
		expect(withPublishedOffer(view, new Set(["N16061"]))).toMatchObject({ kind: "other", elsewhere: false });
		// A published holder of the size keeps the promise.
		expect(withPublishedOffer(view, new Set(["N16061", "N16074"]))).toBe(view);
	});

	it("touches no other verdict", () => {
		const views = [
			tyreViewOf("N16061", null),
			tyreViewOf("N16061", UNLISTED),
			tyreViewOf("N16061", "145/70 R12"),
			tyreViewOf("N16128", "215/60 R16"),
			{ kind: "no-fit", size: "270/75 R15", elsewhere: false } as const,
		];
		for (const view of views) expect(withPublishedOffer(view!, new Set())).toBe(view);
	});
});
