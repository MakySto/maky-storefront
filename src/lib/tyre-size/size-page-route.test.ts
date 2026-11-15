import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Where the tyre-size pages live, and what each market may say about them. The sizes are the sealed list's own; the
 * shop's side (which codes a channel sells) is what the shelf scan would have returned.
 */

const { getShelfCodes } = vi.hoisted(() => ({ getShelfCodes: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/listing/shelf-codes", () => ({ getShelfCodes }));

import {
	indexableTyrePagePaths,
	isTyrePageIndexable,
	readTyreShelfOffer,
	tyreListingCanonicalPath,
	tyrePageCounterparts,
	tyrePagePath,
	tyreRouteOf,
	tyreSizePagePath,
} from "./size-page-route";
import { tyrePageOf } from "./size-pages";

const shelf = (...codes: string[]) => codes.map((code) => ({ code, productId: `gid-${code}`, slug: code }));
const SIZE = tyrePageOf(["205-60-r16"])!;
const RIM = tyrePageOf(["r16"])!;

beforeEach(() => {
	getShelfCodes.mockReset();
	vi.unstubAllEnvs();
});

describe("which path is a tyre page", () => {
	it("answers only for the snow-chain shelf", () => {
		expect(tyreRouteOf("sk-eur", "stresne-nosice", ["205-60-r16"])).toEqual({ status: "not-shelf" });
		expect(tyreRouteOf("sk", "stresne-boxy", ["r16"])).toEqual({ status: "not-shelf" });
	});

	it("finds the page by the Saleor channel and by the market alike", () => {
		expect(tyreRouteOf("sk-eur", "snehove-retaze", ["205-60-r16"])).toEqual({ status: "page", page: SIZE });
		expect(tyreRouteOf("sk", "snehove-retaze", ["r16"])).toEqual({ status: "page", page: RIM });
	});

	it("finds it under a market's own spelling of the shelf", () => {
		expect(tyreRouteOf("cz", "snehove-retezy", ["205-60-r16"])).toEqual({ status: "page", page: SIZE });
		expect(tyreRouteOf("de", "schneeketten", ["r16"])).toEqual({ status: "page", page: RIM });
	});

	it("is final on the shelf: an address the shelf does not have is absent, never a vehicle page", () => {
		expect(tyreRouteOf("sk", "snehove-retaze", ["volkswagen"])).toEqual({ status: "absent" });
		expect(tyreRouteOf("sk", "snehove-retaze", ["650-17-r17"])).toEqual({ status: "absent" });
		expect(tyreRouteOf("sk", "snehove-retaze", ["205-60-r16", "x"])).toEqual({ status: "absent" });
	});

	it("has no tyre pages in a market that does not sell the shelf", () => {
		expect(tyreRouteOf("us", "snehove-retaze", ["205-60-r16"])).toEqual({ status: "absent" });
		expect(tyreRouteOf("ca-cad", "snehove-retaze", ["r16"])).toEqual({ status: "absent" });
		expect(tyreSizePagePath("us", "205/60 R16")).toBeNull();
	});
});

describe("the address of a page", () => {
	it("hangs below the market's own shelf address", () => {
		expect(tyrePagePath("sk", "205-60-r16")).toBe("/snehove-retaze/205-60-r16");
		expect(tyrePagePath("sk-eur", "r16")).toBe("/snehove-retaze/r16");
		expect(tyrePagePath("cz", "205-60-r16")).toBe("/snehove-retezy/205-60-r16");
		expect(tyrePagePath("at", "r16")).toBe("/schneeketten/r16");
	});

	it("is known for a size that has a page and for no other", () => {
		expect(tyreSizePagePath("sk", "205/60 R16")).toBe("/snehove-retaze/205-60-r16");
		expect(tyreSizePagePath("sk", "650/17 R17")).toBeNull();
		expect(tyreSizePagePath("sk", "175 R13")).toBeNull();
		expect(tyreSizePagePath("sk", null)).toBeNull();
	});
});

describe("what the channel sells", () => {
	it("reads the shelf's codes for the channel", async () => {
		getShelfCodes.mockResolvedValue(shelf("N16075", "N17143"));
		const offer = await readTyreShelfOffer("sk-eur");
		expect(getShelfCodes).toHaveBeenCalledWith("snehove-retaze", "sk-eur");
		expect([...(offer?.onSale ?? [])]).toEqual(["N16075", "N17143"]);
	});

	it("lets a fault through as a fault, not as an empty shop", async () => {
		getShelfCodes.mockRejectedValue(new Error("saleor is down"));
		await expect(readTyreShelfOffer("sk-eur")).rejects.toThrow("saleor is down");
		await expect(indexableTyrePagePaths("sk")).rejects.toThrow("saleor is down");
	});

	it("decides a size page by its products and a rim page by its sizes", () => {
		expect(isTyrePageIndexable(SIZE, new Set(["N16075", "N17143"]))).toBe(true);
		expect(isTyrePageIndexable(SIZE, new Set(["N16075"]))).toBe(false);
		expect(isTyrePageIndexable(RIM, new Set(["N16075", "N17143"]))).toBe(true);
		expect(isTyrePageIndexable(RIM, new Set(["N16075"]))).toBe(false);
		expect(isTyrePageIndexable(RIM, new Set())).toBe(false);
	});

	it("decides a family page by how many of its products the channel sells, and routes it on the shelf", () => {
		const family = tyrePageOf(["snowdrive-r9"])!;
		expect(family.kind).toBe("family");
		expect(isTyrePageIndexable(family, new Set(["N16061", "N16075"]))).toBe(true);
		expect(isTyrePageIndexable(family, new Set(["N16075", "N17143"]))).toBe(false);
		expect(tyreRouteOf("sk-eur", "snehove-retaze", ["snowdrive-r9"])).toEqual({
			status: "page",
			page: family,
		});
		expect(tyreRouteOf("cz", "snehove-retezy", ["snowdrive-r9"]).status).toBe("page");
		expect(tyreRouteOf("sk-eur", "stresne-nosice", ["snowdrive-r9"])).toEqual({ status: "not-shelf" });
		expect(tyrePagePath("de", family.slug)).toBe("/schneeketten/snowdrive-r9");
	});
});

describe("the canonical of a shelf listing narrowed by a tyre size", () => {
	const LINK = { tyres: "1", tyreSize: "205/60 R16" };

	it("is the size's page, at the market's own address", async () => {
		getShelfCodes.mockResolvedValue(shelf("N16075", "N17143"));
		expect(await tyreListingCanonicalPath("sk-eur", "snehove-retaze", LINK)).toBe(
			"/snehove-retaze/205-60-r16",
		);
		expect(await tyreListingCanonicalPath("cz-czk", "snehove-retaze", LINK)).toBe(
			"/snehove-retezy/205-60-r16",
		);
	});

	it("reads the size as the listing reads it, however the link spells it", async () => {
		getShelfCodes.mockResolvedValue(shelf("N16075", "N17143"));
		for (const tyreSize of ["205/60 R16", "205/60R16", "205 60 16", "205/60 r16"]) {
			expect(await tyreListingCanonicalPath("sk-eur", "snehove-retaze", { tyreSize }), tyreSize).toBe(
				"/snehove-retaze/205-60-r16",
			);
		}
	});

	it("is the same page in any order, narrowed further or on a later page of the list", async () => {
		getShelfCodes.mockResolvedValue(shelf("N16075", "N17143"));
		for (const more of [{ sort: "price-asc" }, { brand: "dac" }, { cursor: "abc", direction: "next" }]) {
			expect(
				await tyreListingCanonicalPath("sk-eur", "snehove-retaze", { ...LINK, ...more }),
				JSON.stringify(more),
			).toBe("/snehove-retaze/205-60-r16");
		}
	});

	it("stays the shelf for the whole shelf with the size only on the cards", async () => {
		getShelfCodes.mockResolvedValue(shelf("N16075", "N17143"));
		expect(
			await tyreListingCanonicalPath("sk-eur", "snehove-retaze", { tyres: "0", tyreSize: "205/60 R16" }),
		).toBeNull();
	});

	it("stays the shelf without a size in the link, and Saleor is not asked", async () => {
		expect(await tyreListingCanonicalPath("sk-eur", "snehove-retaze", {})).toBeNull();
		expect(await tyreListingCanonicalPath("sk-eur", "snehove-retaze", { tyres: "1" })).toBeNull();
		expect(await tyreListingCanonicalPath("sk-eur", "snehove-retaze", { tyreSize: "" })).toBeNull();
		expect(getShelfCodes).not.toHaveBeenCalled();
	});

	it("stays the shelf for a size without a page, and Saleor is not asked", async () => {
		for (const tyreSize of ["205/60 R99", "650/17 R17", "nonsense", "205-55-16-x"]) {
			expect(await tyreListingCanonicalPath("sk-eur", "snehove-retaze", { tyreSize }), tyreSize).toBeNull();
		}
		expect(getShelfCodes).not.toHaveBeenCalled();
	});

	it("never names a size page that is not indexed in the channel", async () => {
		getShelfCodes.mockResolvedValue(shelf("N16075"));
		expect(await tyreListingCanonicalPath("sk-eur", "snehove-retaze", LINK)).toBeNull();
		getShelfCodes.mockResolvedValue(null);
		expect(await tyreListingCanonicalPath("sk-eur", "snehove-retaze", LINK)).toBeNull();
	});

	it("claims nothing when the shop cannot be asked", async () => {
		getShelfCodes.mockRejectedValue(new Error("saleor is down"));
		expect(await tyreListingCanonicalPath("sk-eur", "snehove-retaze", LINK)).toBeNull();
	});

	it("is nothing off the shelf or in a market that does not sell it, and Saleor is not asked", async () => {
		expect(await tyreListingCanonicalPath("sk-eur", "stresne-nosice", LINK)).toBeNull();
		expect(await tyreListingCanonicalPath("us-usd", "snehove-retaze", LINK)).toBeNull();
		expect(getShelfCodes).not.toHaveBeenCalled();
	});
});

describe("the sitemap's paths", () => {
	it("are the market's own addresses of the indexable pages", async () => {
		getShelfCodes.mockResolvedValue(shelf("N16075", "N17143"));
		const paths = await indexableTyrePagePaths("cz");
		expect(getShelfCodes).toHaveBeenCalledWith("snehove-retaze", "cz-czk");
		expect(paths).toContain("/snehove-retezy/r16");
		expect(paths).toContain("/snehove-retezy/205-60-r16");
		expect(paths.every((path) => path.startsWith("/snehove-retezy/"))).toBe(true);
	});

	it("are none for a market without the shelf, and Saleor is not asked", async () => {
		expect(await indexableTyrePagePaths("us")).toEqual([]);
		expect(getShelfCodes).not.toHaveBeenCalled();
	});

	it("are none when the shelf is too large to read whole", async () => {
		getShelfCodes.mockResolvedValue(null);
		expect(await indexableTyrePagePaths("sk")).toEqual([]);
	});
});

describe("the same page in the other markets", () => {
	it("joins the indexed markets that sell enough for it, each at its own address", async () => {
		vi.stubEnv("MAKY_LIVE_MARKETS", "sk,cz,de,us");
		vi.stubEnv("MAKY_INDEXABLE_MARKETS", "sk,cz,de,us");
		getShelfCodes.mockImplementation(async (_slug: string, channel: string) => {
			if (channel === "sk-eur") return shelf("N16075", "N17143");
			// One product only: the Czech page exists and is not indexed.
			if (channel === "cz-czk") return shelf("N16075");
			throw new Error("saleor is down");
		});

		expect(await tyrePageCounterparts(SIZE)).toEqual([{ market: "sk", path: "/snehove-retaze/205-60-r16" }]);
		// Germany could not be asked and is left out; the USA does not sell the shelf and is never asked.
		expect(getShelfCodes.mock.calls.map((call) => call[1]).sort()).toEqual(["cz-czk", "de-eur", "sk-eur"]);
	});
});
