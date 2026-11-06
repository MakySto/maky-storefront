import { beforeEach, describe, expect, it, vi } from "vitest";

import { decodeTyreMemory, encodeTyreMemory, TYRE_MEMORY_COOKIE } from "./memory";

/**
 * The remembered size is read from a cookie the shopper's browser sends back, so it is read as attacker-shaped
 * text: a damaged, forged or stale value is "nothing remembered", never a thrown render and never a size taken on
 * the cookie's word.
 */
const store = vi.hoisted(() => ({ value: undefined as string | undefined, throws: false }));
vi.mock("next/headers", () => ({
	cookies: async () => {
		if (store.throws) throw new Error("cookies() was called outside a request scope");
		return {
			get: (name: string) =>
				name === "maky-tyres" && store.value !== undefined ? { value: store.value } : undefined,
		};
	},
}));

import { readRememberedTyreSize } from "./remembered";

beforeEach(() => {
	store.value = undefined;
	store.throws = false;
});

describe("the cookie codec", () => {
	it("is named in the maky- family and not like the checkout cookies, which are swept by prefix", () => {
		expect(TYRE_MEMORY_COOKIE).toBe("maky-tyres");
		expect(TYRE_MEMORY_COOKIE.startsWith("checkoutId-")).toBe(false);
	});

	it("carries a size and gives it back unchanged", () => {
		for (const size of ["205/55 R16", "175 R13", "4.00-12", "205/65 R17,5", "25x8.50-14"]) {
			expect(decodeTyreMemory(encodeTyreMemory(size))).toBe(size);
		}
	});

	it("uses an alphabet Next's cookie encoding leaves alone", () => {
		expect(encodeTyreMemory("205/55 R16")).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(encodeTyreMemory("205/65 R17,5")).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it.each([
		["nothing", undefined],
		["an empty value", ""],
		["text that is not base64url JSON", "205/55 R16"],
		["base64url of text that is not JSON", Buffer.from("205/55 R16").toString("base64url")],
		["JSON that is not an envelope", Buffer.from('"205/55 R16"').toString("base64url")],
		["an envelope of another version", Buffer.from('{"v":2,"s":"205/55 R16"}').toString("base64url")],
		["an envelope without a size", Buffer.from('{"v":1}').toString("base64url")],
		["an envelope with an empty size", Buffer.from('{"v":1,"s":""}').toString("base64url")],
		["an envelope with a size that is not text", Buffer.from('{"v":1,"s":205}').toString("base64url")],
		[
			"a size too long to be a size",
			Buffer.from(JSON.stringify({ v: 1, s: "x".repeat(41) })).toString("base64url"),
		],
		["a value too long to be a cookie of ours", "A".repeat(201)],
	])("reads %s as nothing", (_name, value) => {
		expect(decodeTyreMemory(value)).toBeNull();
	});
});

describe("reading the remembered size on the server", () => {
	it("gives the size a shopper told the shop", async () => {
		store.value = encodeTyreMemory("205/55 R16");
		await expect(readRememberedTyreSize()).resolves.toBe("205/55 R16");
	});

	it("is nothing when nothing was said", async () => {
		await expect(readRememberedTyreSize()).resolves.toBeNull();
	});

	it("is nothing for a size the list does not hold: a hand-made cookie, or a list that has since changed", async () => {
		store.value = encodeTyreMemory("145/70 R22");
		await expect(readRememberedTyreSize()).resolves.toBeNull();
		store.value = encodeTyreMemory("205/55r16");
		await expect(readRememberedTyreSize()).resolves.toBeNull();
		store.value = encodeTyreMemory("constructor");
		await expect(readRememberedTyreSize()).resolves.toBeNull();
	});

	it("is nothing for a damaged cookie", async () => {
		store.value = "not-a-cookie-of-ours";
		await expect(readRememberedTyreSize()).resolves.toBeNull();
	});

	it("is nothing, not a crash, where cookies cannot be read (a prerendered shell)", async () => {
		store.throws = true;
		await expect(readRememberedTyreSize()).resolves.toBeNull();
	});
});
