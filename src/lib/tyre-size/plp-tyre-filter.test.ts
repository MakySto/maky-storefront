import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The snow-chain listing's tyre filter, and the ways it could lie.
 *
 * The sizes and the codes are the sealed list's own (`velkosti_20261105.json`): nothing is invented here but the
 * shop's side, which is what the shelf scan would have returned (which Saleor products carry which code).
 *
 *   1. `filter: { ids: [] }` returns the WHOLE catalogue, not nothing: "nothing fits" is spelled with the sentinel.
 *   2. A default must not be a dead end: a size nothing on the shelf lists leaves the shelf whole, and says so.
 *   3. `?tyres=0` is the shopper's own word and nothing overrides it.
 *   4. Not being able to ask the shop is not the same as nothing fitting: the listing is left alone.
 *   5. Only what the shop lists is ever named: a code that fits the size but is not on the shelf is not promised.
 */

const { readRememberedTyreSize, getShelfCodes } = vi.hoisted(() => ({
	readRememberedTyreSize: vi.fn(),
	getShelfCodes: vi.fn(),
}));

vi.mock("./remembered", () => ({ readRememberedTyreSize }));
vi.mock("@/lib/listing/shelf-codes", () => ({ getShelfCodes }));

import { NO_PRODUCTS_SENTINEL_ID } from "@/lib/fitment/plp-vehicle-filter";
import { TYRE_SHELF_SLUG } from "@/config/tyre-shelves";
import { buildFilterVariables } from "@/ui/components/plp/filter-utils";
import { resolveTyreListingFilter, tyreFilterIds, tyreFilterSize } from "./plp-tyre-filter";
import { tyreSizeEntries } from "./size-lookup";

const SCOPE = { categorySlug: TYRE_SHELF_SLUG, channel: "sk-eur" };

/** The shop's side: three pilot-like products, each with its own Saleor id. */
const SHELF = [
	{ code: "N16061", productId: "gid-n16061" },
	{ code: "N16128", productId: "gid-n16128" },
	{ code: "N17140", productId: "gid-n17140" },
];

beforeEach(() => {
	readRememberedTyreSize.mockReset().mockResolvedValue("215/70 R15");
	getShelfCodes.mockReset().mockResolvedValue(SHELF);
});

describe("which shelf it answers for", () => {
	it("says nothing, and reads nothing, on a shelf the sizes do not belong to", async () => {
		for (const categorySlug of ["stresne-nosice", "stresne-boxy", "nosice-bicyklov", "", undefined]) {
			expect(await resolveTyreListingFilter("default", { categorySlug, channel: "sk-eur" })).toEqual({
				state: "out-of-scope",
			});
		}
		expect(readRememberedTyreSize).not.toHaveBeenCalled();
		expect(getShelfCodes).not.toHaveBeenCalled();
	});
});

describe("with no size remembered", () => {
	it("does not narrow, and says whether the shopper asked for the narrowed list", async () => {
		readRememberedTyreSize.mockResolvedValue(null);
		expect(await resolveTyreListingFilter("default", SCOPE)).toEqual({ state: "no-size", requested: false });
		expect(await resolveTyreListingFilter("tyres", SCOPE)).toEqual({ state: "no-size", requested: true });
		expect(await resolveTyreListingFilter("all", SCOPE)).toEqual({ state: "no-size", requested: false });
		expect(getShelfCodes).not.toHaveBeenCalled();
	});
});

describe("with a size remembered", () => {
	it("narrows by itself to the products whose list holds the size, and names only what the shop lists", async () => {
		// 215/70 R15 is in N16128's list and not in N16061's or N17140's.
		const fitting = tyreSizeEntries("215/70 R15").map((entry) => entry.code);
		expect(fitting).toContain("N16128");
		expect(fitting).not.toContain("N16061");

		const filter = await resolveTyreListingFilter("default", SCOPE);
		expect(filter).toEqual({ state: "active", size: "215/70 R15", productIds: ["gid-n16128"] });
		expect(getShelfCodes).toHaveBeenCalledWith(TYRE_SHELF_SLUG, "sk-eur");
		// Many codes fit this size; only the one the shop lists is a product the listing can name.
		expect(fitting.length).toBeGreaterThan(1);
	});

	it("narrows the same way when the shopper asked for it", async () => {
		expect(await resolveTyreListingFilter("tyres", SCOPE)).toMatchObject({ state: "active" });
	});

	it("honours an explicit 'all chains' without asking the shop anything", async () => {
		expect(await resolveTyreListingFilter("all", SCOPE)).toEqual({
			state: "offered",
			size: "215/70 R15",
			reason: "all",
		});
		expect(getShelfCodes).not.toHaveBeenCalled();
	});

	it("names a product once, whatever the shop's map holds", async () => {
		getShelfCodes.mockResolvedValue([...SHELF, { code: "N16128", productId: "gid-n16128" }]);
		expect(await resolveTyreListingFilter("default", SCOPE)).toMatchObject({ productIds: ["gid-n16128"] });
	});

	it("leaves the shelf whole, and says why, when nothing the shop lists fits the size by default", async () => {
		// 205/55 R16 is in none of the three.
		readRememberedTyreSize.mockResolvedValue("205/55 R16");
		const filter = await resolveTyreListingFilter("default", SCOPE);
		expect(filter).toEqual({ state: "offered", size: "205/55 R16", reason: "none-fit" });
		expect(tyreFilterIds(filter)).toBeUndefined();
	});

	it("gives the explicit request for such a size its own answer, spelled out loud", async () => {
		readRememberedTyreSize.mockResolvedValue("205/55 R16");
		const filter = await resolveTyreListingFilter("tyres", SCOPE);
		expect(filter).toEqual({ state: "empty", size: "205/55 R16" });
		// Never `ids: []`, which would be the whole catalogue.
		expect(tyreFilterIds(filter)).toEqual([NO_PRODUCTS_SENTINEL_ID]);
		expect(buildFilterVariables({ vehicleProductIds: tyreFilterIds(filter) })).toEqual({
			ids: [NO_PRODUCTS_SENTINEL_ID],
		});
	});

	it("hands the listing exactly the active ids, and nothing in any state that does not narrow", async () => {
		expect(tyreFilterIds(await resolveTyreListingFilter("default", SCOPE))).toEqual(["gid-n16128"]);
		expect(tyreFilterIds({ state: "out-of-scope" })).toBeUndefined();
		expect(tyreFilterIds({ state: "unavailable", size: "205/55 R16" })).toBeUndefined();
		expect(tyreFilterIds({ state: "no-size", requested: true })).toBeUndefined();
		expect(tyreFilterIds({ state: "offered", size: "205/55 R16", reason: "all" })).toBeUndefined();
	});
});

describe("when the shop cannot be asked", () => {
	it("does not narrow and does not claim anything: an outage is not 'nothing fits'", async () => {
		getShelfCodes.mockRejectedValue(new Error("saleor down"));
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const filter = await resolveTyreListingFilter("tyres", SCOPE);
		expect(filter).toEqual({ state: "unavailable", size: "215/70 R15" });
		expect(tyreFilterIds(filter)).toBeUndefined();
		// The cards still say whether they fit the size.
		expect(tyreFilterSize(filter)).toBe("215/70 R15");
		error.mockRestore();
	});

	it("does not narrow when the shelf is too large to read whole", async () => {
		getShelfCodes.mockResolvedValue(null);
		expect(await resolveTyreListingFilter("default", SCOPE)).toEqual({
			state: "unavailable",
			size: "215/70 R15",
		});
	});
});

describe("the size the cards speak of", () => {
	it("is the remembered size in every state that knows it, and none otherwise", () => {
		expect(tyreFilterSize({ state: "active", size: "a", productIds: ["x"] })).toBe("a");
		expect(tyreFilterSize({ state: "empty", size: "b" })).toBe("b");
		expect(tyreFilterSize({ state: "offered", size: "c", reason: "all" })).toBe("c");
		expect(tyreFilterSize({ state: "unavailable", size: null })).toBeNull();
		expect(tyreFilterSize({ state: "no-size", requested: false })).toBeNull();
		expect(tyreFilterSize({ state: "out-of-scope" })).toBeNull();
	});
});
