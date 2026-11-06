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
 *   6. A size the lists do not hold is not "nothing fits": the shop cannot say, and says so.
 *   7. What the shopper said about their tyres narrows the list, and only their own size's answers are used.
 */

const { readRememberedTyre, getShelfCodes } = vi.hoisted(() => ({
	readRememberedTyre: vi.fn(),
	getShelfCodes: vi.fn(),
}));

vi.mock("./remembered", () => ({ readRememberedTyre }));
vi.mock("@/lib/listing/shelf-codes", () => ({ getShelfCodes }));

import { NO_PRODUCTS_SENTINEL_ID } from "@/lib/fitment/plp-vehicle-filter";
import { TYRE_SHELF_SLUG } from "@/config/tyre-shelves";
import { buildFilterVariables } from "@/ui/components/plp/filter-utils";
import {
	resolveTyreListingFilter,
	tyreFilterAnswers,
	tyreFilterIds,
	tyreFilterSize,
} from "./plp-tyre-filter";
import { tyreSizeEntries } from "./size-lookup";

const SCOPE = { categorySlug: TYRE_SHELF_SLUG, channel: "sk-eur" };
const MAKE_KEY = "Continental|Kleber|Michelin";
const UNLISTED = "205/40 R21";

/** The shop's side: the three pilot products and N16105, each with its own Saleor id. */
const SHELF = [
	{ code: "N16061", productId: "gid-n16061", slug: "r9-1" },
	{ code: "N16128", productId: "gid-n16128", slug: "s16-22-7" },
	{ code: "N17140", productId: "gid-n17140", slug: "ponozky-56" },
	{ code: "N16105", productId: "gid-n16105", slug: "s16-22-5" },
];

const remembered = (size: string, answers: Record<string, string> = {}) => ({
	size,
	answers,
	forThisVehicle: false,
});

beforeEach(() => {
	readRememberedTyre.mockReset().mockResolvedValue(remembered("215/70 R15"));
	getShelfCodes.mockReset().mockResolvedValue(SHELF);
});

describe("which shelf it answers for", () => {
	it("says nothing, and reads nothing, on a shelf the sizes do not belong to", async () => {
		for (const categorySlug of ["stresne-nosice", "stresne-boxy", "nosice-bicyklov", "", undefined]) {
			expect(await resolveTyreListingFilter("default", { categorySlug, channel: "sk-eur" })).toEqual({
				state: "out-of-scope",
			});
		}
		expect(readRememberedTyre).not.toHaveBeenCalled();
		expect(getShelfCodes).not.toHaveBeenCalled();
	});
});

describe("with no size remembered", () => {
	it("does not narrow, and says whether the shopper asked for the narrowed list", async () => {
		readRememberedTyre.mockResolvedValue(null);
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
		expect(filter).toEqual({ state: "active", size: "215/70 R15", productIds: ["gid-n16128"], answers: {} });
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
			answers: {},
		});
		expect(getShelfCodes).not.toHaveBeenCalled();
	});

	it("names a product once, whatever the shop's map holds", async () => {
		getShelfCodes.mockResolvedValue([
			...SHELF,
			{ code: "N16128", productId: "gid-n16128", slug: "s16-22-7" },
		]);
		expect(await resolveTyreListingFilter("default", SCOPE)).toMatchObject({ productIds: ["gid-n16128"] });
	});

	it("leaves the shelf whole, and says why, when nothing the shop lists fits the size by default", async () => {
		// 205/55 R16 is in none of the four.
		readRememberedTyre.mockResolvedValue(remembered("205/55 R16"));
		const filter = await resolveTyreListingFilter("default", SCOPE);
		expect(filter).toEqual({ state: "offered", size: "205/55 R16", reason: "none-fit", answers: {} });
		expect(tyreFilterIds(filter)).toBeUndefined();
	});

	it("gives the explicit request for such a size its own answer, spelled out loud", async () => {
		readRememberedTyre.mockResolvedValue(remembered("205/55 R16"));
		const filter = await resolveTyreListingFilter("tyres", SCOPE);
		expect(filter).toEqual({ state: "empty", size: "205/55 R16", answers: {} });
		// Never `ids: []`, which would be the whole catalogue.
		expect(tyreFilterIds(filter)).toEqual([NO_PRODUCTS_SENTINEL_ID]);
		expect(buildFilterVariables({ vehicleProductIds: tyreFilterIds(filter) })).toEqual({
			ids: [NO_PRODUCTS_SENTINEL_ID],
		});
	});

	it("hands the listing exactly the active ids, and nothing in any state that does not narrow", async () => {
		expect(tyreFilterIds(await resolveTyreListingFilter("default", SCOPE))).toEqual(["gid-n16128"]);
		expect(tyreFilterIds({ state: "out-of-scope" })).toBeUndefined();
		expect(tyreFilterIds({ state: "unavailable", size: "205/55 R16", answers: {} })).toBeUndefined();
		expect(tyreFilterIds({ state: "no-size", requested: true })).toBeUndefined();
		expect(
			tyreFilterIds({ state: "offered", size: "205/55 R16", reason: "all", answers: {} }),
		).toBeUndefined();
	});
});

describe("a size the lists do not hold", () => {
	it("is not 'nothing fits': the shelf stays whole and says the shop cannot verify the size", async () => {
		readRememberedTyre.mockResolvedValue(remembered(UNLISTED));
		for (const request of ["default", "tyres"] as const) {
			const filter = await resolveTyreListingFilter(request, SCOPE);
			expect(filter, request).toEqual({ state: "offered", size: UNLISTED, reason: "unlisted", answers: {} });
			expect(tyreFilterIds(filter)).toBeUndefined();
		}
		// It does not even ask the shop: there is nothing to ask it.
		expect(getShelfCodes).not.toHaveBeenCalled();
	});

	it("still honours 'all chains', the shopper's own word", async () => {
		readRememberedTyre.mockResolvedValue(remembered(UNLISTED));
		expect(await resolveTyreListingFilter("all", SCOPE)).toMatchObject({ state: "offered", reason: "all" });
	});
});

describe("what the shopper said about their tyres", () => {
	const SPLIT = "195/75 R16";

	it("keeps both codes of a split size while the question is open, so their cards can ask it", async () => {
		readRememberedTyre.mockResolvedValue(remembered(SPLIT));
		const filter = await resolveTyreListingFilter("default", SCOPE);
		expect(filter).toMatchObject({ state: "active" });
		expect(tyreFilterIds(filter)?.sort()).toEqual(["gid-n16105", "gid-n16128"]);
	});

	it("narrows to the code the answer leaves", async () => {
		readRememberedTyre.mockResolvedValue(remembered(SPLIT, { [MAKE_KEY]: "Michelin" }));
		const michelin = await resolveTyreListingFilter("default", SCOPE);
		expect(tyreFilterIds(michelin)).toEqual(["gid-n16105"]);
		expect(tyreFilterAnswers(michelin)).toEqual({ [MAKE_KEY]: "Michelin" });

		readRememberedTyre.mockResolvedValue(remembered(SPLIT, { [MAKE_KEY]: "other" }));
		expect(tyreFilterIds(await resolveTyreListingFilter("default", SCOPE))).toEqual(["gid-n16128"]);
	});
});

describe("a link that carries its own size", () => {
	it("shows the list for that size to whoever opens it, whatever they remembered", async () => {
		const filter = await resolveTyreListingFilter("default", SCOPE, "215/70 R15");
		expect(filter).toMatchObject({ state: "active", size: "215/70 R15", productIds: ["gid-n16128"] });
		readRememberedTyre.mockResolvedValue(remembered("205/55 R16"));
		expect(await resolveTyreListingFilter("default", SCOPE, "215/70 R15")).toMatchObject({
			state: "active",
			size: "215/70 R15",
		});
	});

	it("matches the link's spelling to the list's", async () => {
		expect(await resolveTyreListingFilter("default", SCOPE, "215/70r15")).toMatchObject({
			size: "215/70 R15",
		});
	});

	it("gives that size to a visitor who remembered none", async () => {
		readRememberedTyre.mockResolvedValue(null);
		expect(await resolveTyreListingFilter("default", SCOPE, "215/70 R15")).toMatchObject({ state: "active" });
	});

	it("uses the answers the shopper gave only when the link's size is the shopper's own", async () => {
		readRememberedTyre.mockResolvedValue(remembered("195/75 R16", { [MAKE_KEY]: "Michelin" }));
		expect(await resolveTyreListingFilter("default", SCOPE, "195/75 R16")).toMatchObject({
			answers: { [MAKE_KEY]: "Michelin" },
		});
		expect(await resolveTyreListingFilter("default", SCOPE, "215/60 R16")).toMatchObject({ answers: {} });
	});

	it("is not 'nothing fits' when the link's size is a real one the lists do not hold", async () => {
		expect(await resolveTyreListingFilter("default", SCOPE, UNLISTED)).toMatchObject({
			state: "offered",
			size: UNLISTED,
			reason: "unlisted",
		});
	});

	it("falls back to the shopper's own size when the link's is no size at all", async () => {
		for (const garbage of ["hello", "205/55 R61", "<script>", ""]) {
			expect(await resolveTyreListingFilter("default", SCOPE, garbage), garbage).toMatchObject({
				size: "215/70 R15",
			});
		}
	});
});

describe("when the shop cannot be asked", () => {
	it("does not narrow and does not claim anything: an outage is not 'nothing fits'", async () => {
		getShelfCodes.mockRejectedValue(new Error("saleor down"));
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const filter = await resolveTyreListingFilter("tyres", SCOPE);
		expect(filter).toEqual({ state: "unavailable", size: "215/70 R15", answers: {} });
		expect(tyreFilterIds(filter)).toBeUndefined();
		// The cards still say whether they fit the size.
		expect(tyreFilterSize(filter)).toBe("215/70 R15");
		error.mockRestore();
	});

	it("keeps the size and the answers when the shop's products cannot be read", async () => {
		readRememberedTyre.mockResolvedValue(remembered("195/75 R16", { [MAKE_KEY]: "Michelin" }));
		getShelfCodes.mockRejectedValue(new Error("saleor down"));
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const filter = await resolveTyreListingFilter("default", SCOPE);
		expect(filter).toEqual({ state: "unavailable", size: "195/75 R16", answers: { [MAKE_KEY]: "Michelin" } });
		error.mockRestore();
	});

	it("does not narrow when the shelf is too large to read whole", async () => {
		getShelfCodes.mockResolvedValue(null);
		expect(await resolveTyreListingFilter("default", SCOPE)).toEqual({
			state: "unavailable",
			size: "215/70 R15",
			answers: {},
		});
	});
});

describe("the size and the answers the cards speak of", () => {
	it("are the shopper's in every state that knows them, and none otherwise", () => {
		const answers = { [MAKE_KEY]: "Michelin" };
		expect(tyreFilterSize({ state: "active", size: "a", productIds: ["x"], answers })).toBe("a");
		expect(tyreFilterSize({ state: "empty", size: "b", answers })).toBe("b");
		expect(tyreFilterSize({ state: "offered", size: "c", reason: "all", answers })).toBe("c");
		expect(tyreFilterSize({ state: "unavailable", size: null, answers: {} })).toBeNull();
		expect(tyreFilterSize({ state: "no-size", requested: false })).toBeNull();
		expect(tyreFilterSize({ state: "out-of-scope" })).toBeNull();
		expect(tyreFilterAnswers({ state: "active", size: "a", productIds: ["x"], answers })).toEqual(answers);
		expect(tyreFilterAnswers({ state: "no-size", requested: false })).toEqual({});
		expect(tyreFilterAnswers({ state: "out-of-scope" })).toEqual({});
	});
});
