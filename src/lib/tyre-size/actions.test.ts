import { beforeEach, describe, expect, it, vi } from "vitest";

import { decodeTyreMemory, encodeTyreMemory, type TyreMemory } from "./memory";

const jar = vi.hoisted(() => ({
	value: undefined as string | undefined,
	options: undefined as Record<string, unknown> | undefined,
	deleted: 0,
	failWrites: false,
	vehicle: null as string | null,
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
vi.mock("./vehicle-context", () => ({ readActiveVehicleKey: async () => jar.vehicle }));

import { forgetTyreSize, loadTyreStep, rememberTyreAnswer, rememberTyreSize } from "./actions";

const MAKE_KEY = "Continental|Kleber|Michelin";
const DUV = "Bridgestone Duravis Rxxx";
const GOLF = "vw|golf|7|2019";
const OCTAVIA = "skoda|octavia|3|2016";

const stored = () => decodeTyreMemory(jar.value);
const put = (memory: TyreMemory) => {
	jar.value = encodeTyreMemory(memory);
};
const entry = (size: string, answers: Record<string, string> = {}) => ({ size, answers });

beforeEach(() => {
	jar.value = undefined;
	jar.options = undefined;
	jar.deleted = 0;
	jar.failWrites = false;
	jar.vehicle = null;
	vi.unstubAllEnvs();
});

describe("remembering a size", () => {
	it("stores the list's own label in a cookie only the server reads, for a year", async () => {
		vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
		await expect(rememberTyreSize("205/55 R16")).resolves.toEqual({ ok: true, size: "205/55 R16" });
		expect(stored().free).toEqual(entry("205/55 R16"));
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

	it("also remembers a well-formed size the list does not hold: a real tyre is not a mistake", async () => {
		await expect(rememberTyreSize("205/40 R21")).resolves.toEqual({ ok: true, size: "205/40 R21" });
		expect(stored().free?.size).toBe("205/40 R21");
	});

	it.each([
		["a size outside the tyres that exist", "145/70 R99"],
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
		expect(stored().free?.size).toBe("215/60 R16");
	});

	it("starts a new size without the answers that were about the old tyres, and keeps them for the same size", async () => {
		put({ free: entry("195/75 R16", { [MAKE_KEY]: "Michelin" }), vehicles: {} });
		await rememberTyreSize("195/75 R16");
		expect(stored().free?.answers).toEqual({ [MAKE_KEY]: "Michelin" });
		await rememberTyreSize("215/60 R16");
		expect(stored().free?.answers).toEqual({});
	});

	describe("for the car in use", () => {
		it("is written to that car's own entry and leaves the size given with no car alone", async () => {
			put({ free: entry("175 R13"), vehicles: {} });
			jar.vehicle = GOLF;
			await rememberTyreSize("205/55 R16");
			expect(stored()).toEqual({ free: entry("175 R13"), vehicles: { [GOLF]: entry("205/55 R16") } });
		});

		it("keeps another car's tyres where they are", async () => {
			put({ free: null, vehicles: { [OCTAVIA]: entry("215/60 R16") } });
			jar.vehicle = GOLF;
			await rememberTyreSize("205/55 R16");
			expect(stored().vehicles[OCTAVIA]).toEqual(entry("215/60 R16"));
			expect(stored().vehicles[GOLF]).toEqual(entry("205/55 R16"));
		});

		it("does not carry the answers given for the borrowed size over to the car's own", async () => {
			put({ free: entry("195/75 R16", { [MAKE_KEY]: "Michelin" }), vehicles: {} });
			jar.vehicle = GOLF;
			await rememberTyreSize("195/75 R16");
			expect(stored().vehicles[GOLF]).toEqual(entry("195/75 R16"));
		});
	});
});

describe("answering the question about the tyres", () => {
	it("keeps the answer with the size it was given for", async () => {
		put({ free: entry("195/75 R16"), vehicles: {} });
		await expect(rememberTyreAnswer(MAKE_KEY, "Michelin")).resolves.toEqual({ ok: true });
		expect(stored().free).toEqual(entry("195/75 R16", { [MAKE_KEY]: "Michelin" }));
	});

	it("changes an answer and keeps the others", async () => {
		put({ free: entry("215/60 R16", { [DUV]: "other", [MAKE_KEY]: "Michelin" }), vehicles: {} });
		await rememberTyreAnswer(DUV, DUV);
		expect(stored().free?.answers).toEqual({ [DUV]: DUV, [MAKE_KEY]: "Michelin" });
	});

	it("accepts 'none of these' and the options of the question, and nothing else", async () => {
		put({ free: entry("195/75 R16"), vehicles: {} });
		await expect(rememberTyreAnswer(MAKE_KEY, "other")).resolves.toEqual({ ok: true });
		for (const answer of ["Pirelli", "michelin", "", undefined, null, 5, {}, ["Michelin"]]) {
			await expect(rememberTyreAnswer(MAKE_KEY, answer), String(answer)).resolves.toEqual({
				ok: false,
				error: "not-an-answer",
			});
		}
		expect(stored().free?.answers).toEqual({ [MAKE_KEY]: "other" });
	});

	it("refuses an answer to a question the list does not ask", async () => {
		put({ free: entry("195/75 R16"), vehicles: {} });
		for (const key of ["Nobody|asked", "", undefined, null, 5, "__proto__", "constructor"]) {
			await expect(rememberTyreAnswer(key, "other"), String(key)).resolves.toEqual({
				ok: false,
				error: "not-an-answer",
			});
		}
		expect(stored().free?.answers).toEqual({});
	});

	it("has nothing to hang the answer on when no size was given", async () => {
		await expect(rememberTyreAnswer(MAKE_KEY, "Michelin")).resolves.toEqual({ ok: false, error: "no-size" });
		expect(jar.value).toBeUndefined();
	});

	it("says so when the cookie cannot be written", async () => {
		put({ free: entry("195/75 R16"), vehicles: {} });
		jar.failWrites = true;
		await expect(rememberTyreAnswer(MAKE_KEY, "Michelin")).resolves.toEqual({
			ok: false,
			error: "write-failed",
		});
	});

	it("gives the car in use its own copy when the size it sees is the one given with no car", async () => {
		put({ free: entry("195/75 R16", { [DUV]: "other" }), vehicles: {} });
		jar.vehicle = GOLF;
		await rememberTyreAnswer(MAKE_KEY, "Kleber");
		expect(stored()).toEqual({
			free: entry("195/75 R16", { [DUV]: "other" }),
			vehicles: { [GOLF]: entry("195/75 R16", { [DUV]: "other", [MAKE_KEY]: "Kleber" }) },
		});
	});

	it("never writes into another car's entry", async () => {
		put({ free: null, vehicles: { [OCTAVIA]: entry("195/75 R16"), [GOLF]: entry("195/75 R16") } });
		jar.vehicle = GOLF;
		await rememberTyreAnswer(MAKE_KEY, "Michelin");
		expect(stored().vehicles[OCTAVIA]).toEqual(entry("195/75 R16"));
		expect(stored().vehicles[GOLF]).toEqual(entry("195/75 R16", { [MAKE_KEY]: "Michelin" }));
	});
});

describe("forgetting a size", () => {
	it("takes the cookie away when nothing else is left", async () => {
		await rememberTyreSize("205/55 R16");
		await expect(forgetTyreSize()).resolves.toEqual({ ok: true });
		expect(jar.value).toBeUndefined();
		expect(jar.deleted).toBe(1);
	});

	it("forgets only the car in use's own size", async () => {
		put({
			free: entry("175 R13"),
			vehicles: { [GOLF]: entry("205/55 R16"), [OCTAVIA]: entry("215/60 R16") },
		});
		jar.vehicle = GOLF;
		await forgetTyreSize();
		expect(stored()).toEqual({ free: entry("175 R13"), vehicles: { [OCTAVIA]: entry("215/60 R16") } });
	});

	it("forgets the size given with no car when that is the one the car in use is shown", async () => {
		put({ free: entry("175 R13"), vehicles: { [OCTAVIA]: entry("215/60 R16") } });
		jar.vehicle = GOLF;
		await forgetTyreSize();
		expect(stored()).toEqual({ free: null, vehicles: { [OCTAVIA]: entry("215/60 R16") } });
	});

	it("reports it, when the cookie cannot be changed", async () => {
		jar.failWrites = true;
		await expect(forgetTyreSize()).resolves.toEqual({ ok: false });
	});
});

describe("what the selector's tyre tab is told", () => {
	it("starts with the remembered size and the first step", async () => {
		put({ free: entry("205/55 R16"), vehicles: {} });
		const step = await loadTyreStep();
		expect(step.current).toBe("205/55 R16");
		expect(step.vehicleInUse).toBe(false);
		expect(step.steps.widths.length).toBeGreaterThan(30);
		expect(step.steps.profiles).toBeNull();
		expect(step.match).toBeNull();
		expect(step.unknownText).toBe(false);
	});

	it("says whether the size will be remembered for a car", async () => {
		jar.vehicle = GOLF;
		expect((await loadTyreStep()).vehicleInUse).toBe(true);
	});

	it("shows the size of the car in use, not another car's", async () => {
		put({ free: null, vehicles: { [OCTAVIA]: entry("215/60 R16"), [GOLF]: entry("205/55 R16") } });
		jar.vehicle = GOLF;
		expect((await loadTyreStep()).current).toBe("205/55 R16");
		jar.vehicle = "audi|a4|8|2020";
		expect((await loadTyreStep()).current).toBeNull();
	});

	it("has no current size when nothing was remembered, or the cookie is not trusted", async () => {
		expect((await loadTyreStep()).current).toBeNull();
		put({ free: entry("145/70 R99"), vehicles: {} });
		expect((await loadTyreStep()).current).toBeNull();
	});

	it("matches what was typed to the list's label", async () => {
		const step = await loadTyreStep({ text: "205/55r16 91V" });
		expect(step).toMatchObject({ match: "205/55 R16", listed: true, unknownText: false });
	});

	it("takes a well-formed size the list does not hold as the shopper's size, and says the list does not hold it", async () => {
		const step = await loadTyreStep({ text: "205/40 R21" });
		expect(step).toMatchObject({ match: "205/40 R21", listed: false, unknownText: false });
	});

	it("says when what was typed is no size at all", async () => {
		for (const text of ["145/70 R99", "hello", "205/55 R61", "999/99 R99"]) {
			const step = await loadTyreStep({ text });
			expect(step, text).toMatchObject({ match: null, listed: false, unknownText: true });
		}
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
		expect(rim).toMatchObject({ match: "205/55 R16", listed: true });
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
