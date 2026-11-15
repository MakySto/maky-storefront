import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { activateTyreLists, activeTyreLists, perTyreLists, resetTyreListsToBuild } from "./active-lists";
import { fittingCodes } from "./choice";
import { tyreFamilyOf } from "./families";
import { tyreFamiliesSeal, type TyreFamiliesFile } from "./families-file";
import { resolveTyreSelection } from "./selection";
import { tyreSizeIndex, tyreSizeListId, tyreSizeProduct } from "./size-index";
import { tyreSizeIndexSeal } from "./size-index-file";
import { isKnownTyreSize, tyreSizeEntries, tyreSteps } from "./size-lookup";
import { tyreFamilyPages, tyrePageOf, tyreSizePageOf, tyreSizePages } from "./size-pages";

/**
 * The pair of lists the shop serves can be replaced while it runs, and everything that reads it follows.
 *
 * The owner's rule (2026-11-15): what is switched off in CFM goes off on the shop by itself. The lists used to be an
 * import, fixed for the life of a build, so a size CFM had removed stayed in the selector and was accepted into the
 * cart until a deploy. These cases replace the pair the way a release will and ask the readers a shopper meets.
 *
 *   1. A process starts on the build's own copy.
 *   2. A row CFM removed is gone from the selector, from the server's check and from the pages, at once.
 *   3. A pair that is not one pair, was changed after sealing or is older than what is served changes nothing.
 *   4. Which sizes have a page, and what a model is called, are CFM's to say once its files say it.
 */

const DATA = join(__dirname, "data");
type RawIndex = {
	products: Record<string, { sizes: [string, string, string][]; source: string }>;
	counts: { sizes: number; products: number; conditional_products: number; conditions: number };
	self_sha256: string;
	id: string;
	pages?: string[];
};
type RawFamilies = TyreFamiliesFile & { self_sha256: string };

const buildIndex = (): RawIndex =>
	JSON.parse(readFileSync(join(DATA, "velkosti_20261105.json"), "utf8")) as RawIndex;
const buildFamilies = (): RawFamilies =>
	JSON.parse(readFileSync(join(DATA, "rodiny_20261105.json"), "utf8")) as RawFamilies;

/** Seal a list the way its producer does, after a test changed it. */
const sealedIndex = (index: RawIndex): RawIndex => ({ ...index, self_sha256: tyreSizeIndexSeal(index) });
const sealedFamilies = (families: RawFamilies): RawFamilies => ({
	...families,
	self_sha256: tyreFamiliesSeal(families),
});

/** The build's list without one row of one code, as CFM publishes it after a card was switched off. */
function withoutRow(code: string, size: string): RawIndex {
	const index = buildIndex();
	const before = index.products[code].sizes.length;
	index.products[code].sizes = index.products[code].sizes.filter(([label]) => label !== size);
	expect(index.products[code].sizes.length).toBe(before - 1);
	index.counts.sizes -= 1;
	return sealedIndex(index);
}

afterEach(() => {
	resetTyreListsToBuild();
});

describe("the pair a process starts on", () => {
	it("is the build's own copy, checked as a pair", () => {
		const lists = activeTyreLists();
		expect(lists.source).toEqual({ kind: "build" });
		expect(lists.seals.index).toBe(buildIndex().self_sha256);
		expect(lists.seals.families).toBe(buildFamilies().self_sha256);
		expect(lists.index.counts.products).toBe(145);
		expect(tyreSizeListId()).toBe("snehove-retaze-20261105");
	});

	it("is one object until it is replaced, so a reader that took it works on one list", () => {
		expect(activeTyreLists()).toBe(activeTyreLists());
		expect(tyreSizeIndex()).toBe(activeTyreLists().index);
	});
});

describe("a row CFM removed", () => {
	// D0245 holds `225/60 R17`; it is the code whose `650/17 R17` the owner switched off on 2026-11-15.
	const CODE = "D0245";
	const SIZE = "225/60 R17";

	it("was offered and accepted before", () => {
		expect(tyreSizeProduct(CODE)?.sizes.some(([label]) => label === SIZE)).toBe(true);
		expect(fittingCodes(SIZE).has(CODE)).toBe(true);
		expect(resolveTyreSelection(CODE, { mode: "size", size: SIZE, answer: "" }).ok).toBe(true);
	});

	it("is gone from the verdict and refused by the server's check as soon as the pair is replaced", () => {
		const result = activateTyreLists(withoutRow(CODE, SIZE), buildFamilies(), 1);
		expect(result).toMatchObject({ ok: true, changed: true });
		expect(activeTyreLists().source).toEqual({ kind: "release", release: 1 });

		expect(tyreSizeProduct(CODE)?.sizes.some(([label]) => label === SIZE)).toBe(false);
		expect(fittingCodes(SIZE).has(CODE)).toBe(false);
		expect(tyreSizeEntries(SIZE).some((entry) => entry.code === CODE)).toBe(false);
		expect(resolveTyreSelection(CODE, { mode: "size", size: SIZE, answer: "" }).ok).toBe(false);
		// The other codes of that size, and the other sizes of that code, are untouched.
		expect(fittingCodes(SIZE).size).toBeGreaterThan(0);
		expect(resolveTyreSelection(CODE, { mode: "size", size: "235/70 R15", answer: "" }).ok).toBe(true);
		expect(tyreSizeIndex().counts.sizes).toBe(buildIndex().counts.sizes - 1);
	});

	it("takes its size out of the selector and off the pages when no other code has it", () => {
		// Remove a size from every code that has it: it then is no size of the list at all.
		const index = buildIndex();
		const size = "120/80 R12";
		let removed = 0;
		for (const product of Object.values(index.products)) {
			const kept = product.sizes.filter(([label]) => label !== size);
			removed += product.sizes.length - kept.length;
			product.sizes = kept;
		}
		expect(removed).toBeGreaterThan(0);
		index.counts.sizes -= removed;
		expect(isKnownTyreSize(size)).toBe(true);
		expect(tyreSteps().widths.some((width) => width.value === 120)).toBe(true);

		expect(activateTyreLists(sealedIndex(index), buildFamilies(), 1).ok).toBe(true);
		expect(isKnownTyreSize(size)).toBe(false);
		expect(tyreSizeEntries(size)).toEqual([]);
		// `120/80 R10` is still a row, so the width is still offered; the rim that went with the removed size is not.
		expect(tyreSteps(120, 80).rims).toEqual(["10"]);
	});

	it("comes back with the build's copy when the process is reset", () => {
		activateTyreLists(withoutRow(CODE, SIZE), buildFamilies(), 1);
		resetTyreListsToBuild();
		expect(fittingCodes(SIZE).has(CODE)).toBe(true);
		expect(activeTyreLists().source).toEqual({ kind: "build" });
	});
});

describe("a pair that must not be served", () => {
	const refused = (index: unknown, families: unknown, release = 1) => {
		const before = activeTyreLists();
		const result = activateTyreLists(index, families, release);
		expect(result.ok).toBe(false);
		// Nothing changed: the very same pair object is still being served.
		expect(activeTyreLists()).toBe(before);
		return result.ok ? "" : result.reason;
	};

	it("a list changed after it was sealed", () => {
		const index = buildIndex();
		index.products.D0245.sizes.pop();
		index.counts.sizes -= 1;
		expect(refused(index, buildFamilies())).toMatch(/seal/);
	});

	it("a list whose own counts do not add up", () => {
		const index = buildIndex();
		index.products.D0245.sizes.pop();
		expect(refused(sealedIndex(index), buildFamilies())).toMatch(/counts/);
	});

	it("families of another list", () => {
		const families = buildFamilies();
		families.id = "snehove-retaze-20270101";
		expect(refused(buildIndex(), sealedFamilies(families))).toMatch(/is not the size list/);
	});

	it("families changed after they were sealed", () => {
		const families = buildFamilies();
		families.families["dac-blue-ice"].label = "DAC";
		expect(refused(buildIndex(), families)).toMatch(/seal/);
	});

	it("a list with a code the families do not know, and families with a code the list does not have", () => {
		const index = buildIndex();
		index.products.X9999 = { sizes: [["205/55 R16", "16", ""]], source: index.products.D0245.source };
		index.counts.sizes += 1;
		index.counts.products += 1;
		expect(refused(sealedIndex(index), buildFamilies())).toMatch(
			/X9999 is in the size list and has no family/,
		);

		const families = buildFamilies();
		families.products.X9999 = { family: "dac-blue-ice", size: null };
		expect(refused(buildIndex(), sealedFamilies(families))).toMatch(/X9999 is not in the size list/);
	});

	it("something that is not a list at all", () => {
		expect(refused(null, buildFamilies())).toMatch(/not an object/);
		expect(refused(buildIndex(), null)).not.toBe("");
		expect(refused("<html>502</html>", "<html>502</html>")).not.toBe("");
	});

	it("a release counter that is not one", () => {
		for (const release of [0, -1, 1.5, Number.NaN]) {
			expect(refused(buildIndex(), buildFamilies(), release), String(release)).toMatch(/release/);
		}
	});

	it("an older release than the one being served: a late answer must not bring a removed size back", () => {
		expect(activateTyreLists(withoutRow("D0245", "225/60 R17"), buildFamilies(), 7).ok).toBe(true);
		expect(refused(buildIndex(), buildFamilies(), 6)).toMatch(/older/);
		expect(fittingCodes("225/60 R17").has("D0245")).toBe(false);
	});
});

describe("activating again", () => {
	it("is not a change for the same release with the same two files", () => {
		const first = activateTyreLists(buildIndex(), buildFamilies(), 3);
		expect(first).toMatchObject({ ok: true, changed: true });
		const served = activeTyreLists();
		const again = activateTyreLists(buildIndex(), buildFamilies(), 3);
		expect(again).toMatchObject({ ok: true, changed: false });
		expect(activeTyreLists()).toBe(served);
	});

	it("takes a newer release", () => {
		activateTyreLists(buildIndex(), buildFamilies(), 3);
		expect(activateTyreLists(withoutRow("D0245", "225/60 R17"), buildFamilies(), 4)).toMatchObject({
			ok: true,
			changed: true,
		});
		expect(activeTyreLists().source).toEqual({ kind: "release", release: 4 });
	});
});

describe("what is computed from the pair", () => {
	it("is computed once per pair and again for the pair that replaces it", () => {
		let builds = 0;
		const count = perTyreLists(({ index }) => {
			builds += 1;
			return { sizes: index.counts.sizes };
		});
		expect(count().sizes).toBe(buildIndex().counts.sizes);
		count();
		expect(builds).toBe(1);

		activateTyreLists(withoutRow("D0245", "225/60 R17"), buildFamilies(), 1);
		expect(count().sizes).toBe(buildIndex().counts.sizes - 1);
		count();
		expect(builds).toBe(2);
	});
});

describe("which sizes have a page, once CFM says", () => {
	it("is the shop's own rule while the list does not say", () => {
		expect(activeTyreLists().index.pages).toBeUndefined();
		expect(tyreSizePages()).toHaveLength(860);
		expect(tyreSizePageOf("120/80 R10")).toBeNull();
	});

	it("is exactly what the list names, and the shop's own range no longer decides", () => {
		const index = buildIndex();
		index.pages = ["120/80 R10", "205/55 R16", "205/60 R16"];
		expect(activateTyreLists(sealedIndex(index), buildFamilies(), 1).ok).toBe(true);

		expect(tyreSizePages().map((page) => page.label)).toEqual(["120/80 R10", "205/55 R16", "205/60 R16"]);
		// A size the shop's own range kept out is a page because CFM named it...
		expect(tyrePageOf(["120-80-r10"])?.kind).toBe("size");
		// ...and a size the shop's own rule would have made a page is none, because CFM did not.
		expect(tyreSizePageOf("195/65 R15")).toBeNull();
		expect(tyrePageOf(["195-65-r15"])).toBeNull();
		// The size itself is still a size of the list: the selector and the cart answer for it.
		expect(isKnownTyreSize("195/65 R15")).toBe(true);
	});

	it("gives no address to a named size the shop cannot spell one for", () => {
		const index = buildIndex();
		index.pages = ["175 R13", "205/55 R16"];
		expect(activateTyreLists(sealedIndex(index), buildFamilies(), 1).ok).toBe(true);
		expect(tyreSizePages().map((page) => page.label)).toEqual(["205/55 R16"]);
	});

	it("refuses a list that names a page for a size it does not hold, or names one twice", () => {
		const unknown = buildIndex();
		unknown.pages = ["205/60 R99"];
		expect(activateTyreLists(sealedIndex(unknown), buildFamilies(), 1)).toMatchObject({ ok: false });
		const twice = buildIndex();
		twice.pages = ["205/55 R16", "205/55 R16"];
		expect(activateTyreLists(sealedIndex(twice), buildFamilies(), 1)).toMatchObject({ ok: false });
		expect(activeTyreLists().source).toEqual({ kind: "build" });
	});
});

describe("what a model is called, once CFM says", () => {
	const page = (key: string) => tyreFamilyPages().find((family) => family.key === key);

	it("is the label without its Slovak noun while the file gives no name", () => {
		expect(tyreFamilyOf("D0245")?.name).toBeNull();
		expect(page("snowdrive-ponozky")?.name).toBe("SnowDrive");
	});

	it("is the file's own name, printed as given", () => {
		const families = buildFamilies();
		families.families["snowdrive-ponozky"].name = "SnowDrive Textile";
		families.families["dac-blue-ice"].name = "DAC Blue ICE MIS";
		expect(activateTyreLists(buildIndex(), sealedFamilies(families), 1).ok).toBe(true);
		expect(page("snowdrive-ponozky")?.name).toBe("SnowDrive Textile");
		expect(page("dac-blue-ice")?.name).toBe("DAC Blue ICE MIS");
		// A family the file gives no name keeps the rule it had.
		expect(page("gran-pree-ponozky")?.name).toBe("Gran Pree");
	});

	it("refuses a file with an empty name", () => {
		const families = buildFamilies();
		families.families["dac-blue-ice"].name = " ";
		expect(activateTyreLists(buildIndex(), sealedFamilies(families), 1)).toMatchObject({ ok: false });
	});
});
