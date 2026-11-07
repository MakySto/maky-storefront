import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	decodeTyreMemory,
	EMPTY_TYRE_MEMORY,
	encodeTyreMemory,
	entryFor,
	hasOwnEntry,
	isEmptyTyreMemory,
	TYRE_MEMORY_COOKIE,
	withEntry,
	type TyreMemory,
} from "./memory";

/**
 * The remembered size is read from a cookie the shopper's browser sends back, so it is read as attacker-shaped
 * text: a damaged, forged or stale value is "nothing remembered", never a thrown render and never a size taken on
 * the cookie's word.
 */
const store = vi.hoisted(() => ({
	value: undefined as string | undefined,
	throws: false,
	vehicle: null as string | null,
}));
vi.mock("next/headers", () => ({
	cookies: async () => {
		if (store.throws) throw new Error("cookies() was called outside a request scope");
		return {
			get: (name: string) =>
				name === "maky-tyres" && store.value !== undefined ? { value: store.value } : undefined,
		};
	},
}));
vi.mock("./vehicle-context", () => ({ readActiveVehicleKey: async () => store.vehicle }));

import { readRememberedTyre, readRememberedTyreSize, validAnswers } from "./remembered";

const DUV = "Bridgestone Duravis Rxxx";
const MAKE_KEY = "Continental|Kleber|Michelin";
const b64 = (value: unknown) =>
	Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

const memory = (free: string | null, vehicles: Record<string, string> = {}): TyreMemory => ({
	free: free ? { size: free, answers: {} } : null,
	vehicles: Object.fromEntries(Object.entries(vehicles).map(([key, size]) => [key, { size, answers: {} }])),
});

beforeEach(() => {
	store.value = undefined;
	store.throws = false;
	store.vehicle = null;
});

describe("the cookie codec", () => {
	it("is named in the maky- family and not like the checkout cookies, which are swept by prefix", () => {
		expect(TYRE_MEMORY_COOKIE).toBe("maky-tyres");
		expect(TYRE_MEMORY_COOKIE.startsWith("checkoutId-")).toBe(false);
	});

	it("carries a size and gives it back unchanged", () => {
		for (const size of ["205/55 R16", "175 R13", "4.00-12", "205/65 R17,5", "25x8.50-14"]) {
			expect(decodeTyreMemory(encodeTyreMemory(memory(size))).free?.size).toBe(size);
		}
	});

	it("carries the size per car, and the answers with each", () => {
		const original: TyreMemory = {
			free: { size: "205/55 R16", answers: {} },
			vehicles: {
				"vw|golf|7|2019": { size: "195/75 R16", answers: { [MAKE_KEY]: "Michelin" } },
				"skoda|octavia|3|2016": { size: "215/60 R16", answers: { [DUV]: "other" } },
			},
		};
		expect(decodeTyreMemory(encodeTyreMemory(original))).toEqual(original);
	});

	it("uses an alphabet Next's cookie encoding leaves alone", () => {
		expect(encodeTyreMemory(memory("205/55 R16"))).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(encodeTyreMemory(memory("205/65 R17,5", { "vw|golf|7|2019": "175 R13" }))).toMatch(
			/^[A-Za-z0-9_-]+$/,
		);
	});

	it("reads a cookie of the first version (one size, no car) as the size given with no car", () => {
		expect(decodeTyreMemory(b64({ v: 1, s: "205/55 R16" }))).toEqual(memory("205/55 R16"));
	});

	it.each([
		["nothing", undefined],
		["an empty value", ""],
		["text that is not base64url JSON", "205/55 R16"],
		["base64url of text that is not JSON", b64("205/55 R16")],
		["JSON that is not an envelope", b64('"205/55 R16"')],
		["an envelope of a version that does not exist", b64({ v: 3, f: { s: "205/55 R16" } })],
		["an envelope of the first version without a size", b64({ v: 1 })],
		["an envelope of the first version with an empty size", b64({ v: 1, s: "" })],
		["an envelope of the first version with a size that is not text", b64({ v: 1, s: 205 })],
		["a size too long to be a size", b64({ v: 1, s: "x".repeat(41) })],
		["a value too long to be a cookie of ours", "A".repeat(3001)],
		["an array", b64([1, 2, 3])],
	])("reads %s as nothing", (_name, value) => {
		expect(decodeTyreMemory(value)).toEqual(EMPTY_TYRE_MEMORY);
	});

	it("reads a damaged entry as nothing and keeps the sound ones beside it", () => {
		const decoded = decodeTyreMemory(
			b64({
				v: 2,
				f: { s: 205 },
				c: {
					"vw|golf|7|2019": { s: "205/55 R16" },
					"bad|one|1|1": { s: "" },
					"": { s: "175 R13" },
					"x|y|1|1": "nope",
				},
			}),
		);
		expect(decoded.free).toBeNull();
		expect(Object.keys(decoded.vehicles)).toEqual(["vw|golf|7|2019"]);
	});

	it("keeps only answers that are text, of a sane length, and not too many", () => {
		const answers: Record<string, unknown> = {
			good: "Michelin",
			number: 1,
			long: "x".repeat(81),
			nested: { a: 1 },
		};
		for (let i = 0; i < 20; i++) answers[`k${i}`] = "other";
		const decoded = decodeTyreMemory(b64({ v: 2, f: { s: "205/55 R16", a: answers } }));
		const kept = decoded.free!.answers;
		expect(kept.good).toBe("Michelin");
		expect(kept.number).toBeUndefined();
		expect(kept.long).toBeUndefined();
		expect(kept.nested).toBeUndefined();
		expect(Object.keys(kept).length).toBeLessThanOrEqual(8);
	});

	it("keeps no more cars than a garage can hold and a few spare", () => {
		const cars = Object.fromEntries(
			Array.from({ length: 12 }, (_, i) => [`m|m|g|${i}`, { s: "205/55 R16" }]),
		);
		expect(Object.keys(decodeTyreMemory(b64({ v: 2, c: cars })).vehicles)).toHaveLength(6);
	});

	it("does not let a key from the cookie reach the object's prototype", () => {
		const decoded = decodeTyreMemory(b64('{"v":2,"c":{"__proto__":{"s":"205/55 R16"}}}'));
		expect(Object.keys(decoded.vehicles)).toEqual([]);
		expect(Object.getPrototypeOf(decoded.vehicles)).toBe(Object.prototype);
		expect((decoded.vehicles as Record<string, unknown>).size).toBeUndefined();
		expect(hasOwnEntry(decoded, "toString")).toBe(false);
		expect(entryFor(decoded, "constructor")).toBeNull();
	});
});

describe("whose size it is", () => {
	const golf = "vw|golf|7|2019";
	const octavia = "skoda|octavia|3|2016";

	it("gives a car its own size, and never another car's", () => {
		const m = memory(null, { [golf]: "205/55 R16" });
		expect(entryFor(m, golf)?.size).toBe("205/55 R16");
		expect(entryFor(m, octavia)).toBeNull();
		expect(entryFor(m, null)).toBeNull();
	});

	it("lends the size given with no car to a car that has none of its own, but not over one that has", () => {
		const m = memory("175 R13", { [golf]: "205/55 R16" });
		expect(entryFor(m, golf)?.size).toBe("205/55 R16");
		expect(entryFor(m, octavia)?.size).toBe("175 R13");
		expect(entryFor(m, null)?.size).toBe("175 R13");
		expect(hasOwnEntry(m, golf)).toBe(true);
		expect(hasOwnEntry(m, octavia)).toBe(false);
		expect(hasOwnEntry(m, null)).toBe(true);
		expect(hasOwnEntry(memory(null), null)).toBe(false);
	});

	it("sets and removes the entry of one context and leaves the others alone", () => {
		let m = memory("175 R13", { [golf]: "205/55 R16" });
		m = withEntry(m, octavia, { size: "215/60 R16", answers: {} });
		expect(m.free?.size).toBe("175 R13");
		expect(m.vehicles[golf].size).toBe("205/55 R16");
		expect(m.vehicles[octavia].size).toBe("215/60 R16");
		m = withEntry(m, golf, null);
		expect(Object.keys(m.vehicles)).toEqual([octavia]);
		m = withEntry(m, null, null);
		expect(m.free).toBeNull();
		expect(Object.keys(m.vehicles)).toEqual([octavia]);
	});

	it("makes the entry just set the newest, and drops the oldest when there are too many", () => {
		let m = memory(null);
		for (let i = 0; i < 8; i++) m = withEntry(m, `m|m|g|${i}`, { size: "205/55 R16", answers: {} });
		expect(Object.keys(m.vehicles)).toEqual([
			"m|m|g|2",
			"m|m|g|3",
			"m|m|g|4",
			"m|m|g|5",
			"m|m|g|6",
			"m|m|g|7",
		]);
		m = withEntry(m, "m|m|g|2", { size: "175 R13", answers: {} });
		expect(Object.keys(m.vehicles).at(-1)).toBe("m|m|g|2");
	});

	it("knows an empty memory", () => {
		expect(isEmptyTyreMemory(EMPTY_TYRE_MEMORY)).toBe(true);
		expect(isEmptyTyreMemory(memory("205/55 R16"))).toBe(false);
		expect(isEmptyTyreMemory(memory(null, { [golf]: "205/55 R16" }))).toBe(false);
	});
});

describe("reading the remembered tyres on the server", () => {
	const golf = "vw|golf|7|2019";

	it("gives the size a shopper told the shop, with no car in use", async () => {
		store.value = encodeTyreMemory(memory("205/55 R16"));
		await expect(readRememberedTyre()).resolves.toEqual({
			size: "205/55 R16",
			answers: {},
			forThisVehicle: false,
		});
		await expect(readRememberedTyreSize()).resolves.toBe("205/55 R16");
	});

	it("gives the car in use its own size and says it is its own", async () => {
		store.vehicle = golf;
		store.value = encodeTyreMemory(memory("175 R13", { [golf]: "205/55 R16" }));
		await expect(readRememberedTyre()).resolves.toMatchObject({ size: "205/55 R16", forThisVehicle: true });
	});

	it("lends the size given with no car and says it is borrowed", async () => {
		store.vehicle = golf;
		store.value = encodeTyreMemory(memory("175 R13"));
		await expect(readRememberedTyre()).resolves.toMatchObject({ size: "175 R13", forThisVehicle: false });
	});

	it("does not show a car the tyres of another car", async () => {
		store.vehicle = "skoda|octavia|3|2016";
		store.value = encodeTyreMemory(memory(null, { [golf]: "205/55 R16" }));
		await expect(readRememberedTyre()).resolves.toBeNull();
	});

	it("keeps the answers that answer a question the list asks, and drops the rest", async () => {
		store.value = encodeTyreMemory({
			free: {
				size: "195/75 R16",
				answers: { [MAKE_KEY]: "Michelin", "Nobody|asked": "x", [DUV]: "Pirelli" },
			},
			vehicles: {},
		});
		await expect(readRememberedTyre()).resolves.toMatchObject({ answers: { [MAKE_KEY]: "Michelin" } });
		expect(
			validAnswers({ [MAKE_KEY]: "other", [DUV]: DUV, "Nobody|asked": "other", [MAKE_KEY + "!"]: "other" }),
		).toEqual({
			[MAKE_KEY]: "other",
			[DUV]: DUV,
		});
	});

	it("remembers a well-formed size the list does not hold", async () => {
		store.value = encodeTyreMemory(memory("205/40 R21"));
		await expect(readRememberedTyreSize()).resolves.toBe("205/40 R21");
	});

	it("is nothing for a size that is no size: a hand-made cookie, or a list that has since changed", async () => {
		for (const size of ["145/70 R99", "205/55r16", "constructor", "205/55 R16 91V"]) {
			store.value = encodeTyreMemory(memory(size));
			await expect(readRememberedTyreSize(), size).resolves.toBeNull();
		}
	});

	it("is nothing when nothing was said, or the cookie is damaged", async () => {
		await expect(readRememberedTyreSize()).resolves.toBeNull();
		store.value = "not-a-cookie-of-ours";
		await expect(readRememberedTyreSize()).resolves.toBeNull();
	});

	it("is nothing, not a crash, where cookies cannot be read (a prerendered shell)", async () => {
		store.throws = true;
		await expect(readRememberedTyreSize()).resolves.toBeNull();
		await expect(readRememberedTyre()).resolves.toBeNull();
	});
});
