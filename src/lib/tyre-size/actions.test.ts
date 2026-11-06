import { beforeEach, describe, expect, it, vi } from "vitest";

import { decodeTyreMemory, encodeTyreMemory } from "./memory";

const jar = vi.hoisted(() => ({
	value: undefined as string | undefined,
	options: undefined as Record<string, unknown> | undefined,
	deleted: 0,
	failWrites: false,
}));
vi.mock("next/headers", () => ({
	cookies: async () => ({
		get: (name: string) =>
			name === "maky-tyres" && jar.value !== undefined ? { value: jar.value } : undefined,
		set: (name: string, value: string, options: Record<string, unknown>) => {
			if (jar.failWrites) throw new Error("cookies can only be modified in a Server Action");
			if (name === "maky-tyres") {
				jar.value = value;
				jar.options = options;
			}
		},
		delete: (name: string) => {
			if (jar.failWrites) throw new Error("cookies can only be modified in a Server Action");
			if (name === "maky-tyres") {
				jar.value = undefined;
				jar.deleted++;
			}
		},
	}),
}));

import { forgetTyreSize, loadTyreStep, rememberTyreSize } from "./actions";

beforeEach(() => {
	jar.value = undefined;
	jar.options = undefined;
	jar.deleted = 0;
	jar.failWrites = false;
	vi.unstubAllEnvs();
});

describe("remembering a size", () => {
	it("stores the list's own label in a cookie only the server reads, for a year", async () => {
		vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
		await expect(rememberTyreSize("205/55 R16")).resolves.toEqual({ ok: true, size: "205/55 R16" });
		expect(decodeTyreMemory(jar.value)).toBe("205/55 R16");
		expect(jar.options).toMatchObject({
			httpOnly: true,
			sameSite: "lax",
			secure: true,
			path: "/",
			maxAge: 60 * 60 * 24 * 365,
		});
	});

	it("does not demand https where the storefront runs on http, which would drop the cookie silently", async () => {
		vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "http://localhost:3000");
		await rememberTyreSize("205/55 R16");
		expect(jar.options).toMatchObject({ secure: false });
	});

	it.each([
		["a size the list does not hold", "145/70 R22"],
		["a spelling of a size that is not the list's own", "205/55r16"],
		["a size with more words than a size", "205/55 R16 91V"],
		["an empty string", ""],
		["a number", 205],
		["nothing", undefined],
		["an object", { size: "205/55 R16" }],
		["a name on the object prototype", "constructor"],
	])("refuses %s and stores nothing", async (_name, size) => {
		await expect(rememberTyreSize(size)).resolves.toEqual({ ok: false, error: "unknown-size" });
		expect(jar.value).toBeUndefined();
	});

	it("says so, instead of pretending, when the cookie cannot be written", async () => {
		jar.failWrites = true;
		await expect(rememberTyreSize("205/55 R16")).resolves.toEqual({ ok: false, error: "write-failed" });
	});

	it("replaces the size, it does not collect them", async () => {
		await rememberTyreSize("205/55 R16");
		await rememberTyreSize("215/60 R16");
		expect(decodeTyreMemory(jar.value)).toBe("215/60 R16");
	});
});

describe("forgetting a size", () => {
	it("takes the cookie away", async () => {
		await rememberTyreSize("205/55 R16");
		await expect(forgetTyreSize()).resolves.toEqual({ ok: true });
		expect(jar.value).toBeUndefined();
		expect(jar.deleted).toBe(1);
	});

	it("reports it, when the cookie cannot be changed", async () => {
		jar.failWrites = true;
		await expect(forgetTyreSize()).resolves.toEqual({ ok: false });
	});
});

describe("what the selector's tyre tab is told", () => {
	it("starts with the remembered size and the first step", async () => {
		jar.value = encodeTyreMemory("205/55 R16");
		const step = await loadTyreStep();
		expect(step.current).toBe("205/55 R16");
		expect(step.steps.widths.length).toBeGreaterThan(30);
		expect(step.steps.profiles).toBeNull();
		expect(step.match).toBeNull();
		expect(step.unknownText).toBe(false);
	});

	it("has no current size when nothing was remembered, or the cookie is not trusted", async () => {
		expect((await loadTyreStep()).current).toBeNull();
		jar.value = encodeTyreMemory("145/70 R22");
		expect((await loadTyreStep()).current).toBeNull();
	});

	it("matches what was typed to the list's label", async () => {
		const step = await loadTyreStep({ text: "205/55r16 91V" });
		expect(step.match).toBe("205/55 R16");
		expect(step.unknownText).toBe(false);
	});

	it("says when what was typed is no size of the list", async () => {
		const step = await loadTyreStep({ text: "145/70 R22" });
		expect(step.match).toBeNull();
		expect(step.unknownText).toBe(true);
	});

	it("treats a blank input as no input", async () => {
		const step = await loadTyreStep({ text: "   " });
		expect(step.unknownText).toBe(false);
		expect(step.match).toBeNull();
	});

	it("offers the next step, and names the size when the three are chosen", async () => {
		const width = await loadTyreStep({ width: 205 });
		expect(width.steps.profiles).toContain(55);
		expect(width.match).toBeNull();

		const profile = await loadTyreStep({ width: 205, profile: 55 });
		expect(profile.steps.rims).toContain("16");
		expect(profile.match).toBeNull();

		const rim = await loadTyreStep({ width: 205, profile: 55, rim: "16" });
		expect(rim.match).toBe("205/55 R16");
	});

	it("ignores a profile that comes without a width", async () => {
		const step = await loadTyreStep({ profile: 55 });
		expect(step.steps.profiles).toBeNull();
		expect(step.steps.rims).toBeNull();
	});

	it.each([
		["fractions", { width: 205.5, profile: 55, rim: "16" }],
		["strings for numbers", { width: "205", profile: "55", rim: "16" }],
		["negative numbers", { width: -205, profile: -55, rim: "16" }],
		["huge numbers", { width: 1e9, profile: 55, rim: "16" }],
		["a rim that is a number", { width: 205, profile: 55, rim: 16 }],
		["an unknown combination", { width: 205, profile: 55, rim: "22" }],
		["nonsense", { width: {}, profile: [], rim: null, text: 5 }],
	])("answers %s with no match and no crash", async (_name, input) => {
		const step = await loadTyreStep(input as never);
		expect(step.match).toBeNull();
		expect(step.unknownText).toBe(false);
	});
});
